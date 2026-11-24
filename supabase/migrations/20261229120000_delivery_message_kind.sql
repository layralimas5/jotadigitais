-- Chamado "Cada conta e canal ter uma mensagem pra enviar no WhatsApp": a mensagem de entrega salva pode ficar
-- ligada a um tipo de conta (os mesmos do "Sobre esta conta"). "Enviar acesso" abre com a mensagem do tipo da
-- conta vendida; tipo sem mensagem própria abre com a padrão.

alter table public.delivery_messages
  add column account_kind text check (
    account_kind in (
      'tiktokShopFull', 'tiktokShopPilot', 'tiktokMonetized', 'tiktok',
      'instagramMonetized', 'instagram', 'youtubeMonetized', 'youtube',
      'facebookMonetized', 'facebook'
    )
  );

-- Um tipo abre com uma mensagem só: a que ganhou o tipo por último tira ele das outras.
create or replace function public.release_delivery_message_kind()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.account_kind is not null then
    update public.delivery_messages
      set account_kind = null
      where account_kind = new.account_kind and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger delivery_messages_release_kind
  before insert or update of account_kind on public.delivery_messages
  for each row execute function public.release_delivery_message_kind();

create unique index delivery_messages_one_per_kind on public.delivery_messages (account_kind) where account_kind is not null;
