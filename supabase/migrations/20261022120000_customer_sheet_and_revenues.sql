-- Ficha completa do cliente e receitas lançadas.
-- 1. O checkout passa a pedir CPF/CNPJ, nascimento, WhatsApp, Instagram (opcional), cidade e UF.
--    A ficha fica no próprio pedido: é o retrato de quem comprou, e só administradores leem.
--    Pedidos antigos seguem sem ela (colunas opcionais).
-- 2. Cliente cadastrado à mão ganha data de nascimento.
-- 3. Financeiro ganha receitas lançadas à mão (venda por fora, serviço, comissão).

-- ---------------------------------------------------------------------------
-- Documento: CPF ou CNPJ com dígito verificador (mesma regra de src/domain/brazil.ts)
-- ---------------------------------------------------------------------------

create or replace function public.document_check_digit(digits text, weights integer[])
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when total % 11 < 2 then 0 else 11 - total % 11 end
  from (
    select sum(substr(digits, i, 1)::integer * weights[i]) as total
    from generate_subscripts(weights, 1) as i
  ) as weighted;
$$;

create or replace function public.is_valid_document(value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if value ~ '^(\d)\1+$' then
    return false;
  end if;
  if value ~ '^\d{11}$' then
    return substr(value, 10, 1)::integer = public.document_check_digit(value, array[10, 9, 8, 7, 6, 5, 4, 3, 2])
      and substr(value, 11, 1)::integer = public.document_check_digit(value, array[11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  end if;
  if value ~ '^\d{14}$' then
    return substr(value, 13, 1)::integer = public.document_check_digit(value, array[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
      and substr(value, 14, 1)::integer = public.document_check_digit(value, array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  end if;
  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ficha no pedido
-- ---------------------------------------------------------------------------

alter table public.orders
  add column customer_document text check (customer_document is null or public.is_valid_document(customer_document)),
  add column customer_birth_date date check (customer_birth_date is null or customer_birth_date >= date '1900-01-01'),
  add column customer_instagram text check (customer_instagram is null or customer_instagram ~ '^@[A-Za-z0-9._]{1,30}$'),
  add column customer_city text check (customer_city is null or char_length(customer_city) between 2 and 60),
  add column customer_state text check (customer_state is null or customer_state in (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
    'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ));

alter table public.customers
  add column birth_date date check (birth_date is null or birth_date >= date '1900-01-01');

-- A versão antiga aceitava pedido sem ficha: sai para ninguém usar por fora do checkout novo.
drop function public.place_order(uuid, text, text, text, public.payment_method, integer);

create or replace function public.place_order(
  p_account_id uuid,
  p_name text,
  p_email text,
  p_whatsapp text,
  p_document text,
  p_birth_date date,
  p_instagram text,
  p_city text,
  p_state text,
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
  clean_whatsapp text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  clean_document text := regexp_replace(coalesce(p_document, ''), '\D', '', 'g');
  clean_instagram text := nullif(btrim(coalesce(p_instagram, '')), '');
  clean_city text := btrim(coalesce(p_city, ''));
  clean_state text := upper(btrim(coalesce(p_state, '')));
  open_orders integer;
  attempt integer := 0;
begin
  if char_length(clean_name) < 3 or char_length(clean_name) > 120 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if clean_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(clean_email) > 254 then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;
  if clean_whatsapp !~ '^\d{10,13}$' then
    raise exception 'invalid_whatsapp' using errcode = 'P0001';
  end if;
  if not public.is_valid_document(clean_document) then
    raise exception 'invalid_document' using errcode = 'P0001';
  end if;
  -- Compra só para maiores de 18 anos (termos de compra).
  if p_birth_date is null or p_birth_date < date '1900-01-01' or p_birth_date > (current_date - interval '18 years')::date then
    raise exception 'invalid_birth_date' using errcode = 'P0001';
  end if;
  if clean_instagram is not null and left(clean_instagram, 1) <> '@' then
    clean_instagram := '@' || clean_instagram;
  end if;
  if clean_instagram is not null and clean_instagram !~ '^@[A-Za-z0-9._]{1,30}$' then
    raise exception 'invalid_instagram' using errcode = 'P0001';
  end if;
  if char_length(clean_city) < 2 or char_length(clean_city) > 60 then
    raise exception 'invalid_city' using errcode = 'P0001';
  end if;
  if clean_state not in (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
    'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ) then
    raise exception 'invalid_state' using errcode = 'P0001';
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
        customer_name, customer_email, customer_whatsapp,
        customer_document, customer_birth_date, customer_instagram, customer_city, customer_state,
        payment_method, total_cents, expires_at
      ) values (
        public.generate_order_code(), acc.id, acc.handle, acc.display_name, acc.platform,
        clean_name, clean_email, clean_whatsapp,
        clean_document, p_birth_date, clean_instagram, clean_city, clean_state,
        p_payment_method, acc.price_cents, now() + make_interval(mins => p_hold_minutes)
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

  -- A resposta pública continua sem a ficha (public_order_json não mudou).
  return public.public_order_json(new_order);
end;
$$;

revoke all on function public.place_order(uuid, text, text, text, text, date, text, text, text, public.payment_method, integer) from public;
grant execute on function public.place_order(uuid, text, text, text, text, date, text, text, text, public.payment_method, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Receitas lançadas
-- ---------------------------------------------------------------------------

create type public.revenue_category as enum ('account_sale', 'service', 'commission', 'other');

create table public.revenues (
  id uuid primary key default gen_random_uuid(),
  description text not null check (char_length(description) between 2 and 120),
  category public.revenue_category not null default 'account_sale',
  amount_cents integer not null check (amount_cents between 1 and 100000000),
  received_on date not null default current_date,
  payment_method public.expense_payment_method,
  customer_id uuid references public.customers (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index revenues_received_on_idx on public.revenues (received_on desc);
create index revenues_customer_id_idx on public.revenues (customer_id) where customer_id is not null;
create index revenues_account_id_idx on public.revenues (account_id) where account_id is not null;

create trigger revenues_touch before update on public.revenues
  for each row execute function public.touch_updated_at();

alter table public.revenues enable row level security;

create policy "admins read revenues" on public.revenues
  for select to authenticated using (public.is_admin());

create policy "admins insert revenues" on public.revenues
  for insert to authenticated with check (public.is_admin());

create policy "admins update revenues" on public.revenues
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins delete revenues" on public.revenues
  for delete to authenticated using (public.is_admin());

revoke all on public.revenues from anon;
