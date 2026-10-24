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
  check(await rejects(() => placeYoutube("11912345678", "11222333000181", "1990-05-10", "", "RN"), /invalid_city/), "checkout exige cidade");
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
