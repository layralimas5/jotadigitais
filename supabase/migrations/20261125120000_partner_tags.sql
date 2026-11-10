-- Apelidos do parceiro para reconhecer a indicação: o cliente escreve "vim pela gi" e a indicação vai para a Gimena.
-- A leitura do "quem indicou" é feita no painel (src/domain/referral.ts); aqui só fica a lista que o Jota cadastra.

alter table public.partners
  add column tags text[] not null default '{}'
    constraint partners_tags check (cardinality(tags) <= 10 and array_position(tags, null) is null);
