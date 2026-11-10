-- Etiquetas que o Jota cria na ficha da conta (ex.: "Nicho quente"). Aparecem no card da vitrine e na página da conta.
-- O Shop do TikTok (piloto ou ativo) não mora aqui: vai em stats.shop, marcado na ficha, sem mudar o banco.

alter table public.accounts
  add column tags text[] not null default '{}'
    constraint accounts_tags check (
      cardinality(tags) <= 5
      and array_position(tags, null) is null
      and char_length(array_to_string(tags, '')) <= 5 * 24
    );

-- A vitrine lê a coluna como lê a ficha técnica (grant por coluna desde 20261027120000_security_hardening).
grant select (tags) on public.accounts to anon;
