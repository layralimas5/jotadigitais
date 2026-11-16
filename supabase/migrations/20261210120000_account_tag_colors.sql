-- Cor de fundo de cada tag das contas, escolhida pelo Jota na ficha da conta.
-- Uma linha por tag, valendo para todas as contas: "fixed:*" para Monetizada e Shop, "tag:<nome em minúsculas>"
-- para as que ele cria. A vitrine lê (card e página da conta); quem tem acesso a Contas grava.

create table public.account_tag_colors (
  tag_key text primary key
    constraint account_tag_colors_key check (
      char_length(tag_key) <= 40
      and tag_key ~ '^(fixed:(monetized|shop-pilot|shop-full)|tag:\S(.*\S)?)$'
      and tag_key = lower(tag_key)
    ),
  color text not null constraint account_tag_colors_color check (color ~ '^#[0-9a-f]{6}$'),
  updated_at timestamptz not null default now()
);

create trigger account_tag_colors_touch before update on public.account_tag_colors
  for each row execute function public.touch_updated_at();

alter table public.account_tag_colors enable row level security;

create policy "anyone reads tag colors" on public.account_tag_colors
  for select to anon, authenticated using (true);

create policy "accounts staff insert tag colors" on public.account_tag_colors
  for insert to authenticated with check ((select public.has_permission('accounts')));

create policy "accounts staff update tag colors" on public.account_tag_colors
  for update to authenticated
  using ((select public.has_permission('accounts'))) with check ((select public.has_permission('accounts')));

create policy "accounts staff delete tag colors" on public.account_tag_colors
  for delete to authenticated using ((select public.has_permission('accounts')));

revoke all on public.account_tag_colors from anon, authenticated;
grant select on public.account_tag_colors to anon, authenticated;
grant insert (tag_key, color), update (color), delete on public.account_tag_colors to authenticated;
