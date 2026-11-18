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
| Aba WhatsApp (nova) | Caixa de entrada das conversas: assumir, devolver para a IA, resumo da passagem |
| Aba Automação | Configuração: Entrega automática, IA, Mensagens (a tela de hoje) e Relatório |
| Aba APIs | Card do WhatsApp mostra conexão, número e situação dos modelos na Meta |

## Navegação: WhatsApp e Automação conectadas (decidido em 17/11)

Duas abas no sidebar, que funcionam como um módulo só:

- **WhatsApp** (grupo Pessoas, depois de CRM; ícone `MessageCircle`): uso diário. Lista de conversas com filtro
  por tipo (interessado, cliente, afiliado, aluno), situação (com a IA, com o Jota) e não lidas. Badge com o
  número de conversas esperando o Jota. No celular entra na barra de baixo no lugar do CRM.
- **Automação** (continua onde está, descrição "IA e mensagens do WhatsApp"): configuração.

Como ficam conectadas:

- **Mesma área de permissão** (`automation`): quem vê uma vê a outra. Se um dia o Jota tiver atendente que só
  conversa, aí separa uma área `whatsapp` só para as conversas.
- **Faixa de status igual no topo das duas**: automação ligada ou desligada (com o botão), modo teste ou ao vivo,
  horário de funcionamento. Ligar e desligar por uma reflete na outra (mesmo `whatsapp_settings`).
- **Atalhos de ida e volta**:
  - WhatsApp → Automação: botão "Configurar IA" no cabeçalho; na conversa, "Ensinar essa resposta" vira uma
    pergunta frequente nova já preenchida; "Enviar áudio" abre os áudios cadastrados.
  - Automação → WhatsApp: no simulador da IA, "Ver conversas reais"; no Relatório, cada pergunta frequente e cada
    venda originada abre a conversa de origem; em Entrega automática, cada envio abre a conversa do cliente.
- **Pedidos e Clientes** ganham "Abrir no WhatsApp", que vai para a conversa do painel (não para o wa.me) quando
  ela existir.

Segredos (Edge Functions): `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`,
`WHATSAPP_VERIFY_TOKEN`, `ANTHROPIC_API_KEY`.

## Modelos para pedir aprovação na Meta (categoria utilidade)

- **Pagamento confirmado** (`pagamento_confirmado`, pt_BR; texto idêntico ao de `paymentPromptText` em
  `supabase/functions/_shared/whatsapp-delivery.ts`): "Oi, {{1}}! O pagamento do pedido {{2}} foi confirmado.
  Toque em *Receber meu acesso* para receber os dados de {{3}} aqui no WhatsApp." Botão de resposta rápida:
  Receber meu acesso. Exemplos: Bruna / JD-ABC123 / @conta.exemplo.
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

## Fase 1 pronta: entrega em modo teste

- Migration `20261213120000_whatsapp_delivery`: `whatsapp_settings` (liga e desliga pelo painel; `mode` só pelo
  SQL), `whatsapp_messages` (fila e registro, escrita só pela função), `whatsapp_delivery_items` (login aberto, só
  `service_role`) e o gatilho `queue_whatsapp_payment` em `orders`.
- Função `whatsapp-send`: em `mode = 'test'` grava o aviso de pagamento e o acesso de cada conta com as senhas
  mascaradas; em `mode = 'live'` manda o modelo `pagamento_confirmado` pela Cloud API.
- Painel: Automação ganhou as abas **Entrega automática** (modo, liga e desliga, últimos envios) e **Mensagens**.
- Textos compartilhados entre painel e função em `supabase/functions/_shared/` (`message-template.ts`,
  `whatsapp-delivery.ts`); `src/domain` reexporta.
- Testes: `npm run db:test`, seção "entrega automática pelo WhatsApp".

### Ativar (uma vez)

1. **SQL Editor:** colar `colar-no-sql-editor-whatsapp.sql` (migration, segredos do Vault e registro em
   `schema_migrations`). Precisa vir antes do push da main.
2. **CLI logada** (`npx supabase login`):
   ```sh
   npx supabase secrets set --env-file whatsapp-secrets.env
   npx supabase functions deploy whatsapp-send --no-verify-jwt
   ```
3. Apagar os dois arquivos acima (têm o segredo; estão no `.gitignore`) e fazer o push da main.
4. Testar: um pedido com WhatsApp marcado como pago no painel aparece em Automação > Entrega automática.

### Ligar de verdade (quando a Meta estiver pronta)

1. Aprovar o modelo `pagamento_confirmado` na Meta com o texto exato acima.
2. `npx supabase secrets set WHATSAPP_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=...`
3. SQL: `update public.whatsapp_settings set mode = 'live';`
4. Fase 2 (webhook do botão) precisa estar no ar antes disso, senão o toque em "Receber meu acesso" não responde.

## Fases 3 e 4 prontas em modo teste: IA, aba WhatsApp e Automação > IA (17/11)

