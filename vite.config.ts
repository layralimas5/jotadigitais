import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";

const LOOKUP_MODULE = "/supabase/functions/account-lookup/lookup.ts";
const MAX_BODY_BYTES = 4096;

const LOOKUP_STATUS: Record<string, number> = { invalid_url: 400, unsupported: 400, not_found: 404, blocked: 502, failed: 502 };

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > MAX_BODY_BYTES) reject(new Error("body_too_large"));
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

async function handleLookup(server: ViteDevServer, request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "POST") return send(response, 405, { error: "invalid_url" });
  const lookup = (await server.ssrLoadModule(LOOKUP_MODULE)) as typeof import("./supabase/functions/account-lookup/lookup");
  try {
    const parsed: unknown = JSON.parse(await readBody(request));
    const url = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>).url : null;
    if (typeof url !== "string") return send(response, 400, { error: "invalid_url" });
    send(response, 200, await lookup.lookupProfile(url));
  } catch (error) {
    if (error instanceof lookup.LookupError) return send(response, LOOKUP_STATUS[error.code] ?? 502, { error: error.code });
    console.error(error);
    send(response, 502, { error: "failed" });
  }
}

/**
 * No modo demonstração não há Edge Function: em desenvolvimento, o próprio Vite responde a busca de perfil
 * com o mesmo código que roda no Supabase.
 */
function accountLookupDevApi(): Plugin {
  return {
    name: "account-lookup-dev-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/account-lookup", (request, response) => void handleLookup(server, request, response));
    },
  };
}

/**
 * Sem as chaves do Supabase o painel abre em modo demonstração, sem senha. Isso serve para desenvolver,
 * nunca para o site no ar: o build de produção para aqui em vez de publicar o painel aberto.
 */
function requireSupabaseInProduction(command: string, mode: string) {
  if (command !== "build" || mode !== "production") return;
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const missing = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"].filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Build de produção sem ${missing.join(" e ")}: o painel ficaria aberto em modo demonstração.`);
  }
}

export default defineConfig(({ command, mode }) => {
  requireSupabaseInProduction(command, mode);
  return {
    plugins: [react(), tailwindcss(), accountLookupDevApi()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: { port: 5210 },
  };
});
