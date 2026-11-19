-- Lembrete de pagar o parceiro a cada 10 pontos por indicação (chamado do Jota de 18/11).
-- Os pontos continuam calculados no painel (indicações x compras pagas); aqui fica só quanto já foi pago,
-- somado a cada "Já paguei".

alter table public.partners
  add column referral_points_paid integer not null default 0
  constraint partners_referral_points_paid check (referral_points_paid >= 0);

/**
 * "Já paguei": soma os pontos pagos de uma vez (sem ler e regravar no navegador, então dois cliques não se perdem).
 * Só quem tem a área Parceiros. Devolve o parceiro atualizado.
 */
create or replace function public.pay_partner_referral_points(p_partner_id uuid, p_points integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated public.partners;
begin
  if not public.has_permission('partners') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_points is null or p_points <= 0 or p_points > 1000 then
    raise exception 'invalid_points' using errcode = 'P0001';
  end if;
  update public.partners
  set referral_points_paid = referral_points_paid + p_points
  where id = p_partner_id
  returning * into updated;
  if updated.id is null then
    raise exception 'partner_not_found' using errcode = 'P0001';
  end if;
  return to_jsonb(updated);
end;
$$;

revoke all on function public.pay_partner_referral_points(uuid, integer) from public, anon;
grant execute on function public.pay_partner_referral_points(uuid, integer) to authenticated;
