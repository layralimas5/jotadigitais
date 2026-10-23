# Sistema da Jota Digitais

Painel em `/admin` para o Jota cadastrar contas, publicar depoimentos e acompanhar pedidos.
Tudo o que ele salva aparece no site na hora. A primeira tela é o **Dashboard**.

## Como funciona

- **Contas**: contas monetizadas de TikTok, Instagram e YouTube, cada uma com os números próprios da rede e a
  marcação de monetização (filtro e selo na lista). Facebook continua aceito só nas contas que já existiam.
  O banco recusa dados de uma rede numa conta de outra.
  - **Puxar dados**: na ficha, cole o link do perfil e o sistema preenche nome, @, foto, seguidores e os números
    públicos da rede, com uma análise rápida (médias por vídeo, proporções). Preço, status, horas de exibição do
    YouTube e monetização não são públicos e ficam para preencher à mão. A leitura usa a página pública do perfil
    (`supabase/functions/account-lookup/lookup.ts`): se a rede bloquear, o painel avisa e o cadastro manual segue.
    Em desenvolvimento o próprio Vite responde em `/api/account-lookup`; em produção é a Edge Function `account-lookup`.
  - **Enviar pelo WhatsApp**: botão em cada conta (lista e ficha) monta a mensagem com os números, o preço e o link
    da página da conta. Dá para escolher um contato do CRM ou digitar o número; sem número, o WhatsApp abre para
    escolher a conversa. O texto padrão é o modelo "Oferecer conta", em Automação.
- **Depoimentos**: print enviado pelo painel, reduzido e convertido para WebP no navegador antes do upload.
  A ordem no painel é a ordem da faixa de resultados da home.
- **Pedidos**: o checkout chama a função `place_order`, que cria o pedido e reserva a conta numa operação só.
  A reserva vale 2 horas. Sem pagamento confirmado nesse prazo, a conta volta para a vitrine sozinha.
  - Confirmar pagamento: a conta fica reservada sem prazo.
  - Marcar como entregue: a conta vira vendida.
  - Cancelar: a conta volta para a vitrine.
  - O checkout tem dois passos: primeiro a **ficha completa** (nome, CPF/CNPJ com dígito verificador, nascimento com
    18 anos ou mais, e-mail, WhatsApp, Instagram opcional, cidade e UF), depois o pagamento. `place_order` valida a
    ficha de novo no banco e a grava no próprio pedido (`orders.customer_*`). Só administradores leem; a página
    pública do pedido (`get_order`) continua sem ela.
- **Clientes**: filtro Todos / Do site / Cadastro manual (fica na URL, `?origem=site`). Cliente do site é quem tem
  pedido: a ficha dele é a do último checkout e só pode ser vista, não editada. Cliente manual (comprou por fora)
  exige a mesma ficha completa mais "como chegou"; na ficha dele, "Lançar venda" abre uma receita já ligada a ele,
  que entra no total gasto e em "Vendas por fora". Pedidos antigos, de antes da ficha, aparecem com o aviso.
- **Financeiro**: receitas = pedidos pagos do site + receitas lançadas à mão (tabela `revenues`: venda de conta,
  serviço, comissão, outros). Despesas continuam em `expenses`. Os lançamentos têm filtro Tudo / Receitas / Despesas
  com o total de cada um, e "Receitas por origem" mostra quanto veio do site e de cada categoria. O período usa o
  mesmo filtro do Dashboard (atalhos, mês específico ou intervalo de dias), guardado na URL em `?periodo=`.
- **Topo do painel**: campo de busca (Ctrl+K) que acha telas, contas, pedidos, clientes, contatos do CRM e
  parceiros; e o sininho de notificações. O sininho junta pedidos novos do site (gravados pelo gatilho
  `notify_new_order`), novidades do sistema (tabela `notifications`, só por migration) e lembretes calculados na hora
  (conta paga para entregar, reserva vencendo, retornos do CRM do dia). Cada aviso tem um X; o que cada usuário apaga
  fica em `notification_dismissals` e não some para os outros.
