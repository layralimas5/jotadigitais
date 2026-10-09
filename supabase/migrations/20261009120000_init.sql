-- Jota Digitais: estoque de contas, depoimentos e pedidos.
-- Leitura pública só do que a vitrine precisa; escrita só por administradores (RLS).
-- Pedidos entram exclusivamente pela função place_order, que reserva a conta de forma atômica.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.platform as enum ('tiktok', 'instagram', 'youtube', 'facebook');
create type public.account_status as enum ('available', 'reserved', 'sold');
create type public.testimonial_kind as enum ('result', 'delivered');
create type public.payment_method as enum ('pix', 'card');
create type public.order_status as enum ('awaiting_payment', 'paid', 'delivered', 'canceled');

-- ---------------------------------------------------------------------------
-- Administradores
-- ---------------------------------------------------------------------------

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create policy "admins read admin list" on public.admin_users
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Utilitário de updated_at
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Contas à venda
-- ---------------------------------------------------------------------------

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  platform public.platform not null,
  display_name text not null check (char_length(display_name) between 2 and 80),
  handle text not null check (handle ~ '^@[A-Za-z0-9._-]{1,60}$'),
  niche text check (niche is null or char_length(niche) between 1 and 40),
  followers integer not null check (followers >= 0),
  price_cents integer not null check (price_cents between 100 and 100000000),
  status public.account_status not null default 'available',
  -- Reserva feita pelo checkout. Passado esse horário sem pagamento confirmado, a conta volta para a vitrine.
  reserved_until timestamptz,
  description text check (description is null or char_length(description) <= 2000),
  images text[] not null default '{}' check (cardinality(images) <= 8),
  stats jsonb not null check (jsonb_typeof(stats) = 'object'),
  listed_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stats_match_platform check (
    case platform
      when 'tiktok' then stats ?& array['likes', 'following']
      when 'instagram' then stats ?& array['posts', 'following', 'professional']
      when 'youtube' then stats ?& array['views', 'videos', 'watchHours', 'monetized']
      when 'facebook' then stats ?& array['kind', 'likes', 'monetized']
    end
  )
);

create index accounts_platform_idx on public.accounts (platform);
create index accounts_status_listed_idx on public.accounts (status, listed_at desc);

create trigger accounts_touch before update on public.accounts
  for each row execute function public.touch_updated_at();

-- Prazo de reserva só existe em conta reservada. Reservar à mão uma conta com prazo vencido vira reserva sem prazo.
create or replace function public.normalize_reservation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'reserved' then
    new.reserved_until := null;
  elsif new.reserved_until is not null and new.reserved_until <= now() then
    new.reserved_until := null;
  end if;
  return new;
end;
$$;

create trigger accounts_normalize_reservation before insert or update on public.accounts
  for each row execute function public.normalize_reservation();

alter table public.accounts enable row level security;

create policy "anyone reads accounts" on public.accounts
  for select to anon, authenticated using (true);

create policy "admins insert accounts" on public.accounts
  for insert to authenticated with check (public.is_admin());

create policy "admins update accounts" on public.accounts
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins delete accounts" on public.accounts
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Depoimentos (prints de resultado e de contas entregues)
-- ---------------------------------------------------------------------------

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  kind public.testimonial_kind not null,
  title text not null check (char_length(title) between 2 and 60),
  subtitle text not null check (char_length(subtitle) between 2 and 60),
  image_url text not null check (char_length(image_url) between 1 and 500),
  image_alt text not null check (char_length(image_alt) between 10 and 300),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  position integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index testimonials_published_position_idx on public.testimonials (published, position);

create trigger testimonials_touch before update on public.testimonials
  for each row execute function public.touch_updated_at();

alter table public.testimonials enable row level security;

create policy "anyone reads published testimonials" on public.testimonials
  for select to anon, authenticated using (published or public.is_admin());

create policy "admins insert testimonials" on public.testimonials
  for insert to authenticated with check (public.is_admin());

create policy "admins update testimonials" on public.testimonials
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins delete testimonials" on public.testimonials
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^JD-[A-Z0-9]{6}$'),
  account_id uuid references public.accounts (id) on delete set null,
  -- Cópia dos dados da conta no momento da compra: o pedido continua legível mesmo se a conta for apagada.
  account_handle text not null,
  account_name text not null,
  account_platform public.platform not null,
  customer_name text not null check (char_length(customer_name) between 3 and 120),
  customer_email text not null check (customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(customer_email) <= 254),
  customer_whatsapp text check (customer_whatsapp is null or customer_whatsapp ~ '^\d{10,13}$'),
  payment_method public.payment_method not null,
  total_cents integer not null check (total_cents > 0),
  status public.order_status not null default 'awaiting_payment',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_created_idx on public.orders (created_at desc);
create index orders_account_idx on public.orders (account_id);
create index orders_email_idx on public.orders (customer_email);

create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

alter table public.orders enable row level security;

create policy "admins read orders" on public.orders
  for select to authenticated using (public.is_admin());

