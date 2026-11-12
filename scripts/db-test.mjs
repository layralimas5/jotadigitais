// Testa as migrations do Supabase num Postgres em memória (PGlite), simulando os papéis anon,
// authenticated e admin. Uso: npm run db:test
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { currentLegalDocuments } from "./legal-hashes.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

const ADMIN_ID = "00000000-0000-0000-0000-00000000a001";
const STRANGER_ID = "00000000-0000-0000-0000-00000000b002";
/** Sessão aberta de cada usuário: is_admin confere a sessão do token (session_id) em auth.sessions. */
const SESSION_OF = {
  [ADMIN_ID]: "00000000-0000-0000-0000-0000000005a1",
  [STRANGER_ID]: "00000000-0000-0000-0000-0000000005b2",
};

/** O mínimo do ambiente Supabase que as migrations usam: papéis, auth (sessões e MFA), storage, Vault e pgcrypto. */
const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, last_sign_in_at timestamptz);
  create table auth.sessions (id uuid primary key, user_id uuid not null, created_at timestamptz not null default now(), ip text, user_agent text);
  create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null, status text not null);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create schema extensions;
  create schema vault;
  create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text, description text);
  create view vault.decrypted_secrets as select id, name, secret as decrypted_secret, description from vault.secrets;
  create function vault.create_secret(new_secret text, new_name text default null, new_description text default '')
    returns uuid language sql as $$
    insert into vault.secrets (secret, name, description) values (new_secret, new_name, new_description) returning id
  $$;
  create schema net;
  create table net.requests (id bigserial primary key, url text, body jsonb, headers jsonb);
  create function net.http_post(url text, body jsonb, headers jsonb, timeout_milliseconds integer)
    returns bigint language sql as $$
    insert into net.requests (url, body, headers) values (url, body, headers) returning id
  $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema public, auth, storage to anon, authenticated;
  grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
  grant select, insert, update, delete on storage.objects to anon, authenticated;
  -- Como nos projetos novos do Supabase: tabela nenhuma nasce liberada; o acesso vem da migration table_grants.
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

const db = new PGlite({ extensions: { pgcrypto } });
/** Aceite da versão atual dos Termos e da Política, como o checkout manda. */
let CONSENT = "";
let failures = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  ok  ${message}`);
  } else {
    failures += 1;
    console.error(`  FALHOU  ${message}`);
  }
}

/**
 * Roda `fn` como o papel indicado, com o token de `userId`. `aal` e `sessionId` simulam a verificação em duas etapas
 * e a sessão do token; `ip` e `forwardedFor` simulam os cabeçalhos que chegam ao PostgREST.
 */
async function as(role, userId, fn, { aal = "aal1", sessionId, ip, forwardedFor } = {}) {
  const claims = userId ? JSON.stringify({ sub: userId, aal, session_id: sessionId ?? SESSION_OF[userId] }) : "";
  const headers = {};
  if (ip) headers["cf-connecting-ip"] = ip;
  if (forwardedFor) headers["x-forwarded-for"] = forwardedFor;
  await db.exec("reset role;");
  await db.query(
    `select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false), set_config('request.headers', $3, false)`,
    [userId ?? "", claims, Object.keys(headers).length > 0 ? JSON.stringify(headers) : ""],
  );
  if (role !== "postgres") await db.exec(`set role ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}

async function rejects(fn, pattern) {
  try {
    await fn();
    return false;
  } catch (error) {
    return pattern.test(String(error.message));
  }
}

const tiktokStats = JSON.stringify({ likes: 2123, following: 0 });
const youtubeStats = JSON.stringify({ views: 120000, videos: 40, watchHours: 4100, monetized: true });

