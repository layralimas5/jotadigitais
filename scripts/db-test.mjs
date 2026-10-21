// Testa as migrations do Supabase num Postgres em memória (PGlite), simulando os papéis anon,
// authenticated e admin. Uso: npm run db:test
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

const ADMIN_ID = "00000000-0000-0000-0000-00000000a001";
const STRANGER_ID = "00000000-0000-0000-0000-00000000b002";

/** O mínimo do ambiente Supabase que as migrations usam: papéis, auth.uid() e storage. */
const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, last_sign_in_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema public, auth, storage to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant select, insert, update, delete on storage.objects to anon, authenticated;
  -- Como nos projetos novos do Supabase: tabela nenhuma nasce liberada; o acesso vem da migration table_grants.
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

const db = new PGlite();
let failures = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  ok  ${message}`);
  } else {
    failures += 1;
    console.error(`  FALHOU  ${message}`);
  }
}

async function as(role, userId, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${userId ?? ""}', false);`);
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
  await db.exec(SUPABASE_STUBS);
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  console.log("migrations aplicadas");

  await db.exec(`
    insert into auth.users (id, email) values ('${ADMIN_ID}', 'jota@exemplo.com'), ('${STRANGER_ID}', 'x@exemplo.com');
    insert into public.admin_users (user_id) values ('${ADMIN_ID}');
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
      /row-level security/,
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
    db.query(`select public.place_order($1, 'Maria Silva', 'Maria@Exemplo.com', '(11) 91234-5678', '529.982.247-25', '1990-05-10', '', 'Natal', 'RN', 'pix') as data`, [
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
      () => as("anon", null, () => db.query(`select public.place_order($1, 'Outro Cliente', 'outro@exemplo.com', '11912345678', '529.982.247-25', '1990-05-10', '', 'Natal', 'RN', 'card')`, [tiktokId])),
      /account_unavailable/,
    ),
    "segunda compra da mesma conta é recusada",
  );

  check(
    await rejects(
      () => as("anon", null, () => db.query(`select public.place_order($1, 'Ab', 'x@exemplo.com', '11912345678', '529.982.247-25', '1990-05-10', '', 'Natal', 'RN', 'pix')`, [youtubeId])),
      /invalid_name/,
    ),
    "servidor valida o nome",
  );
  check(
    await rejects(
      () => as("anon", null, () => db.query(`select public.place_order($1, 'Nome Ok', 'sem-arroba', '11912345678', '529.982.247-25', '1990-05-10', '', 'Natal', 'RN', 'pix')`, [youtubeId])),
      /invalid_email/,
    ),
    "servidor valida o e-mail",
  );
  const placeYoutube = (whatsapp, document, birthDate, city, state) =>
    as("anon", null, () =>
      db.query(`select public.place_order($1, 'Nome Ok', 'ficha@exemplo.com', $2, $3, $4, '', $5, $6, 'pix')`, [
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
    db.query(`select customer_document, customer_birth_date::text as birth, customer_state from public.orders where code = $1`, [order.code]),
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
    db.query(`select public.place_order($1, 'Joana Lima', 'joana@exemplo.com', '11912345678', '529.982.247-25', '1990-05-10', '', 'Natal', 'RN', 'card') as data`, [tiktokId]),
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
    db.query(`select public.place_order($1, 'Carlos Souza', 'carlos@exemplo.com', '11912345678', '529.982.247-25', '1990-05-10', '', 'Natal', 'RN', 'pix') as data`, [youtubeId]),
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
  await as("anon", null, () => db.query(`select public.place_order($1, 'Spam Teste', 'spam@exemplo.com', '11912345678', '529.982.247-25', '1990-05-10', '', 'Natal', 'RN', 'pix')`, [extra[0]]));
  await as("anon", null, () => db.query(`select public.place_order($1, 'Spam Teste', 'spam@exemplo.com', '11912345678', '529.982.247-25', '1990-05-10', '', 'Natal', 'RN', 'pix')`, [extra[1]]));
  check(
    await rejects(
      () => as("anon", null, () => db.query(`select public.place_order($1, 'Spam Teste', 'spam@exemplo.com', '11912345678', '529.982.247-25', '1990-05-10', '', 'Natal', 'RN', 'pix')`, [extra[2]])),
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

  console.log(failures === 0 ? "\nTudo certo." : `\n${failures} verificação(ões) falharam.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
