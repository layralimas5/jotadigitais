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

## Entrega 3 (26/11, chamado do Jota)

Migration `supabase/migrations/20270103120000_affiliates_v3.sql`.

- **Pagamento sem lote:** acabou o "pagar a cada 10 indicações". Toda comissão liberada (a garantia da conta acabou)
  pode ser paga. A aba **Pagamentos** mostra em "Pronto para pagar" cada afiliado com valor liberado, a chave Pix e o
  "Paguei" (paga todas as liberadas de uma vez, dá para desfazer), e quanto ainda está na garantia. O saque mínimo
  passou para R$ 1,00.
- **Pedir pagamento:** no painel, o afiliado vê "Liberado para receber: R$ X" e o botão "Pedir pagamento" (uma vez a
  cada 24 horas). O Jota recebe o aviso no sininho e o afiliado aparece primeiro em Pagamentos com "Pediu pagamento
  em ...". Pagar limpa o pedido.
- **Página "Seja afiliado":** incentivo "A cada {vendas} vendas você recebe {valor} no total" (comissão de uma conta
  de R$ 1.500 vezes as vendas), explicação de que ganha em cada venda, liberada depois da garantia, e o aviso de que o
  saldo compra conta. O número de vendas fica em Programa > "Vendas no exemplo de ganho da página Seja afiliado" (no
  banco é a antiga coluna `payout_batch_size`).
- **Textos editáveis** (Programa > Textos, em branco vale o texto de exemplo): incentivo ({vendas}, {valor}), como
  ganha ({dias}), explicação do pagamento no painel ({dias}), aviso do saldo e mensagem do convite no WhatsApp
  ({nome}, {link}).
- **Comissões personalizadas:** regras por afiliado e por tipo de conta (Shop ativo, Shop piloto, TikTok monetizado,
  TikTok, Instagram, YouTube, Facebook), com mínimo de seguidores opcional e valor em % ou R$. Regras para todos ficam
  em Programa; regras de uma pessoa, na ficha dela ("Comissões personalizadas"). Desempate: a do afiliado vence a de
  todos, depois a que fala do tipo de conta, depois a de mais seguidores. Se a conta tiver comissão própria maior,
  vale a da conta. A migration já cria "Shop piloto: R$ 20 por venda" para todos.
- **Novo afiliado por convite** (aba Afiliados > Novo afiliado): nome, WhatsApp, e-mail, comissão própria e regras.
  Sai um link `/seja-afiliado?convite=...` para copiar ou mandar no WhatsApp. A pessoa confere os dados, cria a
  senha, informa o CPF e aceita os termos; entra aprovada com a comissão e as regras combinadas, mesmo com o programa
  fechado. Convites esperando aparecem como "Convite enviado", com regras editáveis e "Cancelar convite".
- **Comprar conta com o saldo:** no painel, "Comprar conta com seu saldo" gera um código de uso único (ex.:
  `SALDOANA3F1A1B2`) no valor do saldo liberado. O saldo fica reservado (sai do Pix) até usar ou cancelar. No
  checkout o saldo inteiro precisa caber na conta (sem troco): se não couber, aparece "Seu saldo é maior que o valor
  dessa conta...". Pedido pago com o código vira um pagamento "Usado na compra JD-..." (sem Pix, não se desfaz) e as
  comissões ficam pagas. Na aba Cupons esses códigos ficam separados em "Saldo de afiliados".

Para Gimena e Thais: Afiliados > Novo afiliado, sem comissão própria, com a regra "Todos os tipos, a partir de 2.000
seguidores, R$ 40,00" (Gimena) ou "R$ 50,00" (Thais). Os demais seguem nos 3% do programa e no Shop piloto a R$ 20.

**Painel do afiliado com a cara do painel da loja** (pedido do Jota: "cópia dos nossos dashboards, com as
funcionalidades do afiliado"): menu lateral em grupos (Início; Divulgação: Contas e links; Ganhos: Extrato,
Pagamentos, Comprar com saldo; Brindes; Conta: Perfil), seta para encolher, topo com onde você está, sininho e menu
da conta; no celular, barra de baixo (Início, Divulgar, Pagamentos, Brindes, Mais). A casca é a mesma do painel da
loja (`src/ui/components/panel-shell`). Telas novas: `/afiliado/ganhos`, `/afiliado/saldo` e `/afiliado/mais`
(também no "Ver como").

### Ligar em produção (entrega 3)

1. SQL Editor: colar `supabase/migrations/20270103120000_affiliates_v3.sql` inteiro (registra a versão no fim).
   Precisa entrar antes do push: o site novo lê as colunas e funções novas.
2. Publicar a função de cadastro (aceita o convite):
   `npx supabase functions deploy affiliate-signup --no-verify-jwt`.
3. Push da main (Netlify publica).
4. O Jota confere em Programa o número de vendas do exemplo, os textos e a regra do Shop piloto.

Limites conhecidos: se o pedido pago com o código de saldo for cancelado depois, o pagamento "Usado na compra" fica
como está (o Jota resolve à mão); comissão reservada que é cancelada desliga o código ainda não usado e o afiliado gera
outro com o valor certo.

## Próximas entregas

- **Pix automático do lote** pela API do C6 (depende do gerente liberar o Pix de saída), comprovante anexado ao
  lote, lançamento no Financeiro, informe anual.
- **Reembolso depois da entrega:** marcar pedido entregue como reembolsado/estornado e cancelar a comissão.
- **Campanhas de comissão especial por período.**
- **Avisos no celular** do afiliado (venda e comissão liberada) e app instalável do painel do afiliado.
- **Indicadores de afiliados no Dashboard.**
