-- Foto de perfil da conta à venda: a mesma da rede social, para a vitrine ficar igual ao perfil real.

alter table public.accounts
  add column avatar_url text check (avatar_url is null or char_length(avatar_url) between 1 and 500);