create policy "admins update orders" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Mudança de status pelo painel: valida a transição e sincroniza a conta.
create or replace function public.sync_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean;
  other_active boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  allowed := case old.status
    when 'awaiting_payment' then new.status in ('paid', 'canceled')
    when 'paid' then new.status in ('delivered', 'canceled')
    else false
  end;
  if not allowed then
    raise exception 'invalid_transition: % -> %', old.status, new.status using errcode = 'P0001';
  end if;

  if new.account_id is null then
    return new;
  end if;

  if new.status = 'paid' then
    update public.accounts set status = 'reserved', reserved_until = null where id = new.account_id;
  elsif new.status = 'delivered' then
    update public.accounts set status = 'sold', reserved_until = null where id = new.account_id;
  elsif new.status = 'canceled' then
    select exists (
      select 1 from public.orders o
      where o.account_id = new.account_id
        and o.id <> new.id
        and (o.status in ('paid', 'delivered') or (o.status = 'awaiting_payment' and o.expires_at > now()))
    ) into other_active;
    if not other_active then
      update public.accounts set status = 'available', reserved_until = null
        where id = new.account_id and status = 'reserved';
    end if;
  end if;

  return new;
end;
$$;

create trigger orders_sync_status before update of status on public.orders
  for each row execute function public.sync_order_status();

-- ---------------------------------------------------------------------------
-- Checkout público
-- ---------------------------------------------------------------------------

create or replace function public.generate_order_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := 'JD-';
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.mask_email(email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(split_part(email, '@', 1), 2) || '***@' || split_part(email, '@', 2);
$$;

-- Dados do pedido que podem aparecer na página de confirmação (e-mail mascarado).
create or replace function public.public_order_json(o public.orders)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'code', o.code,
    'account_id', o.account_id,
    'account_handle', o.account_handle,
    'account_name', o.account_name,
    'account_platform', o.account_platform,
    'customer_name', o.customer_name,
    'customer_email', public.mask_email(o.customer_email),
    'customer_whatsapp', null,
    'payment_method', o.payment_method,
    'total_cents', o.total_cents,
    'status', o.status,
    'expires_at', o.expires_at,
    'created_at', o.created_at
  );
$$;

create or replace function public.place_order(
  p_account_id uuid,
  p_name text,
  p_email text,
  p_whatsapp text,
  p_payment_method public.payment_method,
  p_hold_minutes integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  acc public.accounts;
  new_order public.orders;
  clean_name text := btrim(coalesce(p_name, ''));
  clean_email text := lower(btrim(coalesce(p_email, '')));
  clean_whatsapp text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  open_orders integer;
  attempt integer := 0;
begin
  if char_length(clean_name) < 3 or char_length(clean_name) > 120 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if clean_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(clean_email) > 254 then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;
  if clean_whatsapp is not null and clean_whatsapp !~ '^\d{10,13}$' then
    raise exception 'invalid_whatsapp' using errcode = 'P0001';
  end if;
  if p_hold_minutes not between 15 and 1440 then
    raise exception 'invalid_hold' using errcode = 'P0001';
  end if;

  -- Freio contra quem tenta segurar o estoque inteiro com pedidos falsos.
  select count(*) into open_orders from public.orders
    where customer_email = clean_email and status = 'awaiting_payment' and expires_at > now();
  if open_orders >= 2 then
    raise exception 'too_many_open_orders' using errcode = 'P0001';
  end if;

  select * into acc from public.accounts where id = p_account_id for update;
  if not found then
    raise exception 'account_not_found' using errcode = 'P0001';
  end if;

  if acc.status = 'sold'
     or (acc.status = 'reserved' and (acc.reserved_until is null or acc.reserved_until > now())) then
    raise exception 'account_unavailable' using errcode = 'P0001';
  end if;

  -- Reserva anterior venceu sem pagamento: o pedido antigo é cancelado antes de liberar a conta.
  update public.orders set status = 'canceled'
    where account_id = acc.id and status = 'awaiting_payment';

  loop
    attempt := attempt + 1;
    begin
      insert into public.orders (
        code, account_id, account_handle, account_name, account_platform,
        customer_name, customer_email, customer_whatsapp, payment_method, total_cents, expires_at
      ) values (
        public.generate_order_code(), acc.id, acc.handle, acc.display_name, acc.platform,
        clean_name, clean_email, clean_whatsapp, p_payment_method, acc.price_cents,
        now() + make_interval(mins => p_hold_minutes)
      ) returning * into new_order;
      exit;
    exception when unique_violation then
      if attempt >= 5 then
        raise;
      end if;
    end;
  end loop;

  update public.accounts
    set status = 'reserved', reserved_until = new_order.expires_at
    where id = acc.id;

  return public.public_order_json(new_order);
end;
$$;

revoke all on function public.place_order(uuid, text, text, text, public.payment_method, integer) from public;
grant execute on function public.place_order(uuid, text, text, text, public.payment_method, integer) to anon, authenticated;

create or replace function public.get_order(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.public_order_json(o) from public.orders o where o.code = upper(btrim(p_code));
$$;

revoke all on function public.get_order(text) from public;
grant execute on function public.get_order(text) to anon, authenticated;

-- Funções internas não ficam expostas na API.
revoke all on function public.generate_order_code() from public, anon, authenticated;
revoke all on function public.public_order_json(public.orders) from public, anon, authenticated;
revoke all on function public.sync_order_status() from public, anon, authenticated;
revoke all on function public.normalize_reservation() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Imagens (prints das contas e dos depoimentos)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Visitantes leem pela URL pública do bucket; a política de leitura é para o painel (upsert e listagem).
create policy "admins read media" on storage.objects
  for select to authenticated using (bucket_id = 'media' and public.is_admin());

create policy "admins upload media" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());

create policy "admins update media" on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_admin());

create policy "admins delete media" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());
