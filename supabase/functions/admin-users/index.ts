// Cria e remove usuários do sistema e, para a desenvolvedora (TI), troca e-mail, senha e desliga as duas etapas.
// Roda no Supabase (Deno) com a chave de serviço, que nunca vai para o navegador.
// Quem chama precisa estar logado e ser administrador; as ações de TI são da desenvolvedora, e o admin troca nome,
// e-mail e senha de quem não é a desenvolvedora nem ele mesmo. Tudo conferido aqui.
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

type ErrorCode = "forbidden" | "invalid" | "email_taken" | "self" | "last" | "not_found" | "server";

const STATUS: Record<ErrorCode, number> = {
  forbidden: 403,
  invalid: 400,
  email_taken: 409,
  self: 409,
  last: 409,
  not_found: 404,
  server: 500,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

const failWith = (code: ErrorCode) => json({ error: code }, STATUS[code]);

/** Áreas que o ajudante pode receber. Mesma lista da constraint de admin_users.permissions. */
const PERMISSIONS = new Set(["accounts", "emails", "orders", "customers", "partners", "crm", "automation", "finance", "site"]);

interface CreateInput {
  name: string;
  email: string;
  password: string;
  role: "admin" | "helper";
  permissions: string[];
}

function parseAccess(body: Record<string, unknown>): Pick<CreateInput, "role" | "permissions"> | null {
  const role = body.role === undefined ? "admin" : body.role;
  if (role !== "admin" && role !== "helper") return null;
  const raw = body.permissions === undefined ? [] : body.permissions;
  if (!Array.isArray(raw) || !raw.every((item) => typeof item === "string" && PERMISSIONS.has(item))) return null;
  return { role, permissions: role === "helper" ? [...new Set(raw as string[])] : [] };
}

/** Mesmas regras do newAdminUserSchema do painel. */
function parseCreate(body: Record<string, unknown>): CreateInput | null {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (name.length < 2 || name.length > 80) return null;
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return null;
  if (!isStrongPassword(password)) return null;
  const access = parseAccess(body);
  return access ? { name, email, password, ...access } : null;
}

/** Quem tem acesso completo da loja (papel admin): o sistema nunca fica sem nenhum. */
async function adminCount(service: SupabaseClient): Promise<number> {
  const { count, error } = await service.from("admin_users").select("user_id", { count: "exact", head: true }).eq("role", "admin");
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
    .insert({ user_id: user.id, name: input.name, role: input.role, permissions: input.permissions })
    .select("user_id, name, role, permissions, created_at")
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
  const { data: target, error: targetError } = await service.from("admin_users").select("role").eq("user_id", userId).maybeSingle();
  if (targetError) throw targetError;
  if (!target) return failWith("not_found");
  if (target.role === "admin" && (await adminCount(service)) <= 1) return failWith("last");
  // Apagar no Auth leva junto a linha de admin_users (on delete cascade).
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) {
    console.error(error);
    return failWith("server");
  }
  return json({ ok: true });
}

interface ProfileInput {
  userId: string;
  name: string;
  email: string;
  whatsapp: string | null;
}

/** Mesmas regras do accessProfileSchema do painel. */
function parseProfile(body: Record<string, unknown>): ProfileInput | null {
  const userId = typeof body.userId === "string" ? body.userId : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const whatsappDigits = typeof body.whatsapp === "string" ? body.whatsapp.replace(/\D/g, "") : "";
  if (!userId || name.length < 2 || name.length > 80) return null;
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return null;
  if (whatsappDigits && (whatsappDigits.length < 10 || whatsappDigits.length > 13)) return null;
  return { userId, name, email, whatsapp: whatsappDigits || null };
}

/** Só mexe em quem é usuário do sistema. */
async function isSystemUser(service: SupabaseClient, userId: unknown): Promise<boolean> {
  if (typeof userId !== "string" || userId.length === 0) return false;
  const { data, error } = await service.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data !== null;
}

