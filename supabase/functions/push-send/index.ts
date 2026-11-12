// Manda a notificação push para os celulares e computadores de quem pode ver o aviso.
// Duas formas de chamar:
//   1. O banco, a cada aviso novo no sininho (gatilho dispatch_push via pg_net), com o cabeçalho x-push-secret.
//   2. O painel, no botão "Enviar teste", com o token de quem está logado: manda só para os aparelhos dela.
// Quem recebe segue a mesma regra do sininho (policy "notifications staff read") e as preferências de cada pessoa.
// Deploy: npx supabase functions deploy push-send --no-verify-jwt
// Segredos: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SEND_SECRET (o mesmo valor de push_send_secret no Vault).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";
import webpush from "npm:web-push@3.6.7";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VAPID_SUBJECT = "https://jotadigitais.com.br";

type Role = "admin" | "developer" | "helper";

interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  recipient_role: Role | null;
}

interface Subscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface Staff {
  user_id: string;
  role: Role;
  permissions: string[];
}

interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

/** Comparação em tempo constante para o segredo do banco. */
function sameSecret(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

/** A desenvolvedora não cuida da loja: no celular dela só chegam suporte e segurança. Mesma lista de pushKindsFor. */
const DEVELOPER_KINDS = new Set(["support", "security"]);

/** Mesma regra da policy do sininho: quem pode ver este aviso. */
function canSee(staff: Staff, notification: Notification): boolean {
  const addressed = notification.recipient_role === null || notification.recipient_role === staff.role;
  if (staff.role === "admin") return addressed;
  if (staff.role === "developer") return addressed && DEVELOPER_KINDS.has(notification.kind);
  return (
    notification.recipient_role === null &&
    (notification.kind === "order" || notification.kind === "payment") &&
    staff.permissions.includes("orders")
  );
}

async function recipientsOf(admin: SupabaseClient, notification: Notification): Promise<string[]> {
  const [{ data: staff, error: staffError }, { data: preferences, error: prefError }] = await Promise.all([
    admin.from("admin_users").select("user_id, role, permissions"),
    admin.from("push_preferences").select("user_id, kinds"),
  ]);
  if (staffError) throw staffError;
  if (prefError) throw prefError;
  const kindsOf = new Map((preferences ?? []).map((row: { user_id: string; kinds: string[] }) => [row.user_id, row.kinds]));
  return (staff as Staff[])
    .filter((person) => canSee(person, notification))
    .filter((person) => kindsOf.get(person.user_id)?.includes(notification.kind) ?? true)
    .map((person) => person.user_id);
}

async function subscriptionsOf(admin: SupabaseClient, userIds: string[]): Promise<Subscription[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", userIds);
  if (error) throw error;
  return data as Subscription[];
}

/** Envia para cada aparelho. Aparelho que o serviço de push diz não existir mais (404/410) é apagado. */
async function deliver(admin: SupabaseClient, subscriptions: Subscription[], payload: PushPayload) {
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, {
        TTL: 60 * 60 * 24,
        urgency: "high",
        topic: payload.tag.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, "-"),
      }),
    ),
  );
  const gone: string[] = [];
  let sent = 0;
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      sent += 1;
      return;
    }
    const status = (result.reason as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) gone.push(subscriptions[index].id);
    else console.error("push falhou", subscriptions[index].endpoint.slice(0, 60), status, String(result.reason));
  });
  if (gone.length > 0) {
    const { error } = await admin.from("push_subscriptions").delete().in("id", gone);
    if (error) console.error("não apagou inscrições vencidas", error);
  }
  return { sent, removed: gone.length, failed: subscriptions.length - sent - gone.length };
}

async function sendNotification(admin: SupabaseClient, notificationId: unknown): Promise<Response> {
  if (typeof notificationId !== "string" || !/^[0-9a-f-]{36}$/i.test(notificationId)) return json({ error: "invalid" }, 400);
  const { data, error } = await admin
    .from("notifications")
    .select("id, kind, title, body, link, recipient_role")
    .eq("id", notificationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return json({ error: "not_found" }, 404);
  const notification = data as Notification;
  const subscriptions = await subscriptionsOf(admin, await recipientsOf(admin, notification));
  const result = await deliver(admin, subscriptions, {
    title: notification.title,
    body: notification.body ?? "",
    url: notification.link ?? "/admin",
    tag: `${notification.kind}-${notification.id}`,
  });
  return json(result);
}

async function sendTest(admin: SupabaseClient, token: string): Promise<Response> {
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "forbidden" }, 403);
  const { data: staff, error } = await admin.from("admin_users").select("user_id").eq("user_id", userData.user.id).maybeSingle();
  if (error) throw error;
  if (!staff) return json({ error: "forbidden" }, 403);
  const subscriptions = await subscriptionsOf(admin, [userData.user.id]);
  if (subscriptions.length === 0) return json({ error: "no_devices" }, 409);
  const result = await deliver(admin, subscriptions, {
    title: "Teste do Jota Digitais",
    body: "Se você está lendo isto, as notificações estão funcionando neste aparelho.",
    url: "/admin/configuracoes",
    tag: "test",
  });
  return json(result);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (request.method !== "POST") return json({ error: "method" }, 405);

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const pushSecret = Deno.env.get("PUSH_SEND_SECRET");
  if (!publicKey || !privateKey || !pushSecret) {
    console.error("push-send sem VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY ou PUSH_SEND_SECRET");
    return json({ error: "server" }, 500);
  }
  webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const secret = request.headers.get("x-push-secret");
    if (secret !== null) {
      if (!sameSecret(secret, pushSecret)) return json({ error: "forbidden" }, 403);
      const body = (await request.json().catch(() => null)) as { notification_id?: unknown } | null;
      return await sendNotification(admin, body?.notification_id);
    }
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "forbidden" }, 403);
    return await sendTest(admin, token);
  } catch (error) {
    console.error("push-send", error);
    return json({ error: "server" }, 500);
  }
});