- Migration `20261214120000_whatsapp_ai`: configuração da IA em `whatsapp_settings` (começa **desligada**), `whatsapp_faq`
  (já com as dúvidas do site), `whatsapp_contacts`, `whatsapp_chat`, `whatsapp_register_inbound` (registro atômico, sem
  duplicar reenvio da Meta) e o aviso `whatsapp` no sininho/push.
- Funções: `whatsapp-webhook` (Meta, assinatura conferida) e `whatsapp-panel` (simulador, resposta do Jota e "Simular
  cliente" no modo teste). Código comum em `_shared/whatsapp-ai.ts`, `whatsapp-inbound.ts`, `whatsapp-cloud.ts` e
  `whatsapp-schedule.ts` (este também usado pelo painel).
- IA: Claude Haiku 5.5 (`@anthropic-ai/sdk@1.9.0`), esforço baixo, prompt fixo com cache. Ferramentas: `buscar_contas`,
  `situacao_pedido` (só para o dono do número) e `passar_para_atendente`. "parar" desliga as automáticas; "voltar" religa.
- Painel: aba **WhatsApp** (Pessoas, barra de baixo no lugar do CRM, contador de conversas esperando o Jota) e
  Automação > **IA de atendimento** (boas-vindas, tom, instruções, perguntas frequentes, horário, números ignorados e
  simulador que usa o rascunho sem salvar). Faixa de status igual nas duas abas, com o liga e desliga da IA.
- Testes: `npm run db:test`, seção "atendimento com IA do WhatsApp". A falha "desenvolvedora apaga os arquivos do chamado
  no bucket" já existia na main.

### Ativar (depois da fase 1)

1. SQL Editor: a migration `20261214120000_whatsapp_ai.sql` (e registrar em `schema_migrations`).
2. `npx supabase secrets set ANTHROPIC_API_KEY=... SITE_URL=https://jotadigitais.com.br`
3. `npx supabase functions deploy whatsapp-panel` e `npx supabase functions deploy whatsapp-webhook --no-verify-jwt`
4. Testar: Automação > IA de atendimento > Testar a IA; depois WhatsApp > Simular cliente com a IA ligada.

### Ligar na Meta (junto com o "Ligar de verdade" da fase 1)

1. Segredos `WHATSAPP_VERIFY_TOKEN` (inventado por nós) e `WHATSAPP_APP_SECRET` (do app na Meta).
2. No app da Meta, Webhook: URL `https://<projeto>.supabase.co/functions/v1/whatsapp-webhook`, o mesmo verify token,
   assinar o campo `messages`.

### Falta

- Botão "Receber meu acesso" entregar o login (fase 2): hoje o toque chega como mensagem comum para a IA.
- Áudios gravados, lembrete de pedido não pago, pós-venda e a aba Relatório.
- "Abrir no WhatsApp" de Pedidos e Clientes levar para a conversa do painel.

## Fluxos: o roteiro da IA (WhatsApp > Fluxos, 17/11)

Quadro de arrastar (React Flow 12.12.1) onde o Jota desenha o passo a passo do atendimento. **O fluxo não roda
sozinho: ele vira o roteiro que a IA segue.** A IA conduz pelos passos e, se o cliente perguntar algo fora do
roteiro, responde com as regras e as perguntas frequentes e volta ao passo em que parou. Com a IA desligada, nada é
automático (as mensagens esperam o Jota).

- Blocos: Início, Mensagem do cliente (o que o cliente diz; a IA reconhece pela ideia), Mensagem (mandada como está),
  Pergunta (opções viram botões pela ferramenta `mostrar_opcoes`; até 3 botões, mais que isso lista), Condição
  (cliente, afiliado, aluno, horário da loja), Conversa livre, Chamar o Jota e Fim.
- Edição dentro do próprio bloco; "Testar fluxo" abre a conversa de teste com a IA usando o fluxo da tela (mesmo sem
  salvar). Saídas comuns podem abrir vários caminhos; opção, Sim/Não e "Outra resposta" levam a um lugar só.
- `supabase/functions/_shared/whatsapp-flow.ts`: `flowPlaybook` transforma o grafo em passos numerados;
  `whatsapp-ai.ts` põe os fluxos ligados no prompt (seção "Roteiro de atendimento") e manda o tipo do contato e o
  horário da loja junto com a conversa.
- Tabela `whatsapp_flows` (migration `20261215120000_whatsapp_flows.sql`), RLS por `automation`.
- WhatsApp e Automação viraram uma aba só (`/admin/whatsapp?aba=conversas|fluxos|ia|entrega|mensagens`);
  `/admin/automacao` redireciona. A aba Fluxos abre em modo foco (menu lateral encolhido, largura toda).

### Ativar

1. Migration `20261215120000_whatsapp_flows.sql`.
2. Publicar de novo a `whatsapp-webhook` e a `whatsapp-panel`.
3. Em WhatsApp > Fluxos, "Começar pelo modelo pronto", ajustar os textos, testar e ligar.

### Falta

- Atendimento ativo (a loja chama primeiro): modelos aprovados na Meta, gatilhos de pedido não pago, pós-venda e
  garantia acabando, e o agendador (pg_cron).
