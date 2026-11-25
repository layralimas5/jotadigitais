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

## Entrega 2 (25/11, chamados "painel de afiliados" e "exemplos de ganhos")

Migration `supabase/migrations/20270101120000_affiliates_v2.sql`.

- **Pagamento em lotes:** o Jota paga a cada N indicações (Programa > "Pagar a cada quantas indicações", padrão 10).
  Aba **Pagamentos** mostra cada afiliado com a barra até o próximo lote, "Pagar lote" ou "Pagar todas", a chave Pix
  para copiar e o aviso de quantas ainda estão na garantia. "Paguei" grava o lote (`affiliate_payouts`) e marca as
  comissões como pagas; dá para desfazer. O afiliado vê "já pagas / faltam X para o próximo pagamento" e o histórico
  no Extrato.
- **Comissão própria por afiliado** (ficha do afiliado): substitui a padrão do programa. Conta com comissão própria
  paga a dela, a não ser que a do afiliado dê mais (`affiliate_amount_for`, igual a `affiliateAmountFor`).
- **Brindes** (aba Brindes): para todos ou para um afiliado, com prazo. O afiliado toca em "Receber" (aba Brindes do
  painel), o Jota recebe no sininho e marca como entregue.
- **Painel do afiliado:** faixa de chamada editável (Programa > Textos), contas disponíveis, afiliados no programa,
  tipos mais vendidos nos 30 dias, exemplos de ganho com as contas que mais rendem e conta rápida por mês, central de
  avisos (vendas, comissão liberada, pagamento, brinde, recado, contas novas) com contador de não lidos.
- **Indicação pelo WhatsApp:** link `/indicacao/<código>` conta o clique, guarda a indicação no navegador e abre o
  WhatsApp da loja com "(código: x)". Com o número oficial ligado, a mensagem marca o contato com o afiliado
  (`whatsapp_mark_affiliate_referral`) e a compra desse número no prazo do link conta para ele (via `whatsapp`).
  Ordem de quem leva: cupom, link, WhatsApp.
- **Atribuir venda à mão** (ficha do afiliado): pedido sem link nem cupom passa a contar para o afiliado; se já pago,
  a comissão nasce na hora (via `manual`). A ficha também mostra o link da loja dele para mandar ao cliente indicado.
- **Página "Seja afiliado":** botões no topo, quanto ganha (exemplos e conta por mês), o que recebe e dúvidas.

### Ligar em produção

1. SQL Editor: colar `20270101120000_affiliates_v2.sql` (testada em transação desfeita em 25/11).
2. Push da main (Netlify publica). Nenhuma função nova.
3. O Jota confere em Programa o "Pagar a cada quantas indicações" e, se quiser, a faixa do painel.

## Próximas entregas

- **Pix automático do lote** pela API do C6 (depende do gerente liberar o Pix de saída), comprovante anexado ao
  lote, lançamento no Financeiro, informe anual.
- **Reembolso depois da entrega:** marcar pedido entregue como reembolsado/estornado e cancelar a comissão.
- **Campanhas de comissão especial por período.**
- **Avisos no celular** do afiliado (venda e comissão liberada) e app instalável do painel do afiliado.
- **Indicadores de afiliados no Dashboard.**
