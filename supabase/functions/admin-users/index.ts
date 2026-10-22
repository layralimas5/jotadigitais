// Cria e remove usuários do sistema. Roda no Supabase (Deno) com a chave de serviço, que nunca vai para o navegador.
// Quem chama precisa estar logado e ser administrador; isso é conferido aqui, com o token de quem pediu.
// Deploy: npx supabase functions deploy admin-users
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** 10 a 72 caracteres, com pelo menos uma letra e um número. */
const isStrongPassword = (password: string) =>
  password.length >= 10 && password.length <= 72 && /[A-Za-z]/.test(password) && /\d/.test(password);

type ErrorCode = "forbidden" | "invalid" | "email_taken" | "self" | "last" | "server";

const STATUS: Record<ErrorCode, number> = {
  forbidden: 403,
  invalid: 400,
  email_taken: 409,
  self: 409,
  last: 409,
  server: 500,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

const failWith = (code: ErrorCode) => json({ error: code }, STATUS[code]);

interface CreateInput {
  name: string;
  email: string;
  password: string;
}

/** Mesmas regras do newAdminUserSchema do painel. */
function parseCreate(body: Record<string, unknown>): CreateInput | null {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (name.length < 2 || name.length > 80) return null;
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return null;
  if (!isStrongPassword(password)) return null;
  return { name, email, password };
}

async function adminCount(service: SupabaseClient): Promise<number> {
  const { count, error } = await service.from("admin_users").select("user_id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

async function createUser(service: SupabaseClient, input: CreateInput): Promise<Response> {
  const { data, error } = await service.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name },
  });
  if (error) {
    if (error.code === "email_exists" || error.status === 422) return failWith("email_taken");
    console.error(error);
    return failWith("server");
  }
  const user = data.user;
  const { data: row, error: insertError } = await service
    .from("admin_users")
    .insert({ user_id: user.id, name: input.name })
    .select("user_id, name, role, created_at")
    .single();
  if (insertError) {
    console.error(insertError);
    await service.auth.admin.deleteUser(user.id);
    return failWith("server");
  }
  return json({ ...row, email: user.email, last_sign_in_at: null }, 201);
}

async function removeUser(service: SupabaseClient, callerId: string, userId: unknown): Promise<Response> {
  if (typeof userId !== "string" || userId.length === 0) return failWith("invalid");
  if (userId === callerId) return failWith("self");
  if ((await adminCount(service)) <= 1) return failWith("last");
  // Apagar no Auth leva junto a linha de admin_users (on delete cascade).
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) {
    console.error(error);
    return failWith("server");
  }
  return json({ ok: true });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (request.method !== "POST") return failWith("invalid");

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return failWith("server");

  const authorization = request.headers.get("Authorization") ?? "";
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: auth } = await caller.auth.getUser();
  const { data: isAdmin } = await caller.rpc("is_admin");
  if (!auth.user || isAdmin !== true) return failWith("forbidden");

  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null) return failWith("invalid");
  const payload = body as Record<string, unknown>;

  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  try {
    if (payload.action === "create") {
      const input = parseCreate(payload);
      return input ? await createUser(service, input) : failWith("invalid");
    }
    if (payload.action === "remove") return await removeUser(service, auth.user.id, payload.userId);
    return failWith("invalid");
  } catch (error) {
    console.error(error);
    return failWith("server");
  }
});
