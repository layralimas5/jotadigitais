-- Lista de países editável: o Jota cria um país novo direto na ficha da conta e ele já aparece na vitrine e no filtro.
-- Os 20 países que estavam fixos (20261122120000_account_country) entram como ponto de partida.

create table public.countries (
  -- ISO nos de fábrica; nos criados no painel, o nome em maiúsculas sem acento (NOVA-ZELANDIA).
  code text primary key constraint countries_code check (code ~ '^[A-Z0-9-]{2,40}$'),
  name text not null constraint countries_name check (char_length(btrim(name)) between 2 and 40 and name = btrim(name)),
  created_at timestamptz not null default now()
);

create unique index countries_name_key on public.countries (lower(name));

insert into public.countries (code, name) values
  ('BR', 'Brasil'),
  ('US', 'Estados Unidos'),
  ('PT', 'Portugal'),
  ('AR', 'Argentina'),
  ('MX', 'México'),
  ('CO', 'Colômbia'),
  ('CL', 'Chile'),
  ('PE', 'Peru'),
  ('PY', 'Paraguai'),
  ('UY', 'Uruguai'),
  ('ES', 'Espanha'),
  ('GB', 'Reino Unido'),
  ('CA', 'Canadá'),
  ('DE', 'Alemanha'),
  ('FR', 'França'),
  ('IT', 'Itália'),
  ('AU', 'Austrália'),
  ('JP', 'Japão'),
  ('AO', 'Angola'),
  ('MZ', 'Moçambique');

-- A conta passa a apontar para a lista em vez da checagem fixa. Renomear o código leva as contas junto;
-- país com conta não pode ser apagado.
alter table public.accounts drop constraint accounts_country;
alter table public.accounts
  add constraint accounts_country_fkey foreign key (country) references public.countries (code) on update cascade;

create index accounts_country_idx on public.accounts (country);

alter table public.countries enable row level security;

-- Vitrine e painel leem; quem cuida das contas (Jota, desenvolvedora ou ajudante com Contas) cria e corrige.
create policy "countries read" on public.countries for select to anon, authenticated using (true);
create policy "countries staff insert" on public.countries
  for insert to authenticated with check ((select public.has_permission('accounts')));
create policy "countries staff update" on public.countries
  for update to authenticated using ((select public.has_permission('accounts'))) with check ((select public.has_permission('accounts')));

grant select on public.countries to anon, authenticated;
grant insert, update on public.countries to authenticated;
revoke insert, update, delete, truncate on public.countries from anon;
revoke delete, truncate on public.countries from authenticated;