/** E-mail novo vale na hora (sem e-mail de confirmação): a TI já conferiu com a pessoa. */
async function updateProfile(service: SupabaseClient, input: ProfileInput): Promise<Response> {
  if (!(await isSystemUser(service, input.userId))) return failWith("not_found");
  const { error } = await service.auth.admin.updateUserById(input.userId, {
    email: input.email,
    email_confirm: true,
    user_metadata: { name: input.name },
  });
  if (error) {
    if (error.code === "email_exists" || error.status === 422) return failWith("email_taken");
    console.error(error);
    return failWith("server");
  }
  const { error: rowError } = await service
    .from("admin_users")
    .update({ name: input.name, whatsapp: input.whatsapp })
    .eq("user_id", input.userId);
  if (rowError) {
    console.error(rowError);
    return failWith("server");
  }
  return json({ ok: true });
}

async function setPassword(service: SupabaseClient, userId: unknown, password: unknown): Promise<Response> {
  if (typeof password !== "string" || !isStrongPassword(password)) return failWith("invalid");
  if (!(await isSystemUser(service, userId))) return failWith("not_found");
  const { error } = await service.auth.admin.updateUserById(userId as string, { password });
  if (error) {
    console.error(error);
    return failWith("server");
  }
  return json({ ok: true });
}

/** Desliga as duas etapas (perdeu o celular): a pessoa entra só com a senha e cadastra de novo em Configurações. */
async function resetMfa(service: SupabaseClient, userId: unknown): Promise<Response> {
  if (!(await isSystemUser(service, userId))) return failWith("not_found");
  const { data, error } = await service.auth.admin.mfa.listFactors({ userId: userId as string });
  if (error) {
    console.error(error);
    return failWith("server");
  }
  for (const factor of data.factors) {
    const { error: deleteError } = await service.auth.admin.mfa.deleteFactor({ userId: userId as string, id: factor.id });
    if (deleteError) {
      console.error(deleteError);
      return failWith("server");
    }
  }
  return json({ ok: true });
}

/** Ações de TI. A desenvolvedora faz todas, em qualquer usuário. */
const DEVELOPER_ACTIONS = new Set(["update_profile", "set_password", "reset_mfa"]);
/** O que o admin também faz pela ficha em Usuários: trocar nome, e-mail e senha de quem não é a desenvolvedora nem ele mesmo. */
const ADMIN_LOGIN_ACTIONS = new Set(["update_profile", "set_password"]);

/** O papel de quem pede deixa fazer esta ação de TI neste usuário? */
async function mayManageLogin(service: SupabaseClient, callerRole: unknown, callerId: string, action: string, userId: unknown): Promise<boolean> {
  if (callerRole === "developer") return true;
  if (callerRole !== "admin" || !ADMIN_LOGIN_ACTIONS.has(action)) return false;
  if (typeof userId !== "string" || userId.length === 0 || userId === callerId) return false;
  const { data, error } = await service.from("admin_users").select("role").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data !== null && data.role !== "developer";
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
    // Ações de TI: a desenvolvedora em todos; o admin só nome, e-mail e senha de quem não é ele nem a desenvolvedora.
    if (typeof payload.action === "string" && DEVELOPER_ACTIONS.has(payload.action)) {
      const { data: role } = await caller.rpc("current_admin_role");
      if (!(await mayManageLogin(service, role, auth.user.id, payload.action, payload.userId))) return failWith("forbidden");
    }
    if (payload.action === "create") {
      const input = parseCreate(payload);
      return input ? await createUser(service, input) : failWith("invalid");
    }
    if (payload.action === "remove") return await removeUser(service, auth.user.id, payload.userId);
    if (payload.action === "update_profile") {
      const input = parseProfile(payload);
      return input ? await updateProfile(service, input) : failWith("invalid");
    }
    if (payload.action === "set_password") return await setPassword(service, payload.userId, payload.password);
    if (payload.action === "reset_mfa") return await resetMfa(service, payload.userId);
    return failWith("invalid");
  } catch (error) {
    console.error(error);
    return failWith("server");
  }
});
