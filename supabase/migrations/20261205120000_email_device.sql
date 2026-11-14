-- Aparelho onde o e-mail de cada conta está logado (iPhone, PC, POCO...): o Jota sabe onde pegar o código
-- de verificação quando a rede pede. Texto livre; o painel sugere os que já foram usados.

alter table public.email_accounts
  add column device text check (device is null or char_length(btrim(device)) between 1 and 40);
