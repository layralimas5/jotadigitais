-- Figurinhas na conversa do Suporte: a resposta guarda qual figurinha foi enviada.
-- O texto continua obrigatório ("Figurinha 💩"), para o sininho, o push e o resumo da última mensagem.

alter table public.support_replies
  add column sticker text check (sticker is null or sticker ~ '^[a-z0-9-]{1,40}$');

grant insert (sticker) on public.support_replies to authenticated;
