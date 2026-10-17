-- Fichas mais completas: despesa ganha fornecedor, forma de pagamento, conta ligada e observações;
-- cliente ganha documento, cidade/UF, origem e interesse. Tudo opcional, então os registros antigos seguem válidos.

create type public.expense_payment_method as enum ('pix', 'card', 'cash', 'transfer', 'boleto');

alter table public.expenses
  add column supplier text check (supplier is null or char_length(supplier) <= 80),
  add column payment_method public.expense_payment_method,
  add column account_id uuid references public.accounts (id) on delete set null,
  add column notes text check (notes is null or char_length(notes) <= 1000);

create index expenses_account_id_idx on public.expenses (account_id) where account_id is not null;

alter table public.customers
  add column document text check (document is null or document ~ '^([0-9]{11}|[0-9]{14})$'),
  add column city text check (city is null or char_length(city) <= 60),
  add column state text check (state is null or state in (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
    'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  )),
  add column source public.lead_source,
  add column interest public.platform;
