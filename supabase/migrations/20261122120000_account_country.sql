-- País da conta: o Jota escolhe na ficha antes de anunciar e a vitrine mostra ao lado da rede.
-- Contas que já existem ficam como Brasil. A lista é a mesma de src/domain/country.ts.

alter table public.accounts
  add column country text not null default 'BR'
    constraint accounts_country check (country in (
      'BR', 'US', 'PT', 'AR', 'MX', 'CO', 'CL', 'PE', 'PY', 'UY',
      'ES', 'GB', 'CA', 'DE', 'FR', 'IT', 'AU', 'JP', 'AO', 'MZ'
    ));

-- A vitrine lê a coluna como lê o mockup (grant por coluna desde 20261027120000_security_hardening).
grant select (country) on public.accounts to anon;
