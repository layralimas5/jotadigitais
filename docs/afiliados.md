# Programa de afiliados

Aditivo 01, Anexo I, item 2. Afiliado é diferente de parceiro: parceiro fornece contas; afiliado divulga as contas da
loja com link ou cupom próprio, tem login próprio e ganha comissão em nível único sobre a venda paga.

## O que já existe (entrega 1)

**Painel do Jota (Parceiros)**, com abas:

- **Afiliados:** lista com cliques, vendas, conversão, comissão pendente e liberada; aprovação rápida de quem está
  esperando; exportação das comissões em planilha (CSV para Excel).
- **Ficha do afiliado** (`/admin/parceiros/afiliados/:id`): dados, CPF sob pedido (a desenvolvedora não vê),
  situação (aprovado, suspenso, bloqueado, recusado) com anotação, ligação com o cadastro de parceiro, cupom
  exclusivo e extrato com "Cancelar comissão".
- **Programa:** liga e desliga, aprovação automática, comissão padrão (% ou R$), dias que o link vale (padrão 30),
  travas de saque (mínimo, limite diário, aprovação manual acima de), recado de boas-vindas e termos do programa
  (com texto-base para revisar).
- **Mural:** recados para todos os afiliados aprovados.
- **Ficha de cada conta:** cartão "Afiliados" para tirar a conta do programa ou dar comissão própria.

**Site:** página `/seja-afiliado` com cadastro (nome, e-mail, WhatsApp, CPF, senha, aceite dos termos) e o link
`?ref=<código>` em qualquer página (o clique fica guardado no navegador pelo prazo do programa).

**Painel do afiliado** (`/afiliado`, login próprio, separado do login da loja): Início (saldo, pendente, vendas,
cliques, link geral, cupom, mural, ranking dos 30 dias, últimas vendas), Divulgar (link, QR Code e material por
conta), Extrato (período, situação, planilha) e Perfil (dados, CPF, chave Pix, senha). Recuperação de senha por
e-mail cai em `/afiliado/nova-senha`.

**Painel da desenvolvedora:** os afiliados ficam em **Acessos** (`/admin/acessos`, abaixo da equipe da loja), cada um com a ficha (`/admin/acessos/afiliados/:id`) e o **Ver como** (`/admin/ver-afiliado/:id`): o painel do afiliado do jeito que ele vê, só leitura, com e-mail, WhatsApp, Pix e CPF mascarados. A ficha do afiliado na aba Parceiros também tem o botão Ver como.

## Regras (iguais no banco e na tela)

- A comissão nasce quando o pedido vira **pago**, a partir do valor pago (já com desconto de cupom).
- Fica **pendente** até a garantia acabar (`entregue em + dias de garantia` da aba Site) e aí vira **liberada**.
- Pedido **cancelado** cancela a comissão sozinho. O Jota pode cancelar uma comissão à mão.
- Compra com o **CPF do próprio afiliado** nasce cancelada.
- **Cupom do afiliado vence o link** de outro afiliado.
- O pedido só aceita afiliado nos primeiros 15 minutos e só uma vez.
- Afiliado não aprovado não conta clique nem venda.

## Para ligar em produção

1. Colar `supabase/migrations/20261216120000_affiliates.sql` no SQL Editor (ou `db push` depois do repair das
   migrations 1116 e 1121) e registrar em `supabase_migrations.schema_migrations`. Precisa entrar **antes** do push:
   a aba Parceiros e o site leem as tabelas novas.
2. Publicar a função de cadastro: `npx supabase functions deploy affiliate-signup --no-verify-jwt`.
3. Em Authentication > URL Configuration, liberar `https://jotadigitais.com.br/afiliado/nova-senha` como redirect.
4. Push da main (Netlify publica).
5. O Jota revisa os termos na aba Programa, preenche os `[preencher: …]` e liga o programa.

Conferir pela REST depois de colar: `affiliate_program` lê com a chave anon; `affiliates` e
`affiliate_commissions` recusam anon.

## Próximas entregas

- **Saques e pagamento:** pedido de saque, travas, Pix automático pela API do banco (depende do banco liberar o Pix
  de saída), pagamento manual com comprovante, lançamento no Financeiro, informe anual.
- **Reembolso depois da entrega:** marcar pedido entregue como reembolsado/estornado e cancelar a comissão.
- **Campanhas de comissão especial por período.**
- **Avisos no celular** do afiliado (venda e comissão liberada) e app instalável do painel do afiliado.
- **Indicadores de afiliados no Dashboard.**
