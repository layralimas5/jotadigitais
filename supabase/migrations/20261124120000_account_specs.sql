-- Ficha técnica própria de cada conta: o Jota escreve as linhas na ficha da conta (aba Contas).
-- Nula = ficha automática (rede, país, nicho, números e as linhas fixas da aba Site), como era antes.

alter table public.accounts
  add column specs jsonb
    constraint accounts_specs check (
      specs is null
      or (jsonb_typeof(specs) = 'array' and jsonb_array_length(specs) between 1 and 20 and pg_column_size(specs) <= 8000)
    );

-- A vitrine lê a coluna como lê o mockup (grant por coluna desde 20261027120000_security_hardening).
grant select (specs) on public.accounts to anon;
