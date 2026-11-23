// Cadastro público do programa de afiliados ("Seja afiliado").
// O cadastro aberto do Supabase Auth continua desligado: esta função cria o login com a chave de serviço e grava o
// afiliado pela register_affiliate, que confere programa ligado, termos atuais, CPF e limite por IP.
// Se a gravação falhar, o login recém-criado é apagado para não sobrar usuário sem afiliado.
// Deploy: npx supabase functions deploy affiliate-signup --no-verify-jwt
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Mesma regra do painel: 10 a 72 caracteres, com letra e número. */
const isStrongPassword = (password: string) =>
  password.length >= 10 && password.length <= 72 && /[A-Za-z]/.test(password) && /\d/.test(password);

/** Erros que a register_affiliate devolve e que a tela sabe explicar. */
const KNOWN_ERRORS = ["program_closed", "outdated_terms", "too_many_attempts", "invalid_document", "document_taken"] as const;
type KnownError = (typeof KNOWN_ERRORS)[number];
type ErrorCode = KnownError | "invalid" | "email_taken" | "server";

const STATUS: Record<ErrorCode, number> = {
  invalid: 400,
  invalid_document: 400,
  outdated_terms: 409,
  email_taken: 409,
  document_taken: 409,
  program_closed: 403,
  too_many_attempts: 429,
  server: 500,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

const failWith = (code: ErrorCode) => json({ error: code }, STATUS[code]);

interface SignupInput {
  name: string;
  email: string;
  password: string;
  whatsapp: string | null;
  document: string;
  termsSha256: string;
}

function parse(body: Record<string, unknown>): SignupInput | null {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const name = text(body.name).replace(/\s+/g, " ");
  const email = text(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const whatsapp = text(body.whatsapp).replace(/\D/g, "");
  const document = text(body.document).replace(/\D/g, "");
  const termsSha256 = text(body.termsSha256);
  if (name.length < 2 || name.length > 80) return null;
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return null;
  if (!isStrongPassword(password)) return null;
  if (whatsapp && !/^\d{10,13}$/.test(whatsapp)) return null;
  if (!/^\d{11}$/.test(document)) return null;
  if (!/^[0-9a-f]{64}$/.test(termsSha256)) return null;
  return { name, email, password, whatsapp: whatsapp || null, document, termsSha256 };
}

function clientIp(request: Request): string | null {
  const direct = request.headers.get("cf-connecting-ip");
  if (direct) return direct.slice(0, 64);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ? forwarded.slice(0, 64) : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (request.method !== "POST") return failWith("invalid");

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return failWith("invalid");
  }
  const input = parse(body ?? {});
  if (!input) return failWith("invalid");

  const service = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: program, error: programError } = await service.from("affiliate_program").select("enabled").single();
  if (programError) {
    console.error(programError);
    return failWith("server");
  }
  if (!program.enabled) return failWith("program_closed");

  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name, kind: "affiliate" },
  });
  if (createError) {
    if (createError.code === "email_exists" || createError.status === 422) return failWith("email_taken");
    console.error(createError);
    return failWith("server");
  }

  const { data: registered, error: registerError } = await service.rpc("register_affiliate", {
    p_user_id: created.user.id,
    p_name: input.name,
    p_email: input.email,
    p_whatsapp: input.whatsapp,
    p_document: input.document,
    p_terms_sha256: input.termsSha256,
    p_ip: clientIp(request),
  });
  if (registerError) {
    const { error: cleanupError } = await service.auth.admin.deleteUser(created.user.id);
    if (cleanupError) console.error("cleanup", cleanupError);
    const known = KNOWN_ERRORS.find((code) => registerError.message.includes(code));
    if (known) return failWith(known);
    console.error(registerError);
    return failWith("server");
  }

  return json(registered);
});