- **APIs e conexões**: cada integração com a situação e o próximo passo, em linguagem simples. O Google Agenda conecta
  pelo login do próprio Google (a permissão fica só na memória do navegador, cerca de 1 hora; a cada visita, um clique em
  "Abrir agenda"). Mostra os próximos 7 dias e manda os retornos do CRM como compromissos de dia inteiro, sem duplicar.
- **Dashboard**: faturamento, lucro e vendas finalizadas do mês, o que está pendente (pagamento, entrega,
  retorno do CRM), estoque por rede, gráfico dos últimos 30 dias e os últimos pedidos.
- **Finalizados**: pedidos entregues. A data de entrega (`orders.delivered_at`) é gravada pelo banco ao marcar
  como entregue, e a garantia conta a partir dela com o prazo definido em **Site**. A aba "Entregues" saiu de Pedidos.
- **Parceiros**: quem fornece contas. Cada conta pode ter um parceiro (`accounts.partner_id`); a comissão é a
  porcentagem do parceiro sobre as vendas finalizadas das contas dele. Apagar o parceiro deixa as contas como da loja.
  Ainda não há registro de repasse pago: o total mostrado é sobre todas as vendas finalizadas.
- **E-mails**: e-mail, senha e dados de recuperação das contas que o Jota está crescendo (`email_accounts`). A senha
  entra pela coluna `password` e um gatilho grava só a versão cifrada (mesma chave do Vault do CPF); o painel lê
  aberta por `password_plain`, só para administrador, e a lista nem pede essa coluna (usa `has_password`). Cada
  e-mail pode ficar ligado a uma conta do estoque. Fica fora do backup de propósito, para a senha não sair num JSON.
- **Site**: duas abas. "Textos e imagens" edita todo o texto do site (topo, problema com os dois prints, destaques,
  como funciona, resultados, garantia, dúvidas, chamada final, rodapé, convite do WhatsApp, termos e SEO da home)
  com a prévia do site real ao lado, em tamanho de computador ou celular. A prévia é o próprio site aberto num
  iframe com `?preview=1`, recebendo o rascunho por `postMessage` (só da mesma origem). Nada vai para o ar antes de
  "Salvar e publicar"; sair da tela com alteração pendente pede confirmação. O conteúdo fica numa linha só da tabela
  `site_content` (JSON, leitura pública, escrita só de admin) e é validado por `siteContentSchema`; campo que faltar
  ou vier inválido cai no texto original (`DEFAULT_SITE_CONTENT` em `src/domain/site-content.ts`). Marcadores:
  `{dias}`, `{instagram}` e `{seguidores_shop}`. "Contato e garantia" é a tela antiga (WhatsApp, Instagram, prazo).
  Na prévia, todo texto e imagem é clicável: o clique abre a seção certa com o campo focado, e focar um campo
  destaca o elemento na prévia. Os elementos são marcados com `editable("caminho")` (`data-edit`, só dentro do
  editor; o site público não leva o atributo). O crédito "Desenvolvido por Layra Lima" no rodapé é fixo no código,
  sem campo no editor e sem clique na prévia.
- **Configurações** (`/admin/configuracoes`, também no menu do usuário): perfil (nome pela função `update_my_profile`,
  e-mail pelo Supabase Auth, que só troca depois do clique no link enviado ao e-mail novo), troca de senha pedindo a
  senha atual, link de redefinição por e-mail para você ou outra pessoa da equipe, e backup. Quem chega pelo link de
  "esqueci a senha" cai aqui e cria a senha nova sem informar a antiga. O backup baixa um JSON com contas, pedidos,
  clientes, leads, parceiros, despesas, depoimentos, modelos de mensagem, dados do site e a lista de usuários (sem
  senhas; fotos como link). Ainda não há restauração pelo painel. `/admin/minha-conta` redireciona para cá.
- **Usuários**: quem entra no sistema, todos com acesso completo. Cada um tem um papel (`admin_users.role`: Admin ou Desenvolvedora), que só identifica a pessoa no perfil, no menu do topo e na lista; o papel se troca pelo SQL, nunca pelo painel. A lista vem da função `list_admin_users`.
  Criar e tirar acesso passa pela Edge Function `admin-users`, que usa a chave de serviço do Supabase (nunca vai
  para o navegador) e confere se quem pede é administrador. Ninguém tira o próprio acesso e o sistema nunca fica
  sem usuário.
