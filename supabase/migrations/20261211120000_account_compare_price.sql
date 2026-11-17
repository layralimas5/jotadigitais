-- Oferta na ficha da conta: "de R$ 550,00 por R$ 499,00".
-- price_cents continua sendo o que o cliente paga (carrinho, checkout e cupom não mudam);
-- compare_at_price_cents é o valor anterior, só para aparecer riscado. Nulo = conta sem oferta.

alter table public.accounts
  add column compare_at_price_cents integer
    constraint accounts_compare_at_price check (compare_at_price_cents is null or compare_at_price_cents > price_cents);

-- A vitrine lê a coluna como lê as etiquetas (grant por coluna desde 20261027120000_security_hardening).
grant select (compare_at_price_cents) on public.accounts to anon;
