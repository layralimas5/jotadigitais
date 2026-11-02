-- Mockup do celular na página de cada conta: bio, capa e fotos dos posts que o Jota escolhe na ficha da conta.
-- Nome, @, foto de perfil e números já vêm das colunas que existem; aqui fica só o que é enfeite do mockup.
-- As imagens são links do armazenamento (bucket público "accounts"), por isso o JSON é pequeno.

alter table public.accounts
  add column mockup jsonb not null default '{}'::jsonb
    check (jsonb_typeof(mockup) = 'object' and pg_column_size(mockup) <= 20000);

-- A vitrine lê a coluna como lê a foto de perfil (grant por coluna desde 20261027120000_security_hardening).
grant select (mockup) on public.accounts to anon;