- **Segurança**: a chave pública do Supabase só lê o que a vitrine mostra. Escrever exige login de um usuário
  que esteja na tabela `admin_users` (RLS em todas as tabelas). Pedidos não são legíveis pelo público; a página
  de confirmação usa `get_order`, que devolve o e-mail mascarado.

## Modo demonstração

Sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, site e painel rodam com dados no `localStorage` do navegador
(estoque fictício nas quatro redes). O painel abre direto, sem login, e o topo do site mostra o ícone do
sistema. A lista de Usuários existe só para mostrar a tela: sem banco ninguém entra com ela. Serve para mostrar e testar, não para produção: cada navegador tem os próprios dados.
Com o Supabase ligado, o ícone some do site e o painel volta a exigir login.

## Ligar o Supabase (uma vez)

1. Criar um projeto no Supabase, de preferência na conta do Jota (região São Paulo).
2. Vincular e aplicar as migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-do-projeto>
   npx supabase db push
   ```
3. Em **Authentication > Providers > Email**, desligar "Allow new users to sign up". Em **Authentication > URL
   Configuration**, pôr o endereço do site em "Site URL" e `https://<dominio>/admin/configuracoes` (e
   `http://localhost:5210/admin/configuracoes` para testar) em "Redirect URLs": é para onde voltam os links de
   redefinir senha e confirmar e-mail novo.
4. Em **Authentication > Users**, criar o usuário do Jota (e-mail e senha).
5. No **SQL Editor**, dar acesso de admin:
   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'email-do-jota@exemplo.com';
   ```
6. Copiar **Project URL** e **anon public key** (Project Settings > API) para o `.env` local e para as
   variáveis de ambiente da hospedagem:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
7. Publicar as funções do servidor (Usuários cria e remove acessos; account-lookup puxa os dados pelo link da conta):
   ```bash
   npx supabase functions deploy admin-users
   npx supabase functions deploy account-lookup
   ```
8. Entrar em `/admin` e cadastrar o estoque real. Os 6 depoimentos atuais já entram pela migration.
9. Em **Site**, preencher WhatsApp do suporte, Instagram e dias de garantia. Com o banco ligado,
   o site usa o que estiver salvo ali (a tabela `store_settings` nasce com o WhatsApp vazio).

## Ligar o Google Agenda (uma vez)

1. Em console.cloud.google.com, com a conta Google do Jota, criar o projeto "Jota Digitais".
2. Em **APIs e serviços > Biblioteca**, ativar a **Google Calendar API**.
3. Em **Tela de permissão OAuth**: tipo "Externo", nome e e-mail; em **Usuários de teste**, adicionar o Gmail do Jota.
   (Enquanto o app estiver em teste, o Google mostra um aviso de "app não verificado" no primeiro acesso.)
4. Em **Credenciais > ID do cliente OAuth**: tipo "Aplicativo da Web"; em **Origens JavaScript autorizadas**, o endereço
   do site no ar e `http://localhost:5210`.
5. Colocar o ID em `VITE_GOOGLE_CLIENT_ID` no `.env` e na hospedagem, e publicar de novo.

A própria aba APIs mostra esse passo a passo enquanto o ID não estiver configurado.

## Testes

- `npm run db:test`: aplica as migrations num Postgres em memória (PGlite) e verifica RLS, reserva, prazo,
  transições de pedido, parceiros, data de entrega, lista de usuários e storage.
- `npm run typecheck` e `npm run build`.

## Próximos passos

- Gateway de pagamento real (Pix e cartão) na porta `PaymentGateway`, confirmando o pedido por webhook.
- E-mail automático para o cliente e aviso para o Jota quando entra pedido.
- Registrar repasses pagos aos parceiros (hoje o painel mostra só a comissão calculada).
- Guardar login e senha da conta para entrega automática (exige criptografia e cuidado com acesso).
