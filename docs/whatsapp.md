# Automação do WhatsApp

Escopo: item 1 do Anexo I do Aditivo 01 (atendimento com IA, entrega do acesso, lembrete, pós-venda, passagem
para o Jota, painel de conversas e relatório). Branch `feat/whatsapp-automation`.

## Regra da Meta que define o desenho

- **Janela de 24 horas.** Quando o cliente manda mensagem, abre uma janela de 24h em que podemos responder com
  qualquer texto, de graça. É aí que entram a IA e os textos editáveis da aba Automação.
- **Fora da janela**, a loja só pode puxar conversa com **modelo aprovado pela Meta** (texto fixo com variáveis
  `{{1}}`, `{{2}}`...). É pago por envio e cada mudança no texto passa por aprovação de novo.

Por isso, o cliente que compra no site e nunca falou com o Jota só pode receber um modelo aprovado.

## Entrega do acesso (o fluxo principal)

1. O pagamento é confirmado (C6 ou InfinitePay) e o pedido vira `paid`.
2. Um gatilho no banco chama a função `whatsapp-send`, como já acontece com o `push-send`.
3. Se o cliente já está na janela de 24h: vai direto a mensagem "Conta entregue" da aba Automação, com o login.
4. Se não está: vai o modelo aprovado **"Pagamento confirmado"** com o botão **"Receber meu acesso"**. Quando o
   cliente toca, a janela abre e a mensagem "Conta entregue" sai na hora, com o texto editável.
5. A página do pedido pago ganha o botão "Receber acesso no WhatsApp" (abre a conversa com o código do pedido).
   O cliente que chama por ali também abre a janela e recebe o acesso sozinho.
6. O pedido vira `delivered` e o Jota recebe o push "Acesso entregue".
7. Se em 30 minutos ninguém tocou no botão, o Jota recebe um push para entregar à mão (o card de entrega de
   Pedidos continua funcionando).

Por que o botão em vez de mandar a senha direto no modelo: o texto da entrega continua editável no painel, sem
nova aprovação da Meta; a senha só sai quando quem comprou responde naquele número; e o número errado no checkout
não recebe login de ninguém.

Carrinho com várias contas: uma mensagem por conta, na ordem do carrinho.

## Atendimento com IA

- Modelo: Claude Haiku 5.5 (barato e rápido para atendimento), com chave da Anthropic na conta do Jota.
- Ferramentas que a IA pode usar: buscar contas disponíveis (rede, país, faixa de preço), ver situação do pedido
  pelo código, ler as perguntas frequentes, passar para o Jota.
- Configuração no painel: liga e desliga, tom de voz, instruções, perguntas frequentes, horário (24h ou só fora do
  comercial), números ignorados, áudios gravados e quando usar cada um.
- Diz que é atendimento automático se perguntarem (cláusula 6.3 b). "Parar" desliga as mensagens automáticas
  para aquele número (6.3 j).
- Passa para o Jota quando o cliente quer negociar ou fechar algo fora do padrão, ou quando não sabe responder:
  resumo da conversa + push no celular. A conversa fica "com o Jota" até ele devolver.

## Peças técnicas

| Peça | O que faz |
| --- | --- |
| Migration `whatsapp` | `whatsapp_settings` (1 linha), `whatsapp_contacts`, `whatsapp_messages`, `whatsapp_faq`, `whatsapp_audios`, fila de envio com tentativas; RLS por `has_permission` |
| Função `whatsapp-webhook` | Recebe da Meta (confere a assinatura `X-Hub-Signature-256`), grava, responde pela IA ou pelo botão de acesso |
| Função `whatsapp-send` | Envia pela Cloud API (texto, modelo, áudio); chamada pelo gatilho do pedido e pelo painel |
| Gatilho em `orders` | `paid` → entrega; reserva vencendo → lembrete; `delivered` + X dias → pós-venda |
| Aba Automação | Vira 4 abas: Conversas, IA, Mensagens (a tela de hoje) e Relatório |
| Aba APIs | Card do WhatsApp mostra conexão, número e situação dos modelos na Meta |

Segredos (Edge Functions): `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`,
`WHATSAPP_VERIFY_TOKEN`, `ANTHROPIC_API_KEY`.

## Modelos para pedir aprovação na Meta (categoria utilidade)

- **Pagamento confirmado**: "Oi, {{1}}! O pagamento do pedido {{2}} foi confirmado. Toque no botão para receber o
  acesso da conta {{3}}." Botão: Receber meu acesso.
- **Pedido aguardando pagamento**: "Oi, {{1}}! Seu pedido {{2}} da conta {{3}} está reservado até {{4}}. Para
  pagar: {{5}}"
- **Pós-venda**: "Oi, {{1}}! Deu tudo certo com a conta {{2}}? Se precisar de ajuda com a troca de dados, é só
  responder aqui."

## O que depende do Jota

1. Portfólio empresarial na Meta no nome e no CNPJ dele, com a verificação do negócio.
2. Número: o atual (8481225361) em coexistência com o app WhatsApp Business, ou um número novo só da loja.
3. Forma de pagamento cadastrada na Meta e chave da Anthropic com créditos (custos dele, cláusula 6.5).
4. Tom de voz, perguntas frequentes, horário e áudios.
5. Usuário e senha do perfil preenchidos em cada conta (sem isso a entrega sai só com o e-mail).

## Ordem de construção

1. Migration + `whatsapp-send` + gatilho de entrega, com **modo teste** (sem as chaves da Meta, a mensagem fica
   registrada no painel como "seria enviada", para conferir o texto e o fluxo).
2. `whatsapp-webhook` + botão "Receber meu acesso" + página do pedido.
3. IA, aba de configuração e simulador de conversa no painel.
4. Painel de conversas (assumir e devolver), lembrete, pós-venda, relatório.