async function main() {
  const legal = Object.fromEntries((await currentLegalDocuments()).map((doc) => [doc.slug, doc]));
  CONSENT = `'${legal.terms.version}', '${legal.terms.sha256}', '${legal.privacy.version}', '${legal.privacy.sha256}'`;
  await db.exec(SUPABASE_STUBS);
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  console.log("migrations aplicadas");

  await db.exec(`
    insert into auth.users (id, email) values ('${ADMIN_ID}', 'jota@exemplo.com'), ('${STRANGER_ID}', 'x@exemplo.com');
    insert into public.admin_users (user_id) values ('${ADMIN_ID}');
    insert into auth.sessions (id, user_id, ip) values ('${SESSION_OF[ADMIN_ID]}', '${ADMIN_ID}', '203.0.113.1'), ('${SESSION_OF[STRANGER_ID]}', '${STRANGER_ID}', null);
  `);

  console.log("\ncontas");
  const created = await as("authenticated", ADMIN_ID, () =>
    db.query(
      `insert into public.accounts (slug, platform, display_name, handle, followers, price_cents, stats)
       values ('achadinhos-da-bia', 'tiktok', 'Achadinhos da Bia', '@achadinhos.dabia', 1259, 37000, $1),
              ('canal-receitas', 'youtube', 'Canal Receitas', '@canalreceitas', 5400, 150000, $2)
       returning id, slug`,
      [tiktokStats, youtubeStats],
    ),
  );
  check(created.rows.length === 2, "admin cadastra contas de redes diferentes");
  const tiktokId = created.rows[0].id;
  const youtubeId = created.rows[1].id;

  check(
    await rejects(
      () =>
        as("authenticated", ADMIN_ID, () =>
          db.query(
            `insert into public.accounts (slug, platform, display_name, handle, followers, price_cents, stats)
             values ('sem-dados', 'youtube', 'Sem Dados', '@semdados', 10, 1000, $1)`,
            [tiktokStats],
          ),
        ),
      /stats_match_platform/,
    ),
    "banco recusa conta do YouTube com dados de TikTok",
  );

  check(
    await rejects(
      () =>
        as("anon", null, () =>
          db.query(
            `insert into public.accounts (slug, platform, display_name, handle, followers, price_cents, stats)
             values ('invasor', 'tiktok', 'Invasor', '@invasor', 1, 1000, $1)`,
            [tiktokStats],
          ),
        ),
      /row-level security|permission denied/,
    ),
    "visitante não cadastra conta",
  );

  const strangerUpdate = await as("authenticated", STRANGER_ID, () =>
    db.query(`update public.accounts set price_cents = 100 where id = $1 returning id`, [tiktokId]),
  );
  check(strangerUpdate.rows.length === 0, "usuário logado que não é admin não altera conta");

  const publicAccounts = await as("anon", null, () => db.query(`select slug, stats from public.accounts`));
  check(publicAccounts.rows.length === 2, "visitante lê a vitrine");

  console.log("\ndepoimentos");
  const published = await as("anon", null, () => db.query(`select id from public.testimonials`));
  check(published.rows.length === 6, "visitante vê os 6 depoimentos publicados");
  await as("authenticated", ADMIN_ID, () =>
    db.query(`update public.testimonials set published = false where position = 0`),
  );
  const afterHide = await as("anon", null, () => db.query(`select id from public.testimonials`));
  check(afterHide.rows.length === 5, "depoimento despublicado some do site");
  const adminSees = await as("authenticated", ADMIN_ID, () => db.query(`select id from public.testimonials`));
  check(adminSees.rows.length === 6, "admin continua vendo o despublicado");

  console.log("\npedidos");
  const placed = await as("anon", null, () =>
    db.query(`select public.place_order($1, 'Maria Silva', 'Maria@Exemplo.com', '(11) 91234-5678', '529.982.247-25', '1990-05-10', '', 'Natal', 'RN', 'pix', ${CONSENT}) as data`, [
      tiktokId,
    ]),
  );
  const order = placed.rows[0].data;
  check(/^JD-[A-Z0-9]{6}$/.test(order.code), `pedido criado com código ${order.code}`);
  check(order.customer_email === "ma***@exemplo.com", "e-mail volta mascarado para o público");

  const reserved = await db.query(`select status, reserved_until from public.accounts where id = $1`, [tiktokId]);
  check(reserved.rows[0].status === "reserved" && reserved.rows[0].reserved_until, "conta fica reservada com prazo");

  check(
    await rejects(
      () => as("anon", null, () => db.query(`select public.place_order($1, 'Outro Cliente', 'outro@exemplo.com', '11912345678', '529.982.247-25', '1990-05-10', '', 'Natal', 'RN', 'card', ${CONSENT})`, [tiktokId])),
      /account_unavailable/,
    ),
    "segunda compra da mesma conta é recusada",
  );

  check(
    await rejects(
      () => as("anon", null, () => db.query(`select public.place_order($1, 'Ab', 'x@exemplo.com', '11912345678', '529.982.247-25', '1990-05-10', '', 'Natal', 'RN', 'pix', ${CONSENT})`, [youtubeId])),
      /invalid_name/,
    ),
    "servidor valida o nome",
  );
  check(
    await rejects(
      () => as("anon", null, () => db.query(`select public.place_order($1, 'Nome Ok', 'sem-arroba', '11912345678', '529.982.247-25', '1990-05-10', '', 'Natal', 'RN', 'pix', ${CONSENT})`, [youtubeId])),
      /invalid_email/,
    ),
    "servidor valida o e-mail",
  );
  const placeYoutube = (whatsapp, document, birthDate, city, state) =>
    as("anon", null, () =>
      db.query(`select public.place_order($1, 'Nome Ok', 'ficha@exemplo.com', $2, $3, $4, '', $5, $6, 'pix', ${CONSENT})`, [
        youtubeId,
        whatsapp,
        document,
        birthDate,
        city,
        state,
      ]),
    );
  check(await rejects(() => placeYoutube("", "52998224725", "1990-05-10", "Natal", "RN"), /invalid_whatsapp/), "checkout exige WhatsApp");
  check(await rejects(() => placeYoutube("11912345678", "12345678900", "1990-05-10", "Natal", "RN"), /invalid_document/), "servidor recusa CPF com dígito errado");
  check(await rejects(() => placeYoutube("11912345678", "11222333000181", "2015-01-01", "Natal", "RN"), /invalid_birth_date/), "menor de 18 anos não compra");
  check(await rejects(() => placeYoutube("11912345678", "11222333000181", "1990-05-10", "X", "RN"), /invalid_city/), "cidade informada com uma letra só é recusada");
  check(await rejects(() => placeYoutube("11912345678", "11222333000181", "1990-05-10", "Natal", "XX"), /invalid_state/), "checkout exige UF válida");
  check(
    await rejects(
      () => as("anon", null, () => db.query(`select public.place_order($1, 'Maria Silva', 'maria@exemplo.com', '11912345678', 'pix')`, [youtubeId])),
      /function .* does not exist/,
    ),
    "versão antiga do checkout, sem ficha, não existe mais",
  );
  const sheet = await as("authenticated", ADMIN_ID, () =>
    db.query(`select o.customer_document_plain as customer_document, customer_birth_date::text as birth, customer_state from public.orders o where code = $1`, [order.code]),
  );
  check(
    sheet.rows[0]?.customer_document === "52998224725" && sheet.rows[0]?.birth === "1990-05-10" && sheet.rows[0]?.customer_state === "RN",
    "admin lê a ficha do checkout, com o CPF só em números",
  );

  const anonOrders = await as("anon", null, () =>
    rejects(() => db.query(`select * from public.orders`), /permission denied|row-level/).then(async (denied) => {
      if (denied) return 0;
      const rows = await db.query(`select * from public.orders`);
      return rows.rows.length;
    }),
  );
  check(anonOrders === 0, "visitante não lista pedidos");

  const lookup = await as("anon", null, () => db.query(`select public.get_order($1) as data`, [order.code.toLowerCase()]));
  check(lookup.rows[0].data?.code === order.code, "página do pedido encontra pelo código");
  check(lookup.rows[0].data?.customer_document === undefined, "página pública do pedido não mostra a ficha");

  check(
    await rejects(
      () => as("anon", null, () => db.query(`select public.generate_order_code()`)),
      /permission denied/,
    ),
    "função interna não fica exposta",
  );

  console.log("\nreserva vencida");
  // Simula o relógio passando do prazo (na vida real ninguém atualiza a linha: o tempo só passa).
  await db.exec(`alter table public.accounts disable trigger accounts_normalize_reservation`);
  await db.query(`update public.accounts set reserved_until = now() - interval '1 minute' where id = $1`, [tiktokId]);
  await db.exec(`alter table public.accounts enable trigger accounts_normalize_reservation`);
  await db.query(`update public.orders set expires_at = now() - interval '1 minute' where code = $1`, [order.code]);
  const retaken = await as("anon", null, () =>
    db.query(`select public.place_order($1, 'Joana Lima', 'joana@exemplo.com', '11912345678', '529.982.247-25', '1990-05-10', '', 'Natal', 'RN', 'card', ${CONSENT}) as data`, [tiktokId]),
  );
  check(Boolean(retaken.rows[0].data.code), "conta com reserva vencida volta a ser vendável");
  const oldOrder = await db.query(`select status from public.orders where code = $1`, [order.code]);
  check(oldOrder.rows[0].status === "canceled", "pedido antigo sem pagamento é cancelado");

  console.log("\npainel de pedidos");
  const secondCode = retaken.rows[0].data.code;
  await as("authenticated", ADMIN_ID, () =>
    db.query(`update public.orders set status = 'paid' where code = $1`, [secondCode]),
  );
  let account = await db.query(`select status, reserved_until from public.accounts where id = $1`, [tiktokId]);
  check(account.rows[0].status === "reserved" && account.rows[0].reserved_until === null, "pago: conta reservada sem prazo");

  await as("authenticated", ADMIN_ID, () =>
    db.query(`update public.orders set status = 'delivered' where code = $1`, [secondCode]),
  );
  account = await db.query(`select status from public.accounts where id = $1`, [tiktokId]);
  check(account.rows[0].status === "sold", "entregue: conta vendida");

  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`update public.orders set status = 'paid' where code = $1`, [secondCode])),
      /invalid_transition/,
    ),
    "transição inválida é recusada",
  );

  const third = await as("anon", null, () =>
    db.query(`select public.place_order($1, 'Carlos Souza', 'carlos@exemplo.com', '11912345678', '529.982.247-25', '1990-05-10', '', 'Natal', 'RN', 'pix', ${CONSENT}) as data`, [youtubeId]),
  );
  await as("authenticated", ADMIN_ID, () =>
    db.query(`update public.orders set status = 'canceled' where code = $1`, [third.rows[0].data.code]),
  );
  account = await db.query(`select status, reserved_until from public.accounts where id = $1`, [youtubeId]);
  check(account.rows[0].status === "available", "cancelado: conta volta para a vitrine");

  await as("authenticated", ADMIN_ID, () =>
    db.query(`update public.accounts set status = 'reserved', reserved_until = now() - interval '1 hour' where id = $1`, [youtubeId]),
  );
  account = await db.query(`select status, reserved_until from public.accounts where id = $1`, [youtubeId]);
  check(account.rows[0].status === "reserved" && account.rows[0].reserved_until === null, "reserva manual fica sem prazo");
  await as("authenticated", ADMIN_ID, () => db.query(`update public.accounts set status = 'available' where id = $1`, [youtubeId]));

  const strangerOrders = await as("authenticated", STRANGER_ID, () => db.query(`select id from public.orders`));
  check(strangerOrders.rows.length === 0, "usuário que não é admin não vê pedidos");

  console.log("\nlimite de pedidos abertos");
  const extra = [];
  for (let index = 0; index < 3; index += 1) {
    const slug = `extra-${index}`;
    const row = await as("authenticated", ADMIN_ID, () =>
      db.query(
        `insert into public.accounts (slug, platform, display_name, handle, followers, price_cents, stats)
         values ($1, 'tiktok', 'Conta Extra', '@extra${index}', 1000, 37000, $2) returning id`,
        [slug, tiktokStats],
      ),
    );
    extra.push(row.rows[0].id);
  }
  await as("anon", null, () => db.query(`select public.place_order($1, 'Spam Teste', 'spam@exemplo.com', '11912345678', '529.982.247-25', '1990-05-10', '', 'Natal', 'RN', 'pix', ${CONSENT})`, [extra[0]]));
  await as("anon", null, () => db.query(`select public.place_order($1, 'Spam Teste', 'spam@exemplo.com', '11912345678', '529.982.247-25', '1990-05-10', '', 'Natal', 'RN', 'pix', ${CONSENT})`, [extra[1]]));
  check(
    await rejects(
      () => as("anon", null, () => db.query(`select public.place_order($1, 'Spam Teste', 'spam@exemplo.com', '11912345678', '529.982.247-25', '1990-05-10', '', 'Natal', 'RN', 'pix', ${CONSENT})`, [extra[2]])),
      /too_many_open_orders/,
    ),
    "terceiro pedido aberto do mesmo e-mail é barrado",
  );

  console.log("\nconfigurações da loja");
  const settings = await as("anon", null, () => db.query(`select instagram_handle, guarantee_days from public.store_settings`));
  check(settings.rows.length === 1 && settings.rows[0].guarantee_days === 7, "visitante lê a linha única de configurações");

  const strangerSettings = await as("authenticated", STRANGER_ID, () =>
    db.query(`update public.store_settings set guarantee_days = 30 returning id`),
  );
  check(strangerSettings.rows.length === 0, "usuário que não é admin não altera as configurações");

  const adminSettings = await as("authenticated", ADMIN_ID, () =>
    db.query(`update public.store_settings set whatsapp_number = '5511912345678', guarantee_days = 15 returning guarantee_days`),
  );
  check(adminSettings.rows[0]?.guarantee_days === 15, "admin altera as configurações");

  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`update public.store_settings set whatsapp_number = '123'`)),
      /check constraint/,
    ),
    "banco recusa WhatsApp sem DDI e DDD",
  );
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`insert into public.store_settings (id) values (false)`)),
      /permission denied|row-level security|check constraint/,
    ),
    "não dá para criar uma segunda linha",
  );

  console.log("\ncrm");
  const lead = await as("authenticated", ADMIN_ID, () =>
    db.query(
      `insert into public.leads (name, whatsapp, instagram, source, interest, budget_cents, next_follow_up)
       values ('Paula Reis', '11912345678', '@paula.reis', 'instagram', 'tiktok', 40000, current_date) returning id, stage`,
    ),
  );
  check(lead.rows[0]?.stage === "new", "admin cadastra lead, que entra como novo contato");

  const anonLeads = await as("anon", null, () =>
    rejects(() => db.query(`select id from public.leads`), /permission denied|row-level/).then(async (denied) => {
      if (denied) return 0;
      return (await db.query(`select id from public.leads`)).rows.length;
    }),
  );
  check(anonLeads === 0, "visitante não enxerga o CRM");

  const strangerLeads = await as("authenticated", STRANGER_ID, () => db.query(`select id from public.leads`));
  check(strangerLeads.rows.length === 0, "usuário que não é admin não enxerga o CRM");

  const moved = await as("authenticated", ADMIN_ID, () =>
    db.query(`update public.leads set stage = 'negotiating' where id = $1 returning stage`, [lead.rows[0].id]),
  );
  check(moved.rows[0]?.stage === "negotiating", "admin move o lead de etapa");

  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`insert into public.leads (name, whatsapp) values ('Sem Numero', '12')`)),
      /check constraint/,
    ),
    "banco recusa WhatsApp curto demais",
  );

  console.log("\nclientes");
  const customer = await as("authenticated", ADMIN_ID, () =>
    db.query(`insert into public.customers (name, email, whatsapp) values ('Ana Lima', 'Ana@Exemplo.com', '11977776666') returning id`),
  );
  check(customer.rows.length === 1, "admin cadastra cliente");
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`insert into public.customers (name, email) values ('Outra Ana', 'ana@exemplo.com')`)),
      /duplicate key|unique/,
    ),
    "e-mail repetido é recusado, sem diferenciar maiúscula",
  );
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`insert into public.customers (name) values ('Sem Contato')`)),
      /customers_has_contact/,
    ),
    "cliente precisa de pelo menos um contato",
  );
  const anonCustomers = await as("anon", null, () =>
    rejects(() => db.query(`select id from public.customers`), /permission denied|row-level/).then(async (denied) => {
      if (denied) return 0;
      return (await db.query(`select id from public.customers`)).rows.length;
    }),
  );
  check(anonCustomers === 0, "visitante não enxerga clientes");
  const strangerCustomers = await as("authenticated", STRANGER_ID, () => db.query(`select id from public.customers`));
  check(strangerCustomers.rows.length === 0, "usuário que não é admin não enxerga clientes");

  console.log("\nmensagens da automação");
  await as("authenticated", ADMIN_ID, () =>
    db.query(`insert into public.message_templates (key, body) values ('order_received', 'Olá, {nome}!')
              on conflict (key) do update set body = excluded.body`),
  );
  const templates = await as("authenticated", ADMIN_ID, () => db.query(`select body from public.message_templates`));
  check(templates.rows[0]?.body === "Olá, {nome}!", "admin salva modelo de mensagem");
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`insert into public.message_templates (key, body) values ('inventado', 'x')`)),
      /check constraint/,
    ),
    "modelo com chave desconhecida é recusado",
  );
  const strangerTemplates = await as("authenticated", STRANGER_ID, () => db.query(`select key from public.message_templates`));
  check(strangerTemplates.rows.length === 0, "usuário que não é admin não lê os modelos");

  console.log("\nfoto da conta");
  const withAvatar = await as("authenticated", ADMIN_ID, () =>
    db.query(`update public.accounts set avatar_url = 'https://exemplo.com/foto.webp' where id = $1 returning avatar_url`, [youtubeId]),
  );
  check(withAvatar.rows[0]?.avatar_url === "https://exemplo.com/foto.webp", "admin coloca a foto de perfil da conta");

  console.log("\npreferências do painel");
  await as("authenticated", ADMIN_ID, () =>
    db.query(`insert into public.admin_preferences (key, value) values ('crm_stage_order', '["lost","new"]')
              on conflict (key) do update set value = excluded.value`),
  );
  const preference = await as("authenticated", ADMIN_ID, () => db.query(`select value from public.admin_preferences`));
  check(Array.isArray(preference.rows[0]?.value), "admin salva a ordem das colunas do CRM");
  const strangerPreferences = await as("authenticated", STRANGER_ID, () => db.query(`select key from public.admin_preferences`));
  check(strangerPreferences.rows.length === 0, "usuário que não é admin não lê as preferências");

  console.log("\nfinanceiro");
  const expense = await as("authenticated", ADMIN_ID, () =>
    db.query(
      `insert into public.expenses (description, category, amount_cents, spent_on)
       values ('Compra da conta @extra0', 'account_purchase', 15000, current_date) returning id`,
    ),
  );
  check(expense.rows.length === 1, "admin lança despesa");
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`insert into public.expenses (description, amount_cents) values ('Zerada', 0)`)),
      /check constraint/,
    ),
    "despesa sem valor é recusada",
  );
  const anonExpenses = await as("anon", null, () =>
    rejects(() => db.query(`select id from public.expenses`), /permission denied|row-level/).then(async (denied) => {
      if (denied) return 0;
      return (await db.query(`select id from public.expenses`)).rows.length;
    }),
  );
  check(anonExpenses === 0, "visitante não enxerga o financeiro");
  const strangerExpenses = await as("authenticated", STRANGER_ID, () => db.query(`select id from public.expenses`));
  check(strangerExpenses.rows.length === 0, "usuário que não é admin não enxerga o financeiro");

  console.log("\nparceiros");
  const partner = await as("authenticated", ADMIN_ID, () =>
    db.query(
      `insert into public.partners (name, whatsapp, pix_key, commission_percent)
       values ('Fornecedor Teste', '11912345678', 'chave@pix.com', 30) returning id`,
    ),
  );
  const partnerId = partner.rows[0]?.id;
  check(Boolean(partnerId), "admin cadastra parceiro");
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`insert into public.partners (name, commission_percent) values ('Demais', 120)`)),
      /check constraint/,
    ),
    "comissão acima de 100% é recusada",
  );
  const anonPartners = await as("anon", null, () =>
    rejects(() => db.query(`select id from public.partners`), /permission denied|row-level/).then(async (denied) => {
      if (denied) return 0;
      return (await db.query(`select id from public.partners`)).rows.length;
    }),
  );
  check(anonPartners === 0, "visitante não enxerga parceiros");
  const strangerPartners = await as("authenticated", STRANGER_ID, () => db.query(`select id from public.partners`));
  check(strangerPartners.rows.length === 0, "usuário que não é admin não enxerga parceiros");
  await as("authenticated", ADMIN_ID, () => db.query(`update public.accounts set partner_id = $1 where id = $2`, [partnerId, youtubeId]));
  await as("authenticated", ADMIN_ID, () => db.query(`delete from public.partners where id = $1`, [partnerId]));
  const unlinked = await db.query(`select partner_id from public.accounts where id = $1`, [youtubeId]);
  check(unlinked.rows[0]?.partner_id === null, "apagar o parceiro deixa a conta como da loja");

  console.log("\nfinalizados");
  const delivered = await db.query(`select delivered_at from public.orders where status = 'delivered'`);
  check(
    delivered.rows.length > 0 && delivered.rows.every((row) => row.delivered_at !== null),
    "pedido entregue guarda a data da entrega",
  );

  console.log("\nusuários");
  const users = await as("authenticated", ADMIN_ID, () => db.query(`select * from public.list_admin_users()`));
  check(users.rows.length === 1 && users.rows[0]?.email === "jota@exemplo.com", "admin lista os usuários com e-mail");
  check(users.rows[0]?.role === "admin", "usuário novo entra com o papel de admin");
  const roleUpdate = await as("authenticated", ADMIN_ID, () =>
    db.query(`update public.admin_users set role = 'developer' where user_id = '${ADMIN_ID}' returning role`),
  );
  check(roleUpdate.rows.length === 0, "ninguém troca o próprio papel pelo painel");
  check(
    await rejects(() => db.query(`update public.admin_users set role = 'dono' where user_id = '${ADMIN_ID}'`), /check constraint/),
    "papel fora de admin e developer é barrado pelo banco",
  );
  check(
    await rejects(() => as("authenticated", STRANGER_ID, () => db.query(`select * from public.list_admin_users()`)), /forbidden/),
    "usuário que não é admin não lista os usuários",
  );
  check(
    await rejects(() => as("anon", null, () => db.query(`select * from public.list_admin_users()`)), /permission denied/),
    "visitante não lista os usuários",
  );
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`insert into public.admin_users (user_id) values ($1)`, [STRANGER_ID])),
      /row-level security|permission denied/,
    ),
    "ninguém vira admin pelo painel sem passar pela função do servidor",
  );

  console.log("\nlink do perfil e oferta");
  const linked = await as("authenticated", ADMIN_ID, () =>
    db.query(
      `update public.accounts set profile_url = 'https://www.tiktok.com/@achadinhos.dabia', stats_synced_at = now()
       where id = $1 returning profile_url`,
      [tiktokId],
    ),
  );
  check(linked.rows[0]?.profile_url === "https://www.tiktok.com/@achadinhos.dabia", "admin salva o link do perfil");
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`update public.accounts set profile_url = 'javascript:alert(1)' where id = $1`, [tiktokId])),
      /check constraint/,
    ),
    "link que não começa com https:// é recusado",
  );
  const offer = await as("authenticated", ADMIN_ID, () =>
    db.query(`insert into public.message_templates (key, body) values ('account_offer', 'Oi, {nome}! {conta}') returning key`),
  );
  check(offer.rows[0]?.key === "account_offer", "admin salva o modelo de oferta de conta");

  console.log("\nnotificações");
  const orderNotices = await as("authenticated", ADMIN_ID, () =>
    db.query(`select title, body, link from public.notifications where kind = 'order' order by created_at`),
  );
  check(
    orderNotices.rows.length > 0 && orderNotices.rows[0].title.startsWith("Novo pedido JD-") && /R\$ \d+,\d{2}/.test(orderNotices.rows[0].body),
    "pedido novo vira notificação com o valor",
  );
  const news = await as("authenticated", ADMIN_ID, () => db.query(`select id from public.notifications where kind = 'news'`));
  check(news.rows.length === 3, "novidades do sistema entram pela migration");
  const strangerNotices = await as("authenticated", STRANGER_ID, () => db.query(`select id from public.notifications`));
  check(strangerNotices.rows.length === 0, "usuário que não é admin não lê notificações");
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`insert into public.notifications (kind, title) values ('news', 'Falsa')`)),
      /permission denied|row-level security/,
    ),
    "ninguém cria notificação pelo painel",
  );
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`insert into public.notifications (kind, title, link) values ('news', 'x', 'https://golpe.com')`)),
      /permission denied|row-level security|check constraint/,
    ),
    "notificação não leva para fora do painel",
  );
  await as("authenticated", ADMIN_ID, () =>
    db.query(`insert into public.notification_dismissals (key) values ('notification:abc'), ('reminder:followups:2026-10-15')`),
  );
  const mine = await as("authenticated", ADMIN_ID, () => db.query(`select key from public.notification_dismissals`));
  check(mine.rows.length === 2, "admin apaga notificações para si");
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`insert into public.notification_dismissals (user_id, key) values ($1, 'x')`, [STRANGER_ID])),
      /row-level security/,
    ),
    "ninguém apaga notificação no nome de outro usuário",
  );
  const calendarPref = await as("authenticated", ADMIN_ID, () =>
    db.query(`insert into public.admin_preferences (key, value) values ('google_calendar', '{"email":"jota@gmail.com"}') returning key`),
  );
  check(calendarPref.rows[0]?.key === "google_calendar", "admin guarda a conta Google ligada");

  console.log("\nperfil");
  await as("authenticated", ADMIN_ID, () => db.query(`select public.update_my_profile('  Jota Digitais  ')`));
  const profile = await db.query(`select name from public.admin_users where user_id = '${ADMIN_ID}'`);
  check(profile.rows[0]?.name === "Jota Digitais", "admin muda o próprio nome, sem espaços nas pontas");
  check(
    await rejects(() => as("authenticated", STRANGER_ID, () => db.query(`select public.update_my_profile('Intruso')`)), /forbidden/),
    "usuário que não é admin não usa a função de perfil",
  );
  check(
    await rejects(() => as("anon", null, () => db.query(`select public.update_my_profile('Visitante')`)), /permission denied/),
    "visitante não chama a função de perfil",
  );
  check(
    await rejects(() => as("authenticated", ADMIN_ID, () => db.query(`select public.update_my_profile('J')`)), /check constraint/),
    "nome com menos de 2 letras é barrado pelo banco",
  );

  console.log("\nreceitas");
  const revenue = await as("authenticated", ADMIN_ID, () =>
    db.query(`insert into public.revenues (description, category, amount_cents, received_on, payment_method)
      values ('Venda por fora', 'account_sale', 45000, '2026-10-20', 'pix') returning id`),
  );
  check(revenue.rows.length === 1, "admin lança receita");
  const strangerRevenues = await as("authenticated", STRANGER_ID, () => db.query(`select id from public.revenues`));
  check(strangerRevenues.rows.length === 0, "usuário que não é admin não vê receitas");
  check(
    await rejects(() => as("anon", null, () => db.query(`select id from public.revenues`)), /permission denied/),
    "visitante não lê receitas",
  );
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`insert into public.revenues (description, amount_cents) values ('Zero', 0)`)),
      /check constraint/,
    ),
    "receita de valor zero é barrada",
  );

  console.log("\ntextos do site");
  await as("authenticated", ADMIN_ID, () =>
    db.query(`insert into public.site_content (id, content) values (true, '{"hero":{"title":"Novo título"}}')`),
  );
  const publicCopy = await as("anon", null, () => db.query(`select content->'hero'->>'title' as title from public.site_content`));
  check(publicCopy.rows[0]?.title === "Novo título", "visitante lê os textos do site");
  check(
    await rejects(() => as("anon", null, () => db.query(`update public.site_content set content = '{}'`)), /permission denied/),
    "visitante não altera os textos",
  );
  const strangerCopy = await as("authenticated", STRANGER_ID, () =>
    db.query(`update public.site_content set content = '{"hacked":true}' returning id`),
  );
  check(strangerCopy.rows.length === 0, "usuário que não é admin não altera os textos");
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`insert into public.site_content (id, content) values (false, '{}')`)),
      /check constraint/,
    ),
    "só existe uma linha de textos",
  );

  console.log("\nimagens");
  check(
    await rejects(
      () => as("anon", null, () => db.query(`insert into storage.objects (bucket_id, name) values ('media', 'x.webp')`)),
      /row-level security/,
    ),
    "visitante não sobe imagem",
  );
  const upload = await as("authenticated", ADMIN_ID, () =>
    db.query(`insert into storage.objects (bucket_id, name) values ('media', 'testimonials/a.webp') returning id`),
  );
  check(upload.rows.length === 1, "admin sobe imagem");

  await lgpdChecks(legal);
  await securityChecks();
  await emailVaultChecks();
  await referralChecks();
  await splitPaymentChecks();
  await checkoutWithoutEmailChecks();
  await cardInstallmentChecks();
  await couponChecks();
  await cartChecks();
  await accountCountryChecks();
  await partnerTagChecks();
  await c6PixChecks();
  await accountMockupChecks();
  await supportChecks();
  await helperChecks();
  await legalEditingChecks();
  await supportForwardChecks();
  await supportPriorityChecks();
  await webPushChecks();

  console.log(failures === 0 ? "\nTudo certo." : `\n${failures} verificação(ões) falharam.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

async function lgpdChecks(legal) {
  console.log("\nlgpd: aceite");
  const published = await db.query(`select slug, version, sha256 from public.legal_documents order by published_at desc, version desc`);
  for (const slug of ["terms", "privacy"]) {
    const latest = published.rows.find((row) => row.slug === slug);
    check(
      latest?.version === legal[slug].version && latest?.sha256 === legal[slug].sha256,
      `migration tem a versão atual de ${slug} (rode node scripts/legal-hashes.mjs se o texto mudou)`,
    );
  }

  const account = await db.query(
    `insert into public.accounts (slug, platform, display_name, handle, followers, price_cents, stats)
     values ('conta-lgpd', 'tiktok', 'Conta LGPD', '@contalgpd', 1000, 50000, $1) returning id`,
    [tiktokStats],
  );
  const accountId = account.rows[0].id;
  const ficha = `'Ana Paula Souza', 'anapaula@lgpd.com.br', '11955554444', '111.444.777-35', '1990-05-10', '@anapaula', 'Natal', 'RN', 'pix'`;
  const staleHash = "0".repeat(64);
  check(
    await rejects(
      () => as("anon", null, () => db.query(`select public.place_order($1, ${ficha}, '${legal.terms.version}', '${staleHash}', '${legal.privacy.version}', '${legal.privacy.sha256}')`, [accountId])),
      /outdated_legal_documents/,
    ),
    "checkout recusa aceite de texto diferente do publicado",
  );
  const anaOrder = (await as("anon", null, () => db.query(`select public.place_order($1, ${ficha}, ${CONSENT}) as data`, [accountId]))).rows[0].data;
  check(anaOrder.customer_name === "Ana", "página pública do pedido mostra só o primeiro nome");

  const consents = await as("authenticated", ADMIN_ID, () =>
    db.query(`select r.document_slug, r.document_sha256 from public.consent_records r join public.orders o on o.id = r.order_id where o.code = $1`, [anaOrder.code]),
  );
  check(consents.rows.length === 2, "pedido grava o aceite dos Termos e da Política");
  check(consents.rows.every((row) => row.document_sha256 === legal[row.document_slug].sha256), "aceite guarda o hash do documento");
  check(
    await rejects(() => as("anon", null, () => db.query(`select * from public.consent_records`)), /permission denied/),
    "visitante não lê provas de aceite",
  );
  const strangerConsents = await as("authenticated", STRANGER_ID, () => db.query(`select id from public.consent_records`));
  check(strangerConsents.rows.length === 0, "usuário que não é admin não lê provas de aceite");
  check(
    await rejects(() => as("authenticated", ADMIN_ID, () => db.query(`delete from public.consent_records`)), /permission denied/),
    "nem o admin apaga prova de aceite",
  );
  check(
    await rejects(() => as("anon", null, () => db.query(`select public.create_order($1, ${ficha})`, [accountId])), /permission denied/),
    "etapa interna do pedido, sem aceite, não fica exposta",
  );

  console.log("\nlgpd: meus dados");
  const wrong = await as("anon", null, () => db.query(`select public.privacy_lookup('anapaula@lgpd.com.br', 'JD-AAAAAA') as data`));
  check(wrong.rows[0].data === null, "código errado não mostra nada");
  const mine = (await as("anon", null, () => db.query(`select public.privacy_lookup(' ANAPAULA@lgpd.com.br ', $1) as data`, [anaOrder.code.toLowerCase()]))).rows[0].data;
  check(mine?.orders?.[0]?.customer_document === "11144477735", "titular vê a própria ficha completa");
  check(mine?.consents?.length === 2, "titular vê os próprios aceites");

  const opened = (await as("anon", null, () =>
    db.query(`select public.privacy_request('anapaula@lgpd.com.br', $1, 'access', 'Quero meus dados') as data`, [anaOrder.code]),
  )).rows[0].data;
  check(/^LGPD-[A-Z0-9]{8}$/.test(opened?.protocol ?? ""), `solicitação gera protocolo ${opened?.protocol}`);
  const denied = (await as("anon", null, () =>
    db.query(`select public.privacy_request('outra@exemplo.com', $1, 'access', null) as data`, [anaOrder.code]),
  )).rows[0].data;
  check(denied === null, "outra pessoa não abre solicitação no pedido alheio");
  check(
    await rejects(() => as("anon", null, () => db.query(`select * from public.data_requests`)), /permission denied/),
    "visitante não lista solicitações",
  );
  const bell = await as("authenticated", ADMIN_ID, () => db.query(`select link from public.notifications where kind = 'privacy'`));
  check(bell.rows[0]?.link === "/admin/privacidade", "solicitação avisa no sininho");

  const due = await as("authenticated", ADMIN_ID, () =>
    db.query(`select extract(day from due_at - created_at)::int as days from public.data_requests where protocol = $1`, [opened.protocol]),
  );
  check(due.rows[0]?.days === 15, "prazo de resposta de 15 dias");
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`update public.data_requests set status = 'rejected' where protocol = $1`, [opened.protocol])),
      /rejected_needs_reason/,
    ),
    "recusa exige motivo",
  );
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`update public.data_requests set email = 'x@x.com' where protocol = $1`, [opened.protocol])),
      /permission denied/,
    ),
    "painel não muda o conteúdo da solicitação",
  );
  const answered = await as("authenticated", ADMIN_ID, () =>
    db.query(`update public.data_requests set status = 'done', response = 'Enviado.' where protocol = $1 returning resolved_at`, [opened.protocol]),
  );
  check(answered.rows[0]?.resolved_at, "resposta marca a data de conclusão");
  const strangerAnswer = await as("authenticated", STRANGER_ID, () =>
    db.query(`update public.data_requests set status = 'open' returning id`),
  );
  check(strangerAnswer.rows.length === 0, "usuário que não é admin não responde solicitação");

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await as("anon", null, () => db.query(`select public.privacy_lookup('robo@exemplo.com', 'JD-ZZZZZZ')`));
  }
  check(
    await rejects(() => as("anon", null, () => db.query(`select public.privacy_lookup('robo@exemplo.com', 'JD-ZZZZZZ')`)), /too_many_attempts/),
    "Meus dados trava depois de 10 tentativas por hora",
  );

  console.log("\nlgpd: anonimização e retenção");
  check(
    await rejects(() => as("anon", null, () => db.query(`select public.anonymize_data_subject('anapaula@lgpd.com.br')`)), /permission denied/),
    "visitante não anonimiza",
  );
  check(
    await rejects(() => as("authenticated", STRANGER_ID, () => db.query(`select public.anonymize_data_subject('anapaula@lgpd.com.br')`)), /forbidden/),
    "usuário que não é admin não anonimiza",
  );
  await as("authenticated", ADMIN_ID, () => db.query(`update public.orders set status = 'canceled' where code = $1`, [anaOrder.code]));
  await db.query(`insert into public.customers (name, email, whatsapp) values ('Ana Paula', 'anapaula@lgpd.com.br', '11912345678')`);
  const result = (await as("authenticated", ADMIN_ID, () => db.query(`select public.anonymize_data_subject('anapaula@lgpd.com.br') as data`))).rows[0].data;
  check(result.anonymized_orders === 1 && result.kept_orders === 0 && result.deleted_customers === 1, "pedido cancelado é anonimizado e o cadastro some");
  const after = await db.query(
    `select customer_name, customer_document, customer_document_encrypted, customer_document_hash, customer_instagram from public.orders where code = $1`,
    [anaOrder.code],
  );
  check(
    after.rows[0].customer_name === "Titular anonimizado" &&
      after.rows[0].customer_document === null &&
      after.rows[0].customer_document_encrypted === null &&
      after.rows[0].customer_document_hash === null &&
      after.rows[0].customer_instagram === null,
    "pedido anonimizado não identifica mais a pessoa",
  );
  const keptProof = await db.query(`select count(*)::int as total, count(ip_address)::int as with_ip from public.consent_records r join public.orders o on o.id = r.order_id where o.code = $1`, [anaOrder.code]);
  check(keptProof.rows[0].total === 2 && keptProof.rows[0].with_ip === 0, "prova de aceite fica, sem IP e navegador");

  await db.exec(`
    insert into public.orders (code, account_handle, account_name, account_platform, customer_name, customer_email, payment_method, total_cents, status, expires_at, created_at)
    values ('JD-VELHO1', '@velha', 'Velha', 'tiktok', 'Pedro Antigo', 'pedro@exemplo.com', 'pix', 1000, 'canceled', now() - interval '7 months', now() - interval '7 months'),
           ('JD-RECENT', '@nova', 'Nova', 'tiktok', 'Paula Recente', 'paula@exemplo.com', 'pix', 1000, 'canceled', now() - interval '1 month', now() - interval '1 month');
    insert into public.leads (name, stage, updated_at) values ('Lead Antigo', 'lost', now() - interval '13 months');
  `);
  check(
    await rejects(() => as("anon", null, () => db.query(`select public.apply_retention_policy()`)), /permission denied/),
    "visitante não aplica retenção",
  );
  check(
    await rejects(() => as("authenticated", ADMIN_ID, () => db.query(`select public.run_retention_policy()`)), /permission denied/),
    "rotina interna de retenção só roda pelo banco",
  );
  const retention = (await as("authenticated", ADMIN_ID, () => db.query(`select public.apply_retention_policy() as data`))).rows[0].data;
  check(retention.anonymized_orders === 1 && retention.deleted_leads >= 1, "retenção anonimiza pedido cancelado com mais de 6 meses e apaga lead parado");
  const recent = await db.query(`select customer_name from public.orders where code = 'JD-RECENT'`);
  check(recent.rows[0].customer_name === "Paula Recente", "pedido cancelado recente fica intacto");
}

/** CPF válido a partir de 9 dígitos (mesma regra de src/domain/brazil.ts). */
function cpfFrom(base) {
  const digits = base.split("").map(Number);
  for (const length of [9, 10]) {
    const total = digits.slice(0, length).reduce((sum, digit, index) => sum + digit * (length + 1 - index), 0);
    digits.push(total % 11 < 2 ? 0 : 11 - (total % 11));
  }
  return digits.join("");
}

async function newAccount(slug) {
  const row = await db.query(
    `insert into public.accounts (slug, platform, display_name, handle, followers, price_cents, stats)
     values ($1, 'tiktok', 'Conta Teste', '@' || $1, 1000, 37000, $2) returning id`,
    [slug, tiktokStats],
  );
  return row.rows[0].id;
}

function placeAs(accountId, buyer, headers = {}, holdMinutes = null) {
  const hold = holdMinutes === null ? "" : `, ${holdMinutes}`;
  return as(
    "anon",
    null,
    () =>
      db.query(
        `select public.place_order($1, 'Cliente Teste', $2, $3, $4, '1990-05-10', '', 'Natal', 'RN', 'pix', ${CONSENT}${hold}) as data`,
        [accountId, buyer.email, buyer.whatsapp, buyer.document],
      ),
    headers,
  );
}

async function securityChecks() {
  console.log("\nsegurança: IP e limite de tentativas");
  const forgedLookup = (index) =>
    as("anon", null, () => db.query(`select public.privacy_lookup('alvo@exemplo.com', 'JD-AAAAAA')`), {
      ip: "198.51.100.20",
      forwardedFor: `10.0.0.${index}`,
    });
  for (let index = 0; index < 10; index += 1) await forgedLookup(index);
  check(await rejects(() => forgedLookup(99), /too_many_attempts/), "trocar o X-Forwarded-For não fura o limite do Meus dados");
  const limitAlert = await db.query(`select body from public.notifications where kind = 'security' and title = 'Limite de tentativas atingido'`);
  check(limitAlert.rows.length === 1 && limitAlert.rows[0].body.includes("Meus dados"), "limite atingido avisa no sininho uma vez só");

  const orderPage = (index) =>
    as("anon", null, () => db.query(`select public.get_order($1) as data`, [`JD-AAA${String(index).padStart(3, "0")}`]), { ip: "198.51.100.30" });
  for (let index = 0; index < 60; index += 1) await orderPage(index);
  check(await rejects(() => orderPage(999), /too_many_attempts/), "página do pedido trava quem varre códigos");

  const limiter = await db.query(
    `select public.rate_limit_allows('teste', 'teste', 2, interval '1 hour') as a,
            public.rate_limit_allows('teste', 'teste', 2, interval '1 hour') as b,
            public.rate_limit_allows('teste', 'teste', 2, interval '1 hour') as c`,
  );
  check(limiter.rows[0].a && limiter.rows[0].b && !limiter.rows[0].c, "limite genérico recusa a tentativa além do teto");

  console.log("\nsegurança: checkout");
  const holdAccount = await newAccount("prazo-fixo");
  const holdDocument = "11222333000181";
  const held = (await placeAs(holdAccount, { email: "prazo@exemplo.com", whatsapp: "11933332222", document: holdDocument }, {}, 1440)).rows[0].data;
  const holdMinutes = await db.query(`select extract(epoch from expires_at - created_at) / 60 as minutes from public.orders where code = $1`, [held.code]);
  check(Math.round(Number(holdMinutes.rows[0].minutes)) === 120, "checkout ignora o prazo de reserva pedido pelo navegador (fica em 2h)");

  const sameDocument = cpfFrom("123456780");
  const documentAccounts = [await newAccount("doc-1"), await newAccount("doc-2"), await newAccount("doc-3")];
  for (const [index, accountId] of documentAccounts.slice(0, 2).entries()) {
    await placeAs(accountId, { email: `doc${index}@exemplo.com`, whatsapp: `1192000000${index}`, document: sameDocument });
  }
  check(
    await rejects(
      () => placeAs(documentAccounts[2], { email: "doc9@exemplo.com", whatsapp: "11920000009", document: sameDocument }),
      /too_many_open_orders/,
    ),
    "terceiro pedido aberto com o mesmo CPF é barrado, mesmo trocando e-mail e WhatsApp",
  );

  const ipAccounts = [await newAccount("ip-1"), await newAccount("ip-2"), await newAccount("ip-3"), await newAccount("ip-4")];
  const fromIp = { ip: "198.51.100.40" };
  for (const [index, accountId] of ipAccounts.slice(0, 3).entries()) {
    await placeAs(accountId, { email: `ip${index}@exemplo.com`, whatsapp: `1193000000${index}`, document: cpfFrom(`23456789${index}`) }, fromIp);
  }
  check(
    await rejects(
      () => placeAs(ipAccounts[3], { email: "ip9@exemplo.com", whatsapp: "11930000009", document: cpfFrom("345678912") }, fromIp),
      /too_many_open_orders/,
    ),
    "quarto pedido aberto do mesmo IP é barrado, mesmo com dados diferentes",
  );

  console.log("\nsegurança: CPF cifrado");
  const stored = await db.query(
    `select customer_document, customer_document_encrypted is not null as encrypted from public.orders where code = $1`,
    [held.code],
  );
  check(stored.rows[0].customer_document === null && stored.rows[0].encrypted, "documento do pedido fica gravado só cifrado");
  const adminPlain = await as("authenticated", ADMIN_ID, () =>
    db.query(`select o.customer_document_plain as document from public.orders o where code = $1`, [held.code]),
  );
  check(adminPlain.rows[0]?.document === holdDocument, "admin lê o documento aberto");
  const strangerPlain = await as("authenticated", STRANGER_ID, () =>
    db.query(`select public.customer_document_plain(o) as document from public.orders o where code = $1`, [held.code]),
  );
  check(strangerPlain.rows.length === 0 || strangerPlain.rows[0].document === null, "usuário que não é admin não abre documento");
  check(
    await rejects(() => as("anon", null, () => db.query(`select public.decrypt_pii('\\x00'::bytea)`)), /permission denied/),
    "visitante não chama a função que decifra",
  );

  const cipheredCustomer = await as("authenticated", ADMIN_ID, () =>
    db.query(`insert into public.customers (name, email, document) values ('Cliente Cifrado', 'cifrado@exemplo.com', '52998224725') returning id, document`),
  );
  const cipheredId = cipheredCustomer.rows[0].id;
  const customerPlain = () =>
    as("authenticated", ADMIN_ID, () => db.query(`select c.document_plain as document from public.customers c where id = $1`, [cipheredId]));
  check(cipheredCustomer.rows[0].document === null && (await customerPlain()).rows[0].document === "52998224725", "CPF do cliente fica cifrado e o admin lê aberto");
  await as("authenticated", ADMIN_ID, () => db.query(`update public.customers set notes = 'Comprou duas vezes' where id = $1`, [cipheredId]));
  check((await customerPlain()).rows[0].document === "52998224725", "editar outro campo não apaga o CPF");
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`update public.customers set document = '123' where id = $1`, [cipheredId])),
      /check constraint/,
    ),
    "CPF com formato errado continua barrado",
  );
  await as("authenticated", ADMIN_ID, () => db.query(`update public.customers set document = null where id = $1`, [cipheredId]));
  check((await customerPlain()).rows[0].document === null, "limpar o CPF apaga o cifrado");

  console.log("\nsegurança: admin com duas etapas e sessão com prazo");
  const ordersSeen = (options) =>
    as("authenticated", ADMIN_ID, () => db.query(`select count(*)::int as total from public.orders`), options).then((result) => result.rows[0].total);
  await db.query(`insert into auth.mfa_factors (user_id, status) values ($1, 'verified')`, [ADMIN_ID]);
  check((await ordersSeen({ aal: "aal1" })) === 0, "admin com duas etapas ligadas não vê nada só com a senha");
  check((await ordersSeen({ aal: "aal2" })) > 0, "admin com o código conferido vê os pedidos");
  await db.query(`delete from auth.mfa_factors where user_id = $1`, [ADMIN_ID]);

  const oldSession = "00000000-0000-0000-0000-0000000005c3";
  await db.query(`insert into auth.sessions (id, user_id, created_at) values ($1, $2, now() - interval '8 days')`, [oldSession, ADMIN_ID]);
  check((await ordersSeen({ sessionId: oldSession })) === 0, "sessão aberta há mais de 7 dias perde o acesso");
  check((await ordersSeen({ sessionId: "00000000-0000-0000-0000-0000000005d4" })) === 0, "token de sessão encerrada (Sair) perde o acesso na hora");

  console.log("\nsegurança: tabela nova e vitrine");
  await db.exec(`create table public.rls_probe (id integer)`);
  const probe = await db.query(`select relrowsecurity from pg_class where oid = 'public.rls_probe'::regclass`);
  check(probe.rows[0].relrowsecurity === true, "tabela nova no schema public nasce com RLS ligado");
  check(
    await rejects(() => as("anon", null, () => db.query(`select * from public.rls_probe`)), /permission denied/),
    "tabela nova não nasce aberta para a chave anon",
  );
  await db.exec(`drop table public.rls_probe`);
  check(
    await rejects(() => as("anon", null, () => db.query(`select partner_id from public.accounts`)), /permission denied/),
    "visitante não descobre qual conta é de parceiro",
  );

  console.log("\nsegurança: auditoria e avisos");
  const auditLead = await as("authenticated", ADMIN_ID, () => db.query(`insert into public.leads (name) values ('Lead Auditado') returning id`));
  await as("authenticated", ADMIN_ID, () => db.query(`delete from public.leads where id = $1`, [auditLead.rows[0].id]));
  const deletion = await db.query(`select actor_id, details from public.audit_events where action = 'delete' and entity = 'leads' and entity_id = $1`, [
    auditLead.rows[0].id,
  ]);
  check(deletion.rows[0]?.actor_id === ADMIN_ID, "exclusão fica registrada com quem apagou");
  const statusChanges = await db.query(`select count(*)::int as total from public.audit_events where entity = 'orders' and action = 'update'`);
  check(statusChanges.rows[0].total > 0, "troca de status de pedido fica registrada");
  check(
    await rejects(() => as("anon", null, () => db.query(`select * from public.audit_events`)), /permission denied/),
    "visitante não lê a auditoria",
  );
  const strangerAudit = await as("authenticated", STRANGER_ID, () => db.query(`select id from public.audit_events`));
  check(strangerAudit.rows.length === 0, "usuário que não é admin não lê a auditoria");
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`insert into public.audit_events (action, entity) values ('forjado', 'x')`)),
      /permission denied/,
    ),
    "nem o admin forja registro de auditoria",
  );

  await db.query(`insert into auth.sessions (id, user_id, ip) values (gen_random_uuid(), $1, '203.0.113.9')`, [ADMIN_ID]);
  const loginAudit = await db.query(`select ip_address from public.audit_events where action = 'login' order by id desc limit 1`);
  check(loginAudit.rows[0]?.ip_address === "203.0.113.9", "login de admin fica registrado com o IP");
  const loginAlert = await db.query(`select link from public.notifications where kind = 'security' and title = 'Novo login no painel'`);
  check(loginAlert.rows.length > 0 && loginAlert.rows[0].link === "/admin/configuracoes", "login de admin avisa no sininho");
  await db.query(`insert into auth.sessions (id, user_id) values (gen_random_uuid(), $1)`, [STRANGER_ID]);
  const strangerLogin = await db.query(`select count(*)::int as total from public.audit_events where action = 'login' and actor_id = $1`, [STRANGER_ID]);
  check(strangerLogin.rows[0].total === 0, "login de quem não é admin não gera aviso");
  const adminAdded = await db.query(`select body from public.notifications where kind = 'security' and title = 'Novo acesso ao painel criado'`);
  check(adminAdded.rows[0]?.body.startsWith("jota@exemplo.com"), "usuário novo no painel avisa no sininho");
}

function placeWithSource(accountId, buyer, source, referredBy) {
  return as("anon", null, () =>
    db.query(
      `select public.place_order($1, 'Cliente Indicado', $2, $3, $4, '1990-05-10', '', 'Natal', 'RN', 'pix', ${CONSENT}, $5, $6) as data`,
      [accountId, buyer.email, buyer.whatsapp, buyer.document, source, referredBy],
    ),
  );
}

async function referralChecks() {
  console.log("\ncomo conheceu e indicação");
  const referred = await placeWithSource(
    await newAccount("indicacao-1"),
    { email: "indicado@exemplo.com", whatsapp: "11955550001", document: cpfFrom("111444777") },
    "referral",
    "  Gimena   Souza ",
  );
  const saved = await db.query(`select customer_source, customer_referred_by from public.orders where code = $1`, [referred.rows[0].data.code]);
  check(
    saved.rows[0]?.customer_source === "referral" && saved.rows[0]?.customer_referred_by === "Gimena Souza",
    "checkout grava a origem e quem indicou, sem espaço sobrando",
  );
  check(!("customer_referred_by" in referred.rows[0].data), "resposta pública do pedido não devolve quem indicou");

  const instagram = await placeWithSource(
    await newAccount("indicacao-2"),
    { email: "insta@exemplo.com", whatsapp: "11955550002", document: cpfFrom("222555888") },
    "instagram",
    "Gimena",
  );
  const fromInstagram = await db.query(`select customer_source, customer_referred_by from public.orders where code = $1`, [instagram.rows[0].data.code]);
  check(
    fromInstagram.rows[0]?.customer_source === "instagram" && fromInstagram.rows[0]?.customer_referred_by === null,
    "quem indicou é descartado quando a origem não é indicação",
  );

  const unnamedAccount = await newAccount("indicacao-3");
  const buyer = { email: "semnome@exemplo.com", whatsapp: "11955550003", document: cpfFrom("333666999") };
  check(await rejects(() => placeWithSource(unnamedAccount, buyer, "referral", " "), /invalid_referred_by/), "indicação sem o nome de quem indicou é recusada");
  check(await rejects(() => placeWithSource(unnamedAccount, buyer, "panfleto", null), /invalid_source/), "origem fora da lista é recusada");
  check(await rejects(() => placeWithSource(unnamedAccount, buyer, null, null), /invalid_source/), "checkout novo sem origem é recusado");

  const legacy = await placeAs(unnamedAccount, buyer);
  check(Boolean(legacy.rows[0]?.data.code), "checkout antigo, sem a pergunta, continua funcionando durante a publicação");

  const manual = await as("authenticated", ADMIN_ID, () =>
    db.query(`insert into public.customers (name, email, source, referred_by) values ('Cliente Manual', 'manual-indicado@exemplo.com', 'referral', 'Gimena') returning referred_by`),
  );
  check(manual.rows[0]?.referred_by === "Gimena", "cadastro manual guarda quem indicou");
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`insert into public.customers (name, source, referred_by) values ('Outro', 'referral', 'G')`)),
      /check/,
    ),
    "nome de quem indicou com uma letra só é recusado",
  );
}

function placeWithPlan(accountId, buyer, plan, firstPartCents) {
  return as("anon", null, () =>
    db.query(
      `select public.place_order($1, 'Cliente Dividido', $2, $3, $4, '1990-05-10', '', 'Natal', 'RN', $5, ${CONSENT}, 'instagram', null, $6) as data`,
      [accountId, buyer.email, buyer.whatsapp, buyer.document, plan, firstPartCents],
    ),
  );
}

async function splitPaymentChecks() {
  console.log("\npagamento dividido");
  const buyer = (n) => ({ email: `dividido${n}@exemplo.com`, whatsapp: `1195556000${n}`, document: cpfFrom(`4${n}${n}777111`.slice(0, 9)) });

  const single = await placeWithPlan(await newAccount("plano-pix"), buyer(1), "pix", null);
  const singleParts = single.rows[0].data.payments;
  check(
    singleParts.length === 1 && singleParts[0].method === "pix" && singleParts[0].amount_cents === 37000,
    "Pix à vista gera uma cobrança com o total",
  );
  check(!("transaction_nsu" in singleParts[0]), "página pública mostra a cobrança sem dados internos da transação");

  const splitAccount = await newAccount("plano-dividido");
  const split = (await placeWithPlan(splitAccount, buyer(2), "card_pix", 15000)).rows[0].data;
  const [cardPart, pixPart] = split.payments;
  check(
    split.payments.length === 2 && cardPart.method === "card" && cardPart.amount_cents === 15000 && pixPart.method === "pix" && pixPart.amount_cents === 22000,
    "cartão + Pix divide o total em duas cobranças, na ordem",
  );

  check(
    await rejects(async () => placeWithPlan(await newAccount("plano-ruim-1"), buyer(3), "two_cards", 300), /invalid_split/),
    "parte menor que R$ 5,00 é recusada",
  );
  check(
    await rejects(async () => placeWithPlan(await newAccount("plano-ruim-2"), buyer(4), "two_cards", 36800), /invalid_split/),
    "segunda parte menor que R$ 5,00 é recusada",
  );
  check(
    await rejects(async () => placeWithPlan(await newAccount("plano-ruim-3"), buyer(5), "card", 1000), /invalid_split/),
    "valor de divisão em pagamento único é recusado",
  );
  check(
    await rejects(() => as("anon", null, () => db.query(`update public.order_payments set status = 'paid' where id = $1`, [pixPart.id])), /permission denied/),
    "visitante não marca pagamento como pago",
  );
  check(
    await rejects(() => as("authenticated", STRANGER_ID, () => db.query(`select public.confirm_card_payment($1, 'tx', 'slug', 15000, 1, null)`, [cardPart.id])), /permission denied/),
    "só a Edge Function confirma cartão",
  );

  const underpaid = await db.query(`select public.confirm_card_payment($1, 'tx-1', 'slug-1', 14000, 3, null) as ok`, [cardPart.id]);
  check(underpaid.rows[0].ok === false, "cartão pago com valor menor não conta como pago");
  const paidCard = await db.query(`select public.confirm_card_payment($1, 'tx-1', 'slug-1', 15000, 3, 'https://recibo.exemplo/1') as ok`, [cardPart.id]);
  const repeated = await db.query(`select public.confirm_card_payment($1, 'tx-1', 'slug-1', 15000, 3, null) as ok`, [cardPart.id]);
  const afterCard = await db.query(`select status from public.orders where code = $1`, [split.code]);
  check(paidCard.rows[0].ok && repeated.rows[0].ok, "confirmação do cartão é aceita e repetir o aviso não muda nada");
  check(afterCard.rows[0].status === "awaiting_payment", "com só o cartão pago o pedido continua esperando o Pix");

  await as("authenticated", ADMIN_ID, () => db.query(`update public.order_payments set status = 'paid' where id = $1`, [pixPart.id]));
  const afterPix = await db.query(
    `select o.status, a.status as account_status, p.paid_at is not null as stamped
     from public.orders o join public.accounts a on a.id = o.account_id join public.order_payments p on p.id = $2
     where o.code = $1`,
    [split.code, pixPart.id],
  );
  check(afterPix.rows[0]?.status === "paid" && afterPix.rows[0]?.stamped, "Pix confirmado pelo Jota fecha o pedido como pago");

  const manual = (await placeWithPlan(await newAccount("plano-manual"), buyer(6), "two_cards", 20000)).rows[0].data;
  await as("authenticated", ADMIN_ID, () => db.query(`update public.orders set status = 'paid' where code = $1`, [manual.code]));
  const manualParts = await db.query(`select count(*) filter (where status = 'paid')::int as paid from public.order_payments where order_id = (select id from public.orders where code = $1)`, [manual.code]);
  check(manualParts.rows[0].paid === 2, "pedido confirmado à mão em Pedidos dá as partes como pagas");

  const canceled = (await placeWithPlan(await newAccount("plano-cancelado"), buyer(7), "card_pix", 20000)).rows[0].data;
  await as("authenticated", ADMIN_ID, () => db.query(`update public.orders set status = 'canceled' where code = $1`, [canceled.code]));
  const canceledParts = await db.query(`select count(*) filter (where status = 'canceled')::int as closed from public.order_payments where order_id = (select id from public.orders where code = $1)`, [canceled.code]);
  check(canceledParts.rows[0].closed === 2, "cancelar o pedido fecha as cobranças em aberto");

  const lookup = await as("anon", null, () => db.query(`select public.get_order($1) as data`, [split.code]));
  check(lookup.rows[0].data.payments.every((part) => part.status === "paid"), "página do pedido mostra as duas partes pagas");
}

async function checkoutWithoutEmailChecks() {
  console.log("\ncheckout sem e-mail");
  const buyer = { email: null, whatsapp: "(84) 99876-5432", document: cpfFrom("518273640") };
  const placed = (await placeWithPlan(await newAccount("sem-email"), buyer, "pix", null)).rows[0].data;
  check(placed.code?.startsWith("JD-") && placed.customer_email === null, "pedido sem e-mail é aceito e a página pública não inventa e-mail");
  const stored = await db.query(`select customer_email, customer_whatsapp from public.orders where code = $1`, [placed.code]);
  check(stored.rows[0].customer_email === null && stored.rows[0].customer_whatsapp === "84998765432", "pedido guarda só o WhatsApp");
  check(
    await rejects(async () => placeWithPlan(await newAccount("email-ruim"), { ...buyer, email: "sem-arroba" }, "pix", null), /invalid_email/),
    "e-mail informado continua conferido",
  );
  await placeWithPlan(await newAccount("sem-email-2"), buyer, "pix", null);
  check(
    await rejects(async () => placeWithPlan(await newAccount("sem-email-3"), buyer, "pix", null), /too_many_open_orders/),
    "teto de pedidos abertos vale pelo WhatsApp mesmo sem e-mail",
  );

  const leanAccount = await newAccount("ficha-enxuta");
  const minorAccount = await newAccount("ficha-menor");
  const lean = (
    await as("anon", null, () =>
      db.query(
        `select public.place_order($1, 'Joana Enxuta', null, '84933332222', $2, null, null, null, null, 'card', ${CONSENT}, 'tiktok', null, null) as data`,
        [leanAccount, cpfFrom("612398745")],
      ),
    )
  ).rows[0].data;
  const leanRow = await db.query(`select customer_birth_date, customer_city, customer_state, customer_instagram from public.orders where code = $1`, [lean.code]);
  check(
    Object.values(leanRow.rows[0]).every((value) => value === null),
    "pedido só com nome, WhatsApp, CPF e origem é aceito, sem nascimento, cidade, estado e Instagram",
  );
  check(
    await rejects(
      async () =>
        as("anon", null, () =>
          db.query(
            `select public.place_order($1, 'Menor Teste', null, '84922221111', $2, (current_date - interval '15 years')::date, null, null, null, 'card', ${CONSENT}, 'tiktok', null, null)`,
            [minorAccount, cpfFrom("731598246")],
          ),
        ),
      /invalid_birth_date/,
    ),
    "nascimento informado de menor de 18 continua recusado",
  );

  const byWhatsapp = (await as("anon", null, () => db.query(`select public.privacy_lookup('(84) 99876-5432', $1) as data`, [placed.code]))).rows[0].data;
  check(byWhatsapp?.contact === "84998765432" && byWhatsapp.orders.length === 2, "Meus dados abre com o WhatsApp da compra");
  const wrongPhone = (await as("anon", null, () => db.query(`select public.privacy_lookup('84911112222', $1) as data`, [placed.code]))).rows[0].data;
  check(wrongPhone === null, "WhatsApp de outra pessoa não abre o pedido");
  const empty = (await as("anon", null, () => db.query(`select public.privacy_lookup('', $1) as data`, [placed.code]))).rows[0].data;
  check(empty === null, "contato vazio não abre o pedido");

  const opened = (await as("anon", null, () => db.query(`select public.privacy_request('84998765432', $1, 'access', null) as data`, [placed.code]))).rows[0].data;
  const request = await db.query(`select email, whatsapp from public.data_requests where protocol = $1`, [opened.protocol]);
  check(request.rows[0].email === null && request.rows[0].whatsapp === "84998765432", "solicitação guarda o WhatsApp de quem entrou");

  await as("authenticated", ADMIN_ID, () => db.query(`update public.orders set status = 'canceled' where customer_whatsapp = '84998765432'`));
  const anonymized = (await as("authenticated", ADMIN_ID, () => db.query(`select public.anonymize_data_subject('84998765432') as data`))).rows[0].data;
  check(anonymized.anonymized_orders === 2 && anonymized.kept_orders === 0, "anonimização acha o titular pelo WhatsApp");
  check(
    await rejects(() => as("authenticated", ADMIN_ID, () => db.query(`select public.anonymize_data_subject('123')`)), /invalid_contact/),
    "anonimização recusa contato inválido",
  );

  await db.exec(`
    insert into public.orders (code, account_handle, account_name, account_platform, customer_name, customer_whatsapp, payment_method, total_cents, status, expires_at, created_at)
    values ('JD-SEMMAI', '@velha2', 'Velha', 'tiktok', 'Rita Antiga', '84955554444', 'pix', 1000, 'canceled', now() - interval '7 months', now() - interval '7 months');
  `);
  await as("authenticated", ADMIN_ID, () => db.query(`select public.apply_retention_policy()`));
  const retained = await db.query(`select customer_name from public.orders where code = 'JD-SEMMAI'`);
  check(retained.rows[0].customer_name === "Titular anonimizado", "retenção também anonimiza pedido antigo sem e-mail");
}

function placeWithInstallments(accountId, buyer, plan, firstPartCents, installments) {
  return as("anon", null, () =>
    db.query(
      `select public.place_order($1, 'Cliente Parcelado', null, $2, $3, null, null, null, null, $4, ${CONSENT}, 'instagram', null, $5, 120, $6) as data`,
      [accountId, buyer.whatsapp, buyer.document, plan, firstPartCents, installments],
    ),
  );
}

async function cardInstallmentChecks() {
  console.log("\nparcelas do cartão");
  const buyer = (n) => ({ whatsapp: `8494440000${n}`, document: cpfFrom(`7${n}${n}3332220`.slice(0, 9)) });

  const card = (await placeWithInstallments(await newAccount("parcela-6x"), buyer(1), "card", null, 6)).rows[0].data;
  check(card.payments.length === 1 && card.payments[0].requested_installments === 6, "cartão grava as parcelas escolhidas e a página do pedido mostra");
  check(
    await rejects(async () => placeWithInstallments(await newAccount("parcela-13x"), buyer(2), "card", null, 13), /invalid_installments/),
    "mais de 12 parcelas é recusado",
  );
  check(
    await rejects(async () => placeWithInstallments(await newAccount("parcela-zero"), buyer(3), "card", null, 0), /invalid_installments/),
    "zero parcelas é recusado",
  );
  check(
    await rejects(async () => placeWithInstallments(await newAccount("parcela-vazia"), buyer(4), "card", null, null), /invalid_installments/),
    "cartão sem parcelas é recusado na versão nova do checkout",
  );
  check(
    await rejects(async () => placeWithInstallments(await newAccount("parcela-pix"), buyer(5), "pix", null, 3), /invalid_installments/),
    "Pix com parcelas é recusado",
  );
  check(
    await rejects(async () => placeWithInstallments(await newAccount("parcela-dividido"), buyer(6), "two_cards", 15000, 3), /invalid_installments/),
    "pagamento dividido não recebe parcelas",
  );
  const legacy = (await placeWithPlan(await newAccount("parcela-site-antigo"), { email: null, ...buyer(7) }, "card", null)).rows[0].data;
  check(legacy.payments[0].requested_installments === null, "site antigo, sem o campo, continua fechando pedido no cartão");
}

async function accountMockupChecks() {
  console.log("\nmockup da conta");
  const accountId = await newAccount("mockup");
  const fresh = await as("anon", null, () => db.query(`select mockup from public.accounts where id = $1`, [accountId]));
  check(JSON.stringify(fresh.rows[0]?.mockup) === "{}", "conta nova nasce com o mockup vazio e a vitrine lê a coluna");
  const mockup = { bio: "Moda e achadinhos", coverUrl: null, posts: ["https://exemplo.com/1.webp"] };
  await as("authenticated", ADMIN_ID, () => db.query(`update public.accounts set mockup = $2 where id = $1`, [accountId, mockup]));
  const saved = await as("anon", null, () => db.query(`select mockup from public.accounts where id = $1`, [accountId]));
  check(saved.rows[0]?.mockup?.bio === "Moda e achadinhos", "administrador grava o mockup e a vitrine vê");
  check(
    await rejects(() => as("anon", null, () => db.query(`update public.accounts set mockup = '{}' where id = $1`, [accountId])), /permission denied/),
    "visitante não grava o mockup",
  );
  check(
    await rejects(() => db.query(`update public.accounts set mockup = '[]' where id = $1`, [accountId]), /check constraint/),
    "mockup fora do formato de objeto é recusado",
  );
}

async function c6PixChecks() {
  console.log("\nPix automático do C6");
  const buyer = (n) => ({ email: null, whatsapp: `1195557000${n}`, document: cpfFrom(`6${n}${n}888222`.slice(0, 9)) });
  const placed = (await placeWithPlan(await newAccount("pix-c6"), buyer(1), "pix", null)).rows[0].data;
  const part = placed.payments[0];
  const txid = part.id.replaceAll("-", "");
  const charge = (id, code) =>
    db.query(`update public.order_payments set provider = 'c6', pix_txid = $2, pix_copy_paste = $3 where id = $1`, [id, txid, code]);
  const confirm = (id, tx, cents) => db.query(`select public.confirm_c6_pix_payment($1, $2, 'E1234567820261030ABCDEF', $3) as ok`, [id, tx, cents]);

  await charge(part.id, "00020101021226...copia-e-cola");
  const pending = await as("anon", null, () => db.query(`select public.get_order($1) as data`, [placed.code]));
  check(pending.rows[0].data.payments[0].pix_code === "00020101021226...copia-e-cola", "página do pedido recebe o copia e cola do C6");
  check(!("pix_end_to_end_id" in pending.rows[0].data.payments[0]), "página pública não mostra o ID do Pix");
  check(
    await rejects(() => as("anon", null, () => db.query(`select public.confirm_c6_pix_payment($1, $2, 'E1', 37000)`, [part.id, txid])), /permission denied/),
    "visitante não confirma Pix",
  );
  check(
    await rejects(() => as("authenticated", STRANGER_ID, () => db.query(`select public.confirm_c6_pix_payment($1, $2, 'E1', 37000)`, [part.id, txid])), /permission denied/),
    "só a Edge Function confirma o Pix do C6",
  );
  check((await confirm(part.id, "outrotxid0000000000000000000000", 37000)).rows[0].ok === false, "Pix de outra cobrança não paga esta parte");
  check((await confirm(part.id, txid, 36999)).rows[0].ok === false, "Pix com valor menor não conta como pago");
  const paid = await confirm(part.id, txid, 37000);
  const repeated = await confirm(part.id, txid, 37000);
  check(paid.rows[0].ok && repeated.rows[0].ok, "Pix conferido no C6 é aceito e repetir o aviso não muda nada");
  const stored = await db.query(
    `select p.status, p.provider, p.pix_end_to_end_id, p.paid_amount_cents, p.paid_at is not null as stamped, o.status as order_status
     from public.order_payments p join public.orders o on o.id = p.order_id where p.id = $1`,
    [part.id],
  );
  const row = stored.rows[0];
  check(row.status === "paid" && row.provider === "c6" && row.stamped && row.paid_amount_cents === 37000, "parte fica paga via Pix C6 com data e valor");
  check(row.pix_end_to_end_id === "E1234567820261030ABCDEF", "ID do Pix fica gravado para o painel");
  check(row.order_status === "paid", "Pix pago fecha o pedido como pago");
  const after = await as("anon", null, () => db.query(`select public.get_order($1) as data`, [placed.code]));
  check(after.rows[0].data.payments[0].pix_code === null, "pago, o copia e cola sai da página do pedido");

  const card = (await placeWithPlan(await newAccount("pix-c6-cartao"), buyer(2), "card_pix", 15000)).rows[0].data;
  check((await confirm(card.payments[0].id, txid, 15000)).rows[0].ok === false, "confirmação de Pix não paga a parte do cartão");
  check(
    await rejects(() => db.query(`update public.order_payments set pix_txid = 'curto' where id = $1`, [card.payments[1].id]), /check constraint/),
    "txid fora do padrão do Bacen é recusado",
  );
}

async function emailVaultChecks() {
  console.log("\ne-mails das contas");
  const saved = await as("authenticated", ADMIN_ID, () =>
    db.query(
      `insert into public.email_accounts (email, password, used_for, recovery_phone)
       values ('conta.tiktok@gmail.com', ' S3nh@ com espaço ', 'TikTok @achadinhos', '11912345678') returning id, password`,
    ),
  );
  const emailId = saved.rows[0]?.id;
  check(Boolean(emailId) && saved.rows[0].password === null, "admin salva e-mail e a senha não fica aberta na tabela");
  const stored = await db.query(`select password_encrypted is not null as encrypted from public.email_accounts where id = $1`, [emailId]);
  check(stored.rows[0]?.encrypted === true, "senha fica gravada cifrada");
  const plain = () =>
    as("authenticated", ADMIN_ID, () =>
      db.query(`select e.password_plain as password, e.has_password from public.email_accounts e where id = $1`, [emailId]),
    );
  const opened = (await plain()).rows[0];
  check(opened?.password === " S3nh@ com espaço " && opened.has_password === true, "admin lê a senha exatamente como foi digitada");
  await as("authenticated", ADMIN_ID, () => db.query(`update public.email_accounts set notes = 'Nascimento 01/01/2000' where id = $1`, [emailId]));
  check((await plain()).rows[0]?.password === " S3nh@ com espaço ", "editar outro campo não apaga a senha");
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`insert into public.email_accounts (email) values ('CONTA.TIKTOK@gmail.com')`)),
      /duplicate key|unique/,
    ),
    "o mesmo e-mail não é salvo duas vezes, nem com maiúsculas",
  );
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`insert into public.email_accounts (email) values ('sem-arroba')`)),
      /check constraint/,
    ),
    "e-mail sem formato válido é recusado",
  );
  const strangerRows = await as("authenticated", STRANGER_ID, () => db.query(`select id from public.email_accounts`));
  check(strangerRows.rows.length === 0, "usuário que não é admin não enxerga os e-mails");
  const strangerPlain = await as("authenticated", STRANGER_ID, () =>
    db.query(`select public.password_plain(e) as password from public.email_accounts e where id = $1`, [emailId]),
  );
  check(strangerPlain.rows.length === 0 || strangerPlain.rows[0].password === null, "usuário que não é admin não abre a senha");
  check(
    await rejects(() => as("anon", null, () => db.query(`select id from public.email_accounts`)), /permission denied/),
    "visitante não acessa a tabela de e-mails",
  );
  await as("authenticated", ADMIN_ID, () => db.query(`update public.email_accounts set password = null where id = $1`, [emailId]));
  const cleared = (await plain()).rows[0];
  check(cleared?.password === null && cleared.has_password === false, "apagar a senha deixa o e-mail sem senha");
  await as("authenticated", ADMIN_ID, () => db.query(`delete from public.email_accounts where id = $1`, [emailId]));
  const audited = await db.query(`select count(*)::int as total from public.audit_events where action = 'delete' and entity = 'email_accounts'`);
  check(audited.rows[0].total === 1, "apagar um e-mail fica na auditoria");
}

const DEVELOPER_ID = "00000000-0000-0000-0000-00000000d003";
const DEVELOPER_SESSION = "00000000-0000-0000-0000-0000000005d3";

/** Suporte: os dois abrem e respondem; só a desenvolvedora muda a situação; ninguém escreve em nome do outro. */
async function supportChecks() {
  console.log("\nsuporte");
  await db.exec(`
    insert into auth.users (id, email) values ('${DEVELOPER_ID}', 'lay@exemplo.com');
    insert into public.admin_users (user_id, name, role) values ('${DEVELOPER_ID}', 'Layra', 'developer');
    insert into auth.sessions (id, user_id) values ('${DEVELOPER_SESSION}', '${DEVELOPER_ID}');
  `);
  const asDeveloper = (fn) => as("authenticated", DEVELOPER_ID, fn, { sessionId: DEVELOPER_SESSION });

  const opened = await as("authenticated", ADMIN_ID, () =>
    db.query(
      `insert into public.support_tickets (title, description, area, priority)
       values ('Botão de pagar', 'O botão de pagar não abre no iPhone.', 'site', 'urgent')
       returning id, status, created_by`,
    ),
  );
  const ticket = opened.rows[0];
  check(ticket?.status === "open" && ticket.created_by === ADMIN_ID, "Jota abre chamado, que nasce aberto e no nome dele");

  check(
    await rejects(
      () =>
        as("authenticated", ADMIN_ID, () =>
          db.query(
            `insert into public.support_tickets (title, description, area, created_by)
             values ('Em nome dela', 'Tentando abrir pela outra pessoa.', 'system', $1)`,
            [DEVELOPER_ID],
          ),
        ),
      /permission denied|row-level security/,
    ),
    "ninguém abre chamado em nome de outro usuário",
  );
  check(
    await rejects(
      () =>
        as("authenticated", ADMIN_ID, () =>
          db.query(`insert into public.support_tickets (title, description, area, status) values ('Já resolvido', 'Tentando abrir resolvido.', 'system', 'done')`),
        ),
      /permission denied|row-level security/,
    ),
    "chamado não nasce resolvido",
  );

  const jotaUpdate = await as("authenticated", ADMIN_ID, () =>
    db.query(`update public.support_tickets set status = 'done' where id = $1 returning id`, [ticket.id]),
  );
  check(jotaUpdate.rows.length === 0, "Jota não muda a situação do chamado");
  check(
    await rejects(
      () => asDeveloper(() => db.query(`update public.support_tickets set title = 'Outro título' where id = $1`, [ticket.id])),
      /permission denied/,
    ),
    "desenvolvedora não reescreve o pedido do Jota",
  );

  const resolved = await asDeveloper(() =>
    db.query(`update public.support_tickets set status = 'done' where id = $1 returning status, resolved_at`, [ticket.id]),
  );
  check(resolved.rows[0]?.status === "done" && resolved.rows[0].resolved_at !== null, "desenvolvedora resolve o chamado e a data fica gravada");
  const reopened = await asDeveloper(() =>
    db.query(`update public.support_tickets set status = 'in_progress' where id = $1 returning resolved_at`, [ticket.id]),
  );
  check(reopened.rows[0]?.resolved_at === null, "reabrir apaga a data de resolvido");

  const before = (await db.query(`select updated_at from public.support_tickets where id = $1`, [ticket.id])).rows[0].updated_at;
  const reply = await asDeveloper(() =>
    db.query(`insert into public.support_replies (ticket_id, body) values ($1, 'Vou olhar hoje.') returning author_id`, [ticket.id]),
  );
  check(reply.rows[0]?.author_id === DEVELOPER_ID, "resposta fica no nome de quem escreveu");
  const jotaReply = await as("authenticated", ADMIN_ID, () =>
    db.query(`insert into public.support_replies (ticket_id, body) values ($1, 'Obrigado!') returning id`, [ticket.id]),
  );
  check(jotaReply.rows.length === 1, "Jota responde no chamado");
  const after = (await db.query(`select updated_at from public.support_tickets where id = $1`, [ticket.id])).rows[0].updated_at;
  check(new Date(after).getTime() >= new Date(before).getTime(), "resposta nova sobe o chamado na lista");

  const thread = await as("authenticated", ADMIN_ID, () =>
    db.query(`select count(*)::int as total from public.support_replies where ticket_id = $1`, [ticket.id]),
  );
  check(thread.rows[0].total === 2, "os dois leem a conversa inteira");

  const strangerTickets = await as("authenticated", STRANGER_ID, () => db.query(`select id from public.support_tickets`));
  check(strangerTickets.rows.length === 0, "usuário que não é admin não vê chamados");
  check(
    await rejects(() => as("anon", null, () => db.query(`select id from public.support_tickets`)), /permission denied/),
    "visitante não acessa os chamados",
  );
  const jotaDelete = await as("authenticated", ADMIN_ID, () => db.query(`delete from public.support_tickets where id = $1 returning id`, [ticket.id]));
  check(jotaDelete.rows.length === 0, "Jota não apaga chamado");

  console.log("\nsuporte estilo GLPI");
  const glpi = await as("authenticated", ADMIN_ID, () =>
    db.query(
      `insert into public.support_tickets (title, description, kind, area, priority)
       values ('Melhorar a vitrine', 'Quero filtro por nicho na vitrine.', 'improvement', 'site', 'low') returning id, kind`,
    ),
  );
  const glpiId = glpi.rows[0].id;
  check(glpi.rows[0].kind === "improvement", "chamado guarda o tipo (melhoria)");
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`insert into public.support_tickets (title, description, kind, area) values ('Tipo errado', 'Tipo que não existe.', 'outro', 'site')`)),
      /check constraint/,
    ),
    "tipo fora da lista é recusado",
  );
  const waiting = await asDeveloper(() => db.query(`update public.support_tickets set status = 'waiting' where id = $1 returning status`, [glpiId]));
  check(waiting.rows[0]?.status === "waiting", "desenvolvedora deixa o chamado aguardando o Jota");
  await asDeveloper(() => db.query(`insert into public.support_replies (ticket_id, body) values ($1, 'Qual nicho primeiro?')`, [glpiId]));
  const stillWaiting = await db.query(`select status from public.support_tickets where id = $1`, [glpiId]);
  check(stillWaiting.rows[0].status === "waiting", "resposta dela não tira o chamado de aguardando");
  await as("authenticated", ADMIN_ID, () => db.query(`insert into public.support_replies (ticket_id, body) values ($1, 'Beleza primeiro.')`, [glpiId]));
  const reopenedByJota = await db.query(`select status from public.support_tickets where id = $1`, [glpiId]);
  check(reopenedByJota.rows[0].status === "open", "resposta do Jota devolve o chamado para pendente");

  const okAttachment = await as("authenticated", ADMIN_ID, () =>
    db.query(
      `insert into public.support_attachments (ticket_id, path, kind, name, content_type, size_bytes)
       values ($1::uuid, $1::text || '/print.png', 'image', 'print.png', 'image/png', 120000) returning created_by`,
      [glpiId],
    ),
  );
  check(okAttachment.rows[0]?.created_by === ADMIN_ID, "Jota anexa imagem no chamado, no nome dele");
  const badAttachment = (path, contentType) =>
    rejects(
      () =>
        as("authenticated", ADMIN_ID, () =>
          db.query(
            `insert into public.support_attachments (ticket_id, path, kind, name, content_type, size_bytes)
             values ($1, $2, 'image', 'arquivo', $3, 10)`,
            [glpiId, path, contentType],
          ),
        ),
      /check constraint/,
    );
  check(await badAttachment("outra-pasta/x.png", "image/png"), "anexo fora da pasta do chamado é recusado");
  check(await badAttachment(`${glpiId}/virus.exe`, "application/x-msdownload"), "arquivo que não é imagem nem vídeo é recusado");
  const otherReply = await db.query(`select id from public.support_replies where ticket_id <> $1 limit 1`, [glpiId]);
  check(
    await rejects(
      () =>
        as("authenticated", ADMIN_ID, () =>
          db.query(
            `insert into public.support_attachments (ticket_id, reply_id, path, kind, name, content_type, size_bytes)
             values ($1::uuid, $2, $1::text || '/a.png', 'image', 'a.png', 'image/png', 10)`,
            [glpiId, otherReply.rows[0].id],
          ),
        ),
      /row-level security/,
    ),
    "anexo não se prende a resposta de outro chamado",
  );
  const strangerFiles = await as("authenticated", STRANGER_ID, () => db.query(`select id from public.support_attachments`));
  check(strangerFiles.rows.length === 0, "usuário que não é admin não vê anexos");
  const bucket = await db.query(`select public, file_size_limit from storage.buckets where id = 'support'`);
  check(bucket.rows[0]?.public === false && Number(bucket.rows[0].file_size_limit) === 52428800, "bucket do suporte é privado, com limite de 50 MB");
  const uploaded = await as("authenticated", ADMIN_ID, () =>
    db.query(`insert into storage.objects (bucket_id, name) values ('support', $1::text || '/print.png') returning id`, [glpiId]),
  );
  check(uploaded.rows.length === 1, "admin sobe arquivo no bucket do suporte");
  check(
    await rejects(
      () => as("authenticated", STRANGER_ID, () => db.query(`insert into storage.objects (bucket_id, name) values ('support', 'x/y.png')`)),
      /row-level security/,
    ),
    "usuário que não é admin não sobe arquivo no suporte",
  );
  const strangerObjects = await as("authenticated", STRANGER_ID, () => db.query(`select id from storage.objects where bucket_id = 'support'`));
  check(strangerObjects.rows.length === 0, "usuário que não é admin não lê arquivos do suporte");

  console.log("\netiquetas e andamento do suporte");
  const label = await asDeveloper(() => db.query(`insert into public.support_labels (name, color) values ('Falta testar', 'amber') returning id`));
  const labelId = label.rows[0]?.id;
  check(Boolean(labelId), "desenvolvedora cria etiqueta");
  check(
    await rejects(() => as("authenticated", ADMIN_ID, () => db.query(`insert into public.support_labels (name, color) values ('Do Jota', 'pink')`)), /row-level security/),
    "Jota não cria etiqueta",
  );
  check(
    await rejects(() => asDeveloper(() => db.query(`insert into public.support_labels (name, color) values ('  falta TESTAR ', 'red')`)), /duplicate key|unique/),
    "nome repetido (sem diferenciar maiúsculas) é recusado",
  );
  check(
    await rejects(() => asDeveloper(() => db.query(`insert into public.support_labels (name, color) values ('Cor errada', 'orange')`)), /check constraint/),
    "cor fora da paleta é recusada",
  );
  const labeled = await asDeveloper(() => db.query(`update public.support_tickets set label_id = $1 where id = $2 returning label_id`, [labelId, glpiId]));
  check(labeled.rows[0]?.label_id === labelId, "desenvolvedora põe a etiqueta no chamado");
  const jotaLabel = await as("authenticated", ADMIN_ID, () => db.query(`update public.support_tickets set label_id = null where id = $1 returning id`, [glpiId]));
  check(jotaLabel.rows.length === 0, "Jota não troca a etiqueta");
  const jotaSeesLabel = await as("authenticated", ADMIN_ID, () => db.query(`select name from public.support_labels where id = $1`, [labelId]));
  check(jotaSeesLabel.rows[0]?.name === "Falta testar", "Jota vê as etiquetas");
  await asDeveloper(() => db.query(`delete from public.support_labels where id = $1`, [labelId]));
  const unlabeled = await db.query(`select label_id from public.support_tickets where id = $1`, [glpiId]);
  check(unlabeled.rows[0].label_id === null, "apagar a etiqueta deixa o chamado sem etiqueta");

  const historyBefore = (await db.query(`select count(*)::int as total from public.support_status_events where ticket_id = $1`, [glpiId])).rows[0].total;
  await asDeveloper(() => db.query(`update public.support_tickets set status = 'in_progress' where id = $1`, [glpiId]));
  await asDeveloper(() => db.query(`update public.support_tickets set status = 'waiting' where id = $1`, [glpiId]));
  await as("authenticated", ADMIN_ID, () => db.query(`insert into public.support_replies (ticket_id, body) values ($1, 'Respondido.')`, [glpiId]));
  const history = await as("authenticated", ADMIN_ID, () =>
    db.query(`select from_status, to_status, author_id from public.support_status_events where ticket_id = $1 order by created_at, id`, [glpiId]),
  );
  const recent = history.rows.slice(historyBefore);
  check(
    recent.length === 3 &&
      recent[0].to_status === "in_progress" &&
      recent[0].author_id === DEVELOPER_ID &&
      recent[2].from_status === "waiting" &&
      recent[2].to_status === "open" &&
      recent[2].author_id === null,
    "andamento registra cada troca, e a reabertura automática fica sem autor",
  );
  await asDeveloper(() => db.query(`update public.support_tickets set label_id = null where id = $1`, [glpiId]));
  const sameStatus = (await db.query(`select count(*)::int as total from public.support_status_events where ticket_id = $1`, [glpiId])).rows[0].total;
  check(sameStatus === historyBefore + 3, "mexer na etiqueta não cria troca de situação no andamento");
  check(
    await rejects(
      () => as("authenticated", ADMIN_ID, () => db.query(`insert into public.support_status_events (ticket_id, to_status) values ($1, 'done')`, [glpiId])),
      /permission denied/,
    ),
    "ninguém escreve no andamento pelo painel",
  );

  console.log("\napagar chamado e TI da desenvolvedora");
  const doomed = await as("authenticated", ADMIN_ID, () =>
    db.query(`insert into public.support_tickets (title, description, area) values ('Para apagar', 'Chamado que vai ser apagado.', 'site') returning id`),
  );
  const doomedId = doomed.rows[0].id;
  await asDeveloper(() => db.query(`insert into public.support_replies (ticket_id, body) values ($1, 'Resposta que vai junto.')`, [doomedId]));
  await asDeveloper(() => db.query(`update public.support_tickets set status = 'done' where id = $1`, [doomedId]));
  const deleted = await asDeveloper(() => db.query(`delete from public.support_tickets where id = $1 returning id`, [doomedId]));
  check(deleted.rows.length === 1, "desenvolvedora apaga chamado");
  const leftovers = await db.query(
    `select (select count(*) from public.support_replies where ticket_id = $1)::int as replies,
            (select count(*) from public.support_status_events where ticket_id = $1)::int as events`,
    [doomedId],
  );
  check(leftovers.rows[0].replies === 0 && leftovers.rows[0].events === 0, "respostas e andamento saem junto com o chamado");
  await db.query(`insert into storage.objects (bucket_id, name) values ('support', 'apagar/arquivo.png')`);
  const removedFile = await asDeveloper(() => db.query(`delete from storage.objects where bucket_id = 'support' and name = 'apagar/arquivo.png' returning id`));
  check(removedFile.rows.length === 1, "desenvolvedora apaga os arquivos do chamado no bucket");
  await db.query(`insert into storage.objects (bucket_id, name) values ('support', 'jota/arquivo.png')`);
  const jotaFile = await as("authenticated", ADMIN_ID, () => db.query(`delete from storage.objects where bucket_id = 'support' and name = 'jota/arquivo.png' returning id`));
  check(jotaFile.rows.length === 0, "Jota não apaga arquivos do suporte");

  const accesses = await asDeveloper(() => db.query(`select user_id, email, role, mfa_enabled, active_sessions from public.list_access_users()`));
  const jotaAccess = accesses.rows.find((row) => row.user_id === ADMIN_ID);
  check(accesses.rows.length >= 2 && jotaAccess?.email === "jota@exemplo.com" && jotaAccess.active_sessions >= 1, "TI vê os acessos com e-mail e sessões");
  check(
    await rejects(() => as("authenticated", ADMIN_ID, () => db.query(`select * from public.list_access_users()`)), /forbidden/),
    "Jota não abre a lista de acessos da TI",
  );
  check(
    await rejects(() => as("anon", null, () => db.query(`select * from public.list_access_users()`)), /permission denied/),
    "visitante não abre a lista de acessos",
  );
  check(
    await rejects(() => as("authenticated", ADMIN_ID, () => db.query(`select public.end_user_sessions($1)`, [DEVELOPER_ID])), /forbidden/),
    "Jota não encerra sessões de ninguém",
  );
  check(
    await rejects(() => asDeveloper(() => db.query(`select public.end_user_sessions($1)`, [STRANGER_ID])), /user_not_found/),
    "TI só encerra sessão de usuário do sistema",
  );
  await db.query(`insert into auth.sessions (id, user_id) values ('00000000-0000-0000-0000-0000000005a9', $1)`, [ADMIN_ID]);
  const ended = await asDeveloper(() => db.query(`select public.end_user_sessions($1) as total`, [ADMIN_ID]));
  const remaining = (await db.query(`select count(*)::int as total from auth.sessions where user_id = $1`, [ADMIN_ID])).rows[0].total;
  check(ended.rows[0].total >= 2 && remaining === 0, "TI encerra todas as sessões do Jota");
  check(
    !(await as("authenticated", ADMIN_ID, () => db.query(`select public.is_admin() as ok`))).rows[0].ok,
    "com as sessões encerradas, o Jota perde o acesso na hora",
  );
  await db.query(`insert into auth.sessions (id, user_id) values ($1, $2)`, [SESSION_OF[ADMIN_ID], ADMIN_ID]);
  check(
    await rejects(() => db.query(`update public.admin_users set whatsapp = '12ab' where user_id = $1`, [ADMIN_ID]), /check constraint/),
    "WhatsApp do usuário só com dígitos",
  );

  console.log("\nmodo visualização da desenvolvedora");
  const secretCustomer = await as("authenticated", ADMIN_ID, () =>
    db.query(`insert into public.customers (name, email, document) values ('Cliente Sigiloso', 'sigilo@exemplo.com', '52998224725') returning id`),
  );
  const customerId = secretCustomer.rows[0].id;
  const documentOf = (fn) => fn(() => db.query(`select c.document_plain as document from public.customers c where id = $1`, [customerId]));
  check((await documentOf((q) => as("authenticated", ADMIN_ID, q))).rows[0].document === "52998224725", "Jota continua lendo o CPF do cliente");
  const devCustomer = await documentOf(asDeveloper);
  check(devCustomer.rows.length === 1 && devCustomer.rows[0].document === null, "desenvolvedora vê o cliente, mas o CPF volta vazio");

  const devOrders = await asDeveloper(() => db.query(`select o.customer_document_plain as document from public.orders o where o.customer_document_encrypted is not null`));
  check(devOrders.rows.length > 0 && devOrders.rows.every((row) => row.document === null), "CPF dos pedidos volta vazio para a desenvolvedora");

  const vault = await as("authenticated", ADMIN_ID, () =>
    db.query(`insert into public.email_accounts (email, password) values ('sigilo.conta@gmail.com', 'S3nhaSecreta') returning id`),
  );
  const vaultId = vault.rows[0].id;
  const passwordOf = (fn) => fn(() => db.query(`select e.password_plain as password, e.has_password from public.email_accounts e where id = $1`, [vaultId]));
  check((await passwordOf((q) => as("authenticated", ADMIN_ID, q))).rows[0].password === "S3nhaSecreta", "Jota continua abrindo a senha do e-mail");
  const devVault = (await passwordOf(asDeveloper)).rows[0];
  check(devVault?.password === null && devVault.has_password === true, "desenvolvedora sabe que há senha, mas não a lê");
}

const HELPER_ID = "00000000-0000-0000-0000-00000000e004";
const HELPER_SESSION = "00000000-0000-0000-0000-0000000005e4";

/** Ajudante: só lê e escreve nas áreas que o admin liberou; o resto da loja fica fechado. */
async function helperChecks() {
  console.log("\najudantes e permissões");
  await db.exec(`
    insert into auth.users (id, email) values ('${HELPER_ID}', 'ajudante@exemplo.com');
    insert into public.admin_users (user_id, name, role, permissions) values ('${HELPER_ID}', 'Ajudante', 'helper', '{accounts,orders}');
    insert into auth.sessions (id, user_id) values ('${HELPER_SESSION}', '${HELPER_ID}');
  `);
  const asHelper = (fn) => as("authenticated", HELPER_ID, fn, { sessionId: HELPER_SESSION });
  const asAdmin = (fn) => as("authenticated", ADMIN_ID, fn);
  const count = async (fn, sql, params = []) => (await fn(() => db.query(sql, params))).rows.length;

  const flags = (
    await asHelper(() =>
      db.query(`select public.is_admin() as admin, public.is_staff() as staff, public.current_admin_role() as role,
                       public.has_permission('accounts') as accounts, public.has_permission('finance') as finance`),
    )
  ).rows[0];
  check(flags.staff === true && flags.admin === false && flags.role === "helper", "ajudante entra no sistema, mas não tem acesso completo");
  check(flags.accounts === true && flags.finance === false, "ajudante tem só as áreas liberadas");
  check((await count(asHelper, `select 1 from public.admin_users`)) === 1, "ajudante lê só a própria linha de usuário (o login precisa dela)");
  check(await rejects(() => asHelper(() => db.query(`select * from public.list_admin_users()`)), /forbidden/), "ajudante não vê a lista de usuários");

  // Contas: liberado
  const account = await asHelper(() =>
    db.query(
      `insert into public.accounts (slug, platform, display_name, handle, followers, price_cents, stats)
       values ('conta-do-ajudante', 'tiktok', 'Conta do Ajudante', '@ajudante', 2000, 40000, $1) returning id`,
      [tiktokStats],
    ),
  );
  check(account.rows.length === 1, "ajudante com Contas cadastra conta");
  const accountId = account.rows[0].id;
  const edited = await asHelper(() => db.query(`update public.accounts set price_cents = 42000 where id = $1 returning id`, [accountId]));
  check(edited.rows.length === 1, "ajudante com Contas edita conta");
  const photo = await asHelper(() => db.query(`insert into storage.objects (bucket_id, name) values ('media', 'accounts/ajudante.webp') returning id`));
  check(photo.rows.length === 1, "ajudante com Contas sobe foto da conta");

  // Pedidos: liberado (confirma Pix, entrega e lê a mensagem pronta)
  const placed = await as("anon", null, () =>
    db.query(
      `select public.place_order($1, 'Cliente do Ajudante', null, '84977770001', $2, null, null, null, null, 'pix', ${CONSENT}, 'instagram', null, null, 120) as data`,
      [accountId, cpfFrom("515151515")],
    ),
  );
  const order = placed.rows[0].data;
  check((await count(asHelper, `select 1 from public.orders where code = $1`, [order.code])) === 1, "ajudante com Pedidos vê o pedido");
  const paid = await asHelper(() =>
    db.query(`update public.order_payments set status = 'paid' where id = $1 and method = 'pix' returning id`, [order.payments[0].id]),
  );
  check(paid.rows.length === 1, "ajudante com Pedidos confirma o Pix");
  const delivered = await asHelper(() => db.query(`update public.orders set status = 'delivered' where code = $1 returning status`, [order.code]));
  check(delivered.rows[0]?.status === "delivered", "ajudante com Pedidos marca como entregue");
  const cpf = (await asHelper(() => db.query(`select o.customer_document_plain as document from public.orders o where code = $1`, [order.code]))).rows[0];
  check(cpf !== undefined && cpf.document === null, "CPF do cliente volta vazio para o ajudante");
  check((await count(asHelper, `select 1 from public.message_templates`)) > 0, "ajudante com Pedidos lê as mensagens prontas para mandar ao cliente");
  const templateEdit = await asHelper(() => db.query(`update public.message_templates set body = body returning 1`));
  check(templateEdit.rows.length === 0, "ajudante sem Automação não edita as mensagens prontas");

  // Fechado: financeiro, clientes, parceiros, CRM, cofre de e-mails, site, suporte, auditoria
  check((await count(asHelper, `select 1 from public.revenues`)) === 0, "ajudante sem Financeiro não vê receitas");
  check((await count(asHelper, `select 1 from public.expenses`)) === 0, "ajudante sem Financeiro não vê despesas");
  const expenseEdit = await asHelper(() => db.query(`update public.expenses set description = description returning 1`));
  check(expenseEdit.rows.length === 0, "ajudante sem Financeiro não mexe em despesa");
  check((await count(asHelper, `select 1 from public.customers`)) === 0, "ajudante sem Clientes não vê clientes");
  check((await count(asHelper, `select 1 from public.partners`)) === 0, "ajudante sem Parceiros não vê parceiros");
  check((await count(asHelper, `select 1 from public.leads`)) === 0, "ajudante sem CRM não vê leads");
  check((await count(asHelper, `select 1 from public.email_accounts`)) === 0, "ajudante sem E-mails não vê o cofre");
  check((await count(asHelper, `select 1 from public.support_tickets`)) === 0, "ajudante não vê o suporte");
  check((await count(asHelper, `select 1 from public.audit_events`)) === 0, "ajudante não vê a auditoria");
  check((await count(asHelper, `select 1 from public.data_requests`)) === 0, "ajudante não vê pedidos de LGPD");
  const siteEdit = await asHelper(() => db.query(`update public.store_settings set guarantee_days = guarantee_days returning 1`));
  check(siteEdit.rows.length === 0, "ajudante sem Site não muda as configurações da loja");
  check((await count(asHelper, `select 1 from public.notifications where kind not in ('order', 'payment')`)) === 0, "sininho do ajudante só mostra pedido novo e pagamento confirmado");
  await asHelper(() => db.query(`select public.update_my_profile('Ajudante Novo')`));
  const renamed = await db.query(`select name from public.admin_users where user_id = $1`, [HELPER_ID]);
  check(renamed.rows[0].name === "Ajudante Novo", "ajudante muda o próprio nome");

  // O admin libera e tira áreas
  check(
    await rejects(() => asHelper(() => db.query(`select public.set_admin_user_access($1, 'admin', '{}')`, [HELPER_ID])), /forbidden|self/),
    "ajudante não muda o próprio acesso",
  );
  await asAdmin(() => db.query(`select public.set_admin_user_access($1, 'helper', '{emails}')`, [HELPER_ID]));
  const vault = await asAdmin(() =>
    db.query(`insert into public.email_accounts (email, password) values ('cofre.ajudante@gmail.com', 'SenhaDoCofre1') returning id`),
  );
  const opened = (await asHelper(() => db.query(`select e.password_plain as password from public.email_accounts e where id = $1`, [vault.rows[0].id]))).rows[0];
  check(opened?.password === "SenhaDoCofre1", "liberado E-mails, o ajudante abre a senha do cofre");
  check((await count(asHelper, `select 1 from public.orders`)) === 0, "tirado Pedidos, o ajudante para de ver os pedidos na hora");
  const listed = (await asAdmin(() => db.query(`select role, permissions from public.list_admin_users() where user_id = $1`, [HELPER_ID]))).rows[0];
  check(listed?.role === "helper" && listed.permissions.join() === "emails", "lista de usuários mostra papel e áreas do ajudante");

  check(await rejects(() => asAdmin(() => db.query(`select public.set_admin_user_access($1, 'helper', '{}')`, [ADMIN_ID])), /self/), "admin não rebaixa a si mesmo");
  check(
    await rejects(() => asAdmin(() => db.query(`select public.set_admin_user_access($1, 'helper', '{}')`, [DEVELOPER_ID])), /forbidden/),
    "papel da desenvolvedora não muda por aqui",
  );
  check(
    await rejects(() => asAdmin(() => db.query(`select public.set_admin_user_access($1, 'helper', '{tudo}')`, [HELPER_ID])), /check constraint|violates/),
    "área que não existe é recusada",
  );
  check(
    await rejects(() => asAdmin(() => db.query(`select public.set_admin_user_access($1, 'developer', '{}')`, [HELPER_ID])), /invalid/),
    "ninguém vira desenvolvedora por aqui",
  );

  // Promover e rebaixar
  await asAdmin(() => db.query(`select public.set_admin_user_access($1, 'admin', '{orders}')`, [HELPER_ID]));
  const promoted = (await db.query(`select role, permissions from public.admin_users where user_id = $1`, [HELPER_ID])).rows[0];
  check(promoted.role === "admin" && promoted.permissions.length === 0, "virar admin dá acesso completo e limpa as áreas");
  check((await asHelper(() => db.query(`select public.is_admin() as ok`))).rows[0].ok === true, "admin promovido passa a ver tudo");
  await asHelper(() => db.query(`select public.set_admin_user_access($1, 'helper', '{}')`, [ADMIN_ID]));
  check((await db.query(`select role from public.admin_users where user_id = $1`, [ADMIN_ID])).rows[0].role === "helper", "com outro admin no sistema, um admin pode virar ajudante");
  // Volta ao começo (Jota admin, ajudante com Pedidos) e confere a trava do último admin.
  await db.query(`update public.admin_users set role = 'admin', permissions = '{}' where user_id = $1`, [ADMIN_ID]);
  await db.query(`update public.admin_users set role = 'helper', permissions = '{orders}' where user_id = $1`, [HELPER_ID]);
  const asDeveloper = (fn) => as("authenticated", DEVELOPER_ID, fn, { sessionId: DEVELOPER_SESSION });
  check(
    await rejects(() => asDeveloper(() => db.query(`select public.set_admin_user_access($1, 'helper', '{}')`, [ADMIN_ID])), /last/),
    "o último admin não pode virar ajudante",
  );

  console.log("\naviso de login e ficha do usuário");
  const developerLogins = `select 1 from public.notifications where title = 'Novo login no painel' and body like 'Layra entrou%'`;
  check((await count(asAdmin, developerLogins)) === 0, "Jota não vê no sininho quando a desenvolvedora entra");
  check((await count(asDeveloper, developerLogins)) > 0, "a desenvolvedora vê o aviso do próprio login");
  const helperLogin = `select 1 from public.notifications where title = 'Novo login no painel' and body like 'Ajudante%'`;
  check((await count(asAdmin, helperLogin)) > 0, "Jota vê quando um ajudante entra");
  check((await count(asDeveloper, helperLogin)) === 0, "login de ajudante não vai para a desenvolvedora");
  await db.query(`update public.admin_users set whatsapp = '84981225361' where user_id = $1`, [HELPER_ID]);
  const record = (await asAdmin(() => db.query(`select whatsapp from public.list_admin_users() where user_id = $1`, [HELPER_ID]))).rows[0];
  check(record?.whatsapp === "84981225361", "lista de usuários traz o WhatsApp para mandar o acesso");
  await db.query(`update public.admin_users set role = 'admin', permissions = '{}' where user_id = $1`, [ADMIN_ID]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function legalEditingChecks() {
  console.log("\ntermos e política editáveis");
  const asAdmin = (fn) => as("authenticated", ADMIN_ID, fn);
  const asHelper = (fn) => as("authenticated", HELPER_ID, fn, { sessionId: HELPER_SESSION });
  const current = async () =>
    Object.fromEntries((await as("anon", null, () => db.query(`select * from public.current_legal_documents()`))).rows.map((row) => [row.slug, row]));

  const before = await current();
  check(
    before.terms?.version === "1.1.0" && before.terms.content?.title && before.privacy?.content?.sections?.length > 0 && before.terms.controller?.brand,
    "o site lê a versão no ar com o texto e os dados da empresa",
  );

  const contentOf = (row) => ({ title: row.content.title, summary: row.content.summary, sections: row.content.sections });
  const documents = { terms: contentOf(before.terms), privacy: contentOf(before.privacy) };
  const publish = (fn, docs, controller, note = "Ajuste de texto") =>
    fn(() => db.query(`select public.publish_legal_documents($1, $2, $3) as count`, [docs, controller, note]));

  check(
    await rejects(() => publish(asHelper, documents, before.terms.controller), /forbidden/),
    "ajudante sem a área Site não publica os termos",
  );
  check(await rejects(() => publish((fn) => as("anon", null, fn), documents, before.terms.controller), /permission denied/), "visitante não publica");

  const unchanged = await publish(asAdmin, documents, before.terms.controller);
  check(unchanged.rows[0].count === 0, "publicar sem mudar nada não cria versão");

  const editedTerms = { ...documents.terms, title: "Termos de Uso da Jota" };
  const once = await publish(asAdmin, { ...documents, terms: editedTerms }, before.terms.controller, "Título novo");
  const afterTerms = await current();
  check(once.rows[0].count === 1, "só o documento que mudou ganha versão nova");
  check(afterTerms.terms.version === "1.2.0" && afterTerms.privacy.version === "1.1.0", "termos vão para 1.2.0 e a política fica na 1.1.0");
  check(
    afterTerms.terms.content.history[0]?.summary === "Título novo" && afterTerms.terms.content.history.length === before.terms.content.history.length + 1,
    "a mudança entra no topo do histórico de versões",
  );
  const stillCurrent = await db.query(`select public.is_current_legal_document('terms', '1.2.0', $1) as ok, public.is_current_legal_document('terms', '1.1.0', $2) as old`, [
    afterTerms.terms.sha256,
    before.terms.sha256,
  ]);
  check(stillCurrent.rows[0].ok === true && stillCurrent.rows[0].old === false, "o checkout passa a aceitar só a versão nova");

  const controller = { ...before.terms.controller, legalName: "  Jota Digitais LTDA  ", document: "" };
  const both = await publish(asAdmin, { ...documents, terms: editedTerms }, controller, "Dados da empresa");
  const afterController = await current();
  check(both.rows[0].count === 2 && afterController.terms.version === "1.3.0" && afterController.privacy.version === "1.2.0", "dados da empresa mudam os dois documentos");
  check(afterController.privacy.controller.legalName === "Jota Digitais LTDA" && afterController.privacy.controller.document === null, "dados da empresa saem limpos (vazio vira a preencher)");

  const broken = { ...documents, privacy: { ...documents.privacy, sections: [] } };
  check(await rejects(() => publish(asAdmin, broken, controller), /invalid_legal_document/), "documento sem seção é recusado");
  const badBlock = { ...documents, privacy: { ...documents.privacy, sections: [{ id: "x", title: "X", blocks: [{ type: "script", text: "oi" }] }] } };
  check(await rejects(() => publish(asAdmin, badBlock, controller), /invalid_legal_document/), "bloco desconhecido é recusado");
  check(await rejects(() => publish(asAdmin, documents, controller, "x"), /invalid_legal_document/), "precisa dizer o que mudou");
}

async function supportForwardChecks() {
  console.log("\nchamado encaminhado avisa o Jota");
  const asDeveloper = (fn) => as("authenticated", DEVELOPER_ID, fn, { sessionId: DEVELOPER_SESSION });
  const asAdmin = (fn) => as("authenticated", ADMIN_ID, fn);
  const created = await asDeveloper(() =>
    db.query(`insert into public.support_tickets (title, description, area) values ('Revisar banner', 'Preciso que você aprove o banner.', 'site') returning id`),
  );
  const id = created.rows[0].id;
  const notices = async () =>
    (await db.query(`select title from public.notifications where kind = 'support' and link = $1 and recipient_role = 'admin'`, [`/admin/suporte/${id}`])).rows;

  await asDeveloper(() => db.query(`update public.support_tickets set status = 'waiting' where id = $1`, [id]));
  const after = await notices();
  check(after.length === 1 && after[0].title.startsWith("Layra encaminhou para você"), "encaminhar para o Jota avisa no sininho dele");

  const jotaSees = await asAdmin(() => db.query(`select 1 from public.notifications where link = $1`, [`/admin/suporte/${id}`]));
  check(jotaSees.rows.length === 1, "o Jota lê o aviso do encaminhamento");

  await asDeveloper(() => db.query(`update public.support_tickets set status = 'in_progress' where id = $1`, [id]));
  await asDeveloper(() => db.query(`update public.support_tickets set status = 'waiting' where id = $1`, [id]));
  check((await notices()).length === 1, "encaminhar de novo logo em seguida não repete o aviso");

  const internal = await asDeveloper(() =>
    db.query(`insert into public.support_tickets (title, description, area, internal) values ('Nota interna', 'Anotação só minha sobre o sistema.', 'system', true) returning id`),
  );
  await asDeveloper(() => db.query(`update public.support_tickets set status = 'waiting' where id = $1`, [internal.rows[0].id]));
  const internalNotices = await db.query(`select 1 from public.notifications where link = $1`, [`/admin/suporte/${internal.rows[0].id}`]);
  check(internalNotices.rows.length === 0, "chamado interno não avisa");

  const preview = await asDeveloper(() => db.query(`select title from public.list_admin_notifications(30, 50)`));
  check(preview.rows.some((row) => row.title.startsWith("Layra encaminhou")), "no Ver como o Jota, a desenvolvedora vê o sininho dele");
  check(await rejects(() => asAdmin(() => db.query(`select * from public.list_admin_notifications(30, 50)`)), /forbidden/), "só a desenvolvedora usa a leitura do sininho do Jota");
}

async function supportPriorityChecks() {
  console.log("\nprioridade do chamado");
  const asDeveloper = (fn) => as("authenticated", DEVELOPER_ID, fn, { sessionId: DEVELOPER_SESSION });
  const asAdmin = (fn) => as("authenticated", ADMIN_ID, fn);
  const asHelper = (fn) => as("authenticated", HELPER_ID, fn, { sessionId: HELPER_SESSION });
  const created = await asDeveloper(() =>
    db.query(`insert into public.support_tickets (title, description, area, priority) values ('Trocar prioridade', 'Chamado para trocar a prioridade.', 'site', 'low') returning id`),
  );
  const id = created.rows[0].id;
  const priority = async () => (await db.query(`select priority from public.support_tickets where id = $1`, [id])).rows[0].priority;
  const setPriority = (fn, value) => fn(() => db.query(`select public.set_support_ticket_priority($1, $2)`, [id, value]));

  await setPriority(asAdmin, "urgent");
  check((await priority()) === "urgent", "Jota muda a prioridade de um chamado que a Lay abriu");
  await setPriority(asDeveloper, "normal");
  check((await priority()) === "normal", "a Lay também muda a prioridade");
  check(await rejects(() => setPriority(asAdmin, "altissima"), /invalid_priority/), "prioridade desconhecida é recusada");
  check(await rejects(() => setPriority(asHelper, "urgent"), /forbidden/), "ajudante não muda prioridade");
  check(await rejects(() => asAdmin(() => db.query(`update public.support_tickets set priority = 'low' where id = $1`, [id])), /permission denied/), "ninguém muda a prioridade direto na tabela");

  await asDeveloper(() => db.query(`update public.support_tickets set status = 'done' where id = $1`, [id]));
  check(await rejects(() => setPriority(asAdmin, "urgent"), /forbidden/), "chamado finalizado não muda mais de prioridade");
}

/** Chama a versão de 20 argumentos pelos nomes, como o site faz pelo PostgREST. */
function placeWithCoupon(accountId, buyer, plan, firstPartCents, couponCode) {
  const [termsVersion, termsSha, privacyVersion, privacySha] = CONSENT.split(", ").map((value) => value.slice(1, -1));
  return as("anon", null, () =>
    db.query(
      `select public.place_order(p_account_id => $1, p_name => 'Cliente Cupom', p_email => $2, p_whatsapp => $3, p_document => $4,
         p_birth_date => null, p_instagram => null, p_city => null, p_state => null, p_payment_method => $5::public.payment_method,
         p_terms_version => $8, p_terms_sha256 => $9, p_privacy_version => $10, p_privacy_sha256 => $11,
         p_source => 'instagram', p_referred_by => null, p_first_part_cents => $6::integer, p_hold_minutes => 120,
         p_installments => null::integer, p_coupon_code => $7::text) as data`,
      [accountId, buyer.email, buyer.whatsapp, buyer.document, plan, firstPartCents, couponCode, termsVersion, termsSha, privacyVersion, privacySha],
    ),
  );
}

const previewCoupon = (code, accountId, ip) =>
  as("anon", null, () => db.query(`select public.preview_coupon($1, $2) as data`, [code, accountId]), { ip }).then((r) => r.rows[0].data);

async function couponChecks() {
  console.log("\ncupons");
  const buyer = (n) => ({ email: `cupom${n}@exemplo.com`, whatsapp: `1195557000${n}`, document: cpfFrom(`5${n}${n}888222`.slice(0, 9)) });
  const createCoupon = (sql) => as("authenticated", ADMIN_ID, () => db.query(sql));

  await createCoupon(`insert into public.coupons (code, kind, value) values ('DEZ', 'percent', 10)`);
  await createCoupon(`insert into public.coupons (code, kind, value, max_uses) values ('CINQUENTA', 'fixed', 5000, 1)`);
  await createCoupon(`insert into public.coupons (code, kind, value, ends_at) values ('VENCIDO', 'percent', 20, now() - interval '1 day')`);
  await createCoupon(`insert into public.coupons (code, kind, value, active) values ('PAUSADO', 'percent', 20, false)`);
  await createCoupon(`insert into public.coupons (code, kind, value) values ('GIGANTE', 'fixed', 9999900)`);
  check((await db.query(`select count(*)::int as n from public.coupons`)).rows[0].n === 5, "admin cria cupons");

  check(
    await rejects(() => as("anon", null, () => db.query(`select * from public.coupons`)), /permission denied/),
    "visitante não lista os cupons",
  );
  check(
    await rejects(() => as("anon", null, () => db.query(`insert into public.coupons (code, kind, value) values ('HACK', 'percent', 90)`)), /permission denied/),
    "visitante não cria cupom",
  );
  const strangerSees = await as("authenticated", STRANGER_ID, () => db.query(`select count(*)::int as n from public.coupons`));
  check(strangerSees.rows[0].n === 0, "usuário logado de fora do painel não vê cupom");
  check(
    await rejects(() => createCoupon(`insert into public.coupons (code, kind, value) values ('TUDO', 'percent', 100)`), /check/),
    "desconto de 100% é recusado",
  );
  check(
    await rejects(() => createCoupon(`insert into public.coupons (code, kind, value) values ('dez minúsculo', 'percent', 10)`), /check/),
    "código fora do padrão (minúscula, espaço) é recusado",
  );

  const account = await newAccount("cupom-previa");
  const preview = await previewCoupon(" dez ", account, "10.0.0.1");
  check(preview.code === "DEZ" && preview.discount_cents === 3700 && preview.total_cents === 33300, "prévia: 10% de R$ 370 = R$ 37 de desconto");
  check((await previewCoupon("NAOEXISTE", account, "10.0.0.1")).error === "coupon_not_found", "prévia de cupom inexistente avisa o erro");
  check((await previewCoupon("VENCIDO", account, "10.0.0.1")).error === "coupon_expired", "cupom vencido é recusado");
  check((await previewCoupon("PAUSADO", account, "10.0.0.1")).error === "coupon_inactive", "cupom desativado é recusado");
  const huge = await previewCoupon("GIGANTE", account, "10.0.0.1");
  check(huge.total_cents === 500, "desconto maior que o preço para em R$ 5,00 de total");

  for (let i = 0; i < 20; i += 1) await previewCoupon(`TESTE${i}`, account, "10.0.0.9");
  check((await previewCoupon("DEZ", account, "10.0.0.9")).error === "too_many_attempts", "prévia limita tentativas por visitante (erros contam)");

  const placed = (await placeWithCoupon(await newAccount("cupom-pix"), buyer(1), "pix", null, "dez")).rows[0].data;
  check(
    placed.total_cents === 33300 && placed.discount_cents === 3700 && placed.coupon_code === "DEZ" && placed.payments[0].amount_cents === 33300,
    "pedido com cupom grava o desconto e cobra o total com desconto",
  );

  const split = (await placeWithCoupon(await newAccount("cupom-dividido"), buyer(2), "card_pix", 13300, "DEZ")).rows[0].data;
  check(
    split.payments[0].amount_cents === 13300 && split.payments[1].amount_cents === 20000,
    "pagamento dividido usa o total com desconto",
  );

  const first = (await placeWithCoupon(await newAccount("cupom-limite-1"), buyer(3), "pix", null, "CINQUENTA")).rows[0].data;
  check(first.total_cents === 32000, "cupom de R$ 50 tira R$ 50");
  check(
    await rejects(async () => placeWithCoupon(await newAccount("cupom-limite-2"), buyer(4), "pix", null, "CINQUENTA"), /coupon_exhausted/),
    "cupom de uso único não vale no segundo pedido",
  );
  await db.query(`update public.orders set status = 'canceled' where code = $1`, [first.code]);
  const again = (await placeWithCoupon(await newAccount("cupom-limite-3"), buyer(5), "pix", null, "CINQUENTA")).rows[0].data;
  check(again.total_cents === 32000, "pedido cancelado devolve o uso do cupom");

  check(
    await rejects(async () => placeWithCoupon(await newAccount("cupom-errado"), buyer(6), "pix", null, "INVENTADO"), /coupon_not_found/),
    "pedido com cupom inexistente é recusado (não sai sem o desconto que a pessoa esperava)",
  );

  const uses = await as("authenticated", ADMIN_ID, () => db.query(`select c.code, c.coupon_uses as uses from public.coupons c where code in ('DEZ', 'CINQUENTA') order by code`));
  check(uses.rows[0].uses === 1 && uses.rows[1].uses === 2, "painel vê quantas vezes cada cupom foi usado");

  const plain = (await placeWithCoupon(await newAccount("cupom-sem"), buyer(7), "pix", null, null)).rows[0].data;
  check(plain.total_cents === 37000 && plain.discount_cents === 0 && plain.coupon_code === null, "sem cupom, o pedido segue com o preço cheio");
}

/** Checkout do carrinho pelos nomes, como o site faz pelo PostgREST. Cada chamada com um IP próprio, como na vida real. */
function placeCart(accountIds, buyer, plan, { firstPartCents = null, couponCode = null, ip = "10.1.0.1" } = {}) {
  const [termsVersion, termsSha, privacyVersion, privacySha] = CONSENT.split(", ").map((value) => value.slice(1, -1));
  return as(
    "anon",
    null,
    () =>
      db.query(
        `select public.place_cart_order(p_account_ids => $1::uuid[], p_name => 'Cliente Carrinho', p_whatsapp => $2, p_document => $3,
           p_payment_method => $4::public.payment_method, p_terms_version => $7, p_terms_sha256 => $8, p_privacy_version => $9,
           p_privacy_sha256 => $10, p_source => 'instagram', p_referred_by => null, p_first_part_cents => $5::integer,
           p_installments => null::integer, p_coupon_code => $6::text) as data`,
        [accountIds, buyer.whatsapp, buyer.document, plan, firstPartCents, couponCode, termsVersion, termsSha, privacyVersion, privacySha],
      ),
    { ip },
  ).then((result) => result.rows[0].data);
}

async function cartAccounts(prefix, prices) {
  const ids = [];
  for (const [index, price] of prices.entries()) {
    const id = await newAccount(`${prefix}-${index}`);
    await db.query(`update public.accounts set price_cents = $2 where id = $1`, [id, price]);
    ids.push(id);
  }
  return ids;
}

const cartOrders = (cartCode) =>
  db.query(
    `select o.code, o.status, o.total_cents, o.discount_cents, o.coupon_id is not null as counts_coupon, a.status as account_status
     from public.orders o join public.accounts a on a.id = o.account_id where o.cart_code = $1 order by o.code = $1 desc, o.code`,
    [cartCode],
  ).then((result) => result.rows);

async function cartChecks() {
  console.log("\ncarrinho");
  const buyer = (n) => ({ whatsapp: `1195558000${n}`, document: cpfFrom(`6${n}${n}444555`.slice(0, 9)) });

  const ids = await cartAccounts("carrinho-pix", [10000, 30000, 20000]);
  const lead = await placeCart(ids, buyer(1), "pix", { ip: "10.1.0.1" });
  check(lead.cart_code === lead.code && lead.account_id === ids[1], "o pedido principal é o da conta mais cara");
  check(lead.cart_items.length === 3 && lead.cart_items[0].code === lead.code, "página do pedido lista as 3 contas do carrinho");
  check(lead.payments.length === 1 && lead.payments[0].amount_cents === 60000, "uma cobrança só, com a soma das contas");
  const orders = await cartOrders(lead.code);
  check(orders.length === 3 && orders.every((order) => order.account_status === "reserved"), "cada conta vira um pedido e fica reservada");
  const consents = await db.query(
    `select count(*)::int as n from public.consent_records r join public.orders o on o.id = r.order_id where o.cart_code = $1`,
    [lead.code],
  );
  check(consents.rows[0].n === 2, "aceite dos termos gravado uma vez, no pedido principal");

  await as("authenticated", ADMIN_ID, () => db.query(`update public.order_payments set status = 'paid' where id = $1`, [lead.payments[0].id]));
  const paid = await cartOrders(lead.code);
  check(paid.every((order) => order.status === "paid"), "Pix pago fecha o carrinho inteiro como pago");
  const sibling = await as("anon", null, () => db.query(`select public.get_order($1) as data`, [paid[1].code]), { ip: "10.1.0.50" });
  const siblingData = sibling.rows[0].data;
  check(siblingData.cart_code === lead.code && siblingData.cart_items.length === 0, "pedido de dentro do carrinho aponta para o principal");

  const couponIds = await cartAccounts("carrinho-cupom", [10000, 20000, 33333]);
  const preview = await as("anon", null, () => db.query(`select public.preview_cart_coupon('DEZ', $1::uuid[]) as data`, [couponIds]), { ip: "10.1.0.2" });
  check(preview.rows[0].data.discount_cents === 6333 && preview.rows[0].data.total_cents === 57000, "prévia do cupom vale sobre a soma do carrinho");
  const usesBefore = (await db.query(`select public.coupon_uses(c) as n from public.coupons c where code = 'DEZ'`)).rows[0].n;
  const withCoupon = await placeCart(couponIds, buyer(2), "card_pix", { couponCode: "dez", firstPartCents: 27000, ip: "10.1.0.2" });
  const couponOrders = await cartOrders(withCoupon.code);
  const discountSum = couponOrders.reduce((sum, order) => sum + order.discount_cents, 0);
  const totalSum = couponOrders.reduce((sum, order) => sum + order.total_cents, 0);
  check(discountSum === 6333 && totalSum === 57000, "desconto repartido entre as contas fecha com o desconto do cupom");
  check(couponOrders.every((order) => order.total_cents > 0 && order.discount_cents > 0), "cada conta leva sua parte do desconto");
  check(
    withCoupon.payments[0].amount_cents === 27000 && withCoupon.payments[1].amount_cents === 30000,
    "pagamento dividido usa o total do carrinho com desconto",
  );
  const usesAfter = (await db.query(`select public.coupon_uses(c) as n from public.coupons c where code = 'DEZ'`)).rows[0].n;
  check(usesAfter === usesBefore + 1, "cupom conta um uso por carrinho, não por conta");

  const cancelIds = await cartAccounts("carrinho-cancela", [15000, 15000]);
  const toCancel = await placeCart(cancelIds, buyer(3), "pix", { ip: "10.1.0.3" });
  await as("authenticated", ADMIN_ID, () => db.query(`update public.orders set status = 'canceled' where code = $1`, [toCancel.code]));
  const canceled = await cartOrders(toCancel.code);
  check(
    canceled.every((order) => order.status === "canceled" && order.account_status === "available"),
    "cancelar o principal cancela o carrinho e libera as contas",
  );

  const [free, taken] = await cartAccounts("carrinho-ocupado", [12000, 12000]);
  await db.query(`update public.accounts set status = 'sold' where id = $1`, [taken]);
  check(await rejects(() => placeCart([free, taken], buyer(4), "pix", { ip: "10.1.0.4" }), /account_unavailable/), "conta vendida no carrinho barra o pedido");
  const untouched = await db.query(`select status from public.accounts where id = $1`, [free]);
  check(untouched.rows[0].status === "available", "nenhuma conta fica reservada quando o carrinho falha");

  check(await rejects(() => placeCart([free, free], buyer(4), "pix", { ip: "10.1.0.4" }), /invalid_cart/), "conta repetida no carrinho é recusada");
  check(await rejects(() => placeCart([free], buyer(4), "pix", { ip: "10.1.0.4" }), /invalid_cart/), "carrinho de uma conta só vai pelo checkout normal");

  const single = await placeWithCoupon(await newAccount("carrinho-limite-solo"), { email: null, ...buyer(5) }, "pix", null, null);
  check(Boolean(single.rows[0].data.code), "cliente com um pedido aberto");
  const firstCart = await placeCart(await cartAccounts("carrinho-limite-a", [9000, 9000, 9000]), buyer(5), "pix", { ip: "10.1.0.5" });
  check(firstCart.cart_items.length === 3, "carrinho de 3 contas conta como um pedido em aberto");
  check(
    await rejects(async () => placeCart(await cartAccounts("carrinho-limite-b", [9000, 9000]), buyer(5), "pix", { ip: "10.1.0.6" }), /too_many_open_orders/),
    "terceiro pedido em aberto do mesmo cliente é recusado",
  );
}

async function accountCountryChecks() {
  console.log("\npaís da conta");
  const id = await newAccount("pais-padrao");
  const fallback = await as("anon", null, () => db.query(`select country from public.accounts where id = $1`, [id]));
  check(fallback.rows[0]?.country === "BR", "conta sem país escolhido vale como Brasil e o visitante lê o país");
  await as("authenticated", ADMIN_ID, () => db.query(`update public.accounts set country = 'US' where id = $1`, [id]));
  check((await db.query(`select country from public.accounts where id = $1`, [id])).rows[0].country === "US", "admin troca o país da conta");
  check(
    await rejects(() => as("authenticated", ADMIN_ID, () => db.query(`update public.accounts set country = 'XX' where id = $1`, [id])), /accounts_country/),
    "país fora da lista é recusado",
  );

  const visible = await as("anon", null, () => db.query(`select code, name from public.countries`));
  check(visible.rows.length === 20 && visible.rows.some((row) => row.name === "Reino Unido"), "visitante lê os 20 países de fábrica (filtro do site)");
  check(
    await rejects(() => as("anon", null, () => db.query(`insert into public.countries (code, name) values ('HACK', 'Hack')`)), /permission denied/),
    "visitante não cria país",
  );
  const strangerInsert = rejects(
    () => as("authenticated", STRANGER_ID, () => db.query(`insert into public.countries (code, name) values ('ESTRANHO', 'Estranho')`)),
    /row-level security/,
  );
  check(await strangerInsert, "usuário de fora do painel não cria país");
  await as("authenticated", ADMIN_ID, () => db.query(`insert into public.countries (code, name) values ('NOVA-ZELANDIA', 'Nova Zelândia')`));
  await as("authenticated", ADMIN_ID, () => db.query(`update public.accounts set country = 'NOVA-ZELANDIA' where id = $1`, [id]));
  const embedded = await as("anon", null, () =>
    db.query(`select c.name from public.accounts a join public.countries c on c.code = a.country where a.id = $1`, [id]),
  );
  check(embedded.rows[0]?.name === "Nova Zelândia", "admin cria país na ficha e a conta já usa ele");
  check(
    await rejects(() => as("authenticated", ADMIN_ID, () => db.query(`insert into public.countries (code, name) values ('NZ2', 'nova zelândia')`)), /countries_name_key/),
    "país repetido (mesmo nome, outra caixa) é recusado",
  );
  check(
    await rejects(() => as("authenticated", ADMIN_ID, () => db.query(`delete from public.countries where code = 'NOVA-ZELANDIA'`)), /permission denied/),
    "país não é apagado pelo painel",
  );

  console.log("\nficha técnica da conta");
  const sheet = JSON.stringify([{ label: "Seguidores", value: "1.259" }, { label: "Garantia", value: "7 dias" }]);
  const fresh = await as("anon", null, () => db.query(`select specs from public.accounts where id = $1`, [id]));
  check(fresh.rows[0] && fresh.rows[0].specs === null, "conta nova nasce com a ficha automática e o visitante lê a coluna");
  await as("authenticated", ADMIN_ID, () => db.query(`update public.accounts set specs = $2::jsonb where id = $1`, [id, sheet]));
  const written = await as("anon", null, () => db.query(`select specs from public.accounts where id = $1`, [id]));
  check(written.rows[0]?.specs?.[1]?.value === "7 dias", "admin grava a ficha da conta e a vitrine lê");
  check(
    await rejects(() => as("authenticated", ADMIN_ID, () => db.query(`update public.accounts set specs = '[]'::jsonb where id = $1`, [id])), /accounts_specs/),
    "ficha vazia é recusada (vazia = voltar à automática)",
  );
  check(
    await rejects(() => as("authenticated", ADMIN_ID, () => db.query(`update public.accounts set specs = '{"a":1}'::jsonb where id = $1`, [id])), /accounts_specs/),
    "ficha fora do formato de lista é recusada",
  );
  await as("authenticated", ADMIN_ID, () => db.query(`update public.accounts set specs = null where id = $1`, [id]));
  check((await db.query(`select specs from public.accounts where id = $1`, [id])).rows[0].specs === null, "voltar à automática apaga a ficha escrita");
}

async function partnerTagChecks() {
  console.log("\napelidos do parceiro");
  const created = await as("authenticated", ADMIN_ID, () =>
    db.query(`insert into public.partners (name, commission_percent, tags) values ('Gimena Souza', 10, array['gi', 'gih']) returning id, tags`),
  );
  check(created.rows[0]?.tags?.join(",") === "gi,gih", "admin cadastra os apelidos do parceiro");
  const fresh = await as("authenticated", ADMIN_ID, () => db.query(`insert into public.partners (name, commission_percent) values ('Sem Apelido', 10) returning tags`));
  check(Array.isArray(fresh.rows[0]?.tags) && fresh.rows[0].tags.length === 0, "parceiro sem apelido nasce com a lista vazia");
  const tooMany = `array[${Array.from({ length: 11 }, (_, i) => `'t${i}'`).join(", ")}]`;
  check(
    await rejects(() => as("authenticated", ADMIN_ID, () => db.query(`update public.partners set tags = ${tooMany} where id = $1`, [created.rows[0].id])), /partners_tags/),
    "mais de 10 apelidos é recusado",
  );
  check(
    await rejects(() => as("anon", null, () => db.query(`select tags from public.partners`)), /permission denied/),
    "visitante não vê os apelidos dos parceiros",
  );
}

async function webPushChecks() {
  console.log("\npush no celular");
  const asAdmin = (fn) => as("authenticated", ADMIN_ID, fn);
  const endpoint = "https://fcm.googleapis.com/fcm/send/aparelho-do-jota";
  const requestsCount = async () => (await db.query(`select count(*)::int as n from net.requests`)).rows[0].n;

  await asAdmin(() => db.query(`select public.save_push_subscription($1, 'chave', 'segredo', 'Android')`, [endpoint]));
  const own = await asAdmin(() => db.query(`select endpoint, device from public.push_subscriptions`));
  check(own.rows.length === 1 && own.rows[0].device === "Android", "admin liga o aviso no aparelho e vê a inscrição");
  check(
    await rejects(() => as("authenticated", STRANGER_ID, () => db.query(`select public.save_push_subscription('https://x.example/a', 'k', 'a')`)), /forbidden/),
    "quem não é do sistema não inscreve aparelho",
  );
  check(
    await rejects(() => asAdmin(() => db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://x.example/b', 'k', 'a')`, [ADMIN_ID])), /permission denied/),
    "inscrição só entra pela função",
  );
  check(
    await rejects(() => asAdmin(() => db.query(`select public.save_push_subscription('http://inseguro.example/a', 'k', 'a')`)), /push_subscriptions_endpoint/),
    "endereço sem https é recusado",
  );

  await asAdmin(() => db.query(`insert into public.push_preferences (kinds) values (array['order', 'payment'])`));
  check(
    await rejects(() => asAdmin(() => db.query(`update public.push_preferences set kinds = array['spam']`)), /push_preferences_kinds/),
    "tipo de aviso desconhecido é recusado",
  );

  const before = await requestsCount();
  await db.query(`insert into public.notifications (kind, title) values ('news', 'Sem segredo no Vault')`);
  check((await requestsCount()) === before, "sem os segredos no Vault nenhum envio sai");

  await db.query(`select vault.create_secret('https://exemplo.supabase.co/functions/v1/push-send', 'push_send_url')`);
  await db.query(`select vault.create_secret('segredo-de-teste', 'push_send_secret')`);
  await db.exec(`
    insert into public.orders (code, account_handle, account_name, account_platform, customer_name, customer_email, payment_method, total_cents, status, expires_at)
    values ('JD-PUSH01', '@pago.sozinho', 'Pago', 'tiktok', 'Carla Push', 'carla@exemplo.com', 'pix', 25000, 'awaiting_payment', now() + interval '1 hour'),
           ('JD-PUSH02', '@pago.na.mao', 'Na mão', 'tiktok', 'Davi Push', 'davi@exemplo.com', 'pix', 9900, 'awaiting_payment', now() + interval '1 hour');
  `);
  const queued = await db.query(`select url, body, headers from net.requests order by id desc limit 1`);
  check(
    queued.rows[0]?.url.endsWith("/push-send") && queued.rows[0]?.headers["x-push-secret"] === "segredo-de-teste" && queued.rows[0]?.body.notification_id,
    "venda nova chama a push-send com o segredo",
  );

  // Como a Edge Function do pagamento: sem usuário logado.
  await as("postgres", null, () => db.query(`update public.orders set status = 'paid' where code = 'JD-PUSH01'`));
  const paid = await db.query(`select title, body from public.notifications where kind = 'payment' and title like '%JD-PUSH01'`);
  check(paid.rows.length === 1 && paid.rows[0].body.includes("R$ 250,00"), "pagamento confirmado sozinho vira aviso com o valor");

  await asAdmin(() => db.query(`update public.orders set status = 'paid' where code = 'JD-PUSH02'`));
  const manual = await db.query(`select 1 from public.notifications where kind = 'payment' and title like '%JD-PUSH02'`);
  check(manual.rows.length === 0, "quem marca como pago no painel não recebe aviso do próprio clique");

  const seen = await asAdmin(() => db.query(`select 1 from public.notifications where kind = 'payment' and title like '%JD-PUSH01'`));
  check(seen.rows.length === 1, "admin vê o pagamento confirmado no sininho");

  await asAdmin(() => db.query(`select public.delete_push_subscription($1)`, [endpoint]));
  check((await db.query(`select count(*)::int as n from public.push_subscriptions`)).rows[0].n === 0, "desligar apaga a inscrição do aparelho");
}
