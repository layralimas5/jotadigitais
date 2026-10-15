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
  create schema auth;
  create table auth.users (id uuid primary key, email text);
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
  alter default privileges in schema public grant all on tables to anon, authenticated;
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
    db.query(`select public.place_order($1, 'Maria Silva', 'Maria@Exemplo.com', '(11) 91234-5678', 'pix') as data`, [
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
      () => as("anon", null, () => db.query(`select public.place_order($1, 'Outro Cliente', 'outro@exemplo.com', '', 'card')`, [tiktokId])),
      /account_unavailable/,
    ),
    "segunda compra da mesma conta é recusada",
  );

  check(
    await rejects(
      () => as("anon", null, () => db.query(`select public.place_order($1, 'Ab', 'x@exemplo.com', '', 'pix')`, [youtubeId])),
      /invalid_name/,
    ),
    "servidor valida o nome",
  );
  check(
    await rejects(
      () => as("anon", null, () => db.query(`select public.place_order($1, 'Nome Ok', 'sem-arroba', '', 'pix')`, [youtubeId])),
      /invalid_email/,
    ),
    "servidor valida o e-mail",
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
    db.query(`select public.place_order($1, 'Joana Lima', 'joana@exemplo.com', '', 'card') as data`, [tiktokId]),
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
    db.query(`select public.place_order($1, 'Carlos Souza', 'carlos@exemplo.com', '', 'pix') as data`, [youtubeId]),
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
  await as("anon", null, () => db.query(`select public.place_order($1, 'Spam Teste', 'spam@exemplo.com', '', 'pix')`, [extra[0]]));
  await as("anon", null, () => db.query(`select public.place_order($1, 'Spam Teste', 'spam@exemplo.com', '', 'pix')`, [extra[1]]));
  check(
    await rejects(
      () => as("anon", null, () => db.query(`select public.place_order($1, 'Spam Teste', 'spam@exemplo.com', '', 'pix')`, [extra[2]])),
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
