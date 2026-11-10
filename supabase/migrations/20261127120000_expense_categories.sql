-- Gastos lançados pela ficha da conta: o Jota paga IA e gente para crescer cada perfil.
-- Cada lançamento é uma despesa comum, ligada à conta por expenses.account_id (já existia).

alter type public.expense_category add value if not exists 'growth';
alter type public.expense_category add value if not exists 'ai';
