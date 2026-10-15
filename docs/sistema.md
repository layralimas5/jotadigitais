# Sistema da Jota Digitais

Painel em `/admin` para o Jota cadastrar contas, publicar depoimentos e acompanhar pedidos.
Tudo o que ele salva aparece no site na hora. A primeira tela é o **Dashboard**.

## Como funciona

- **Contas**: cada conta tem rede (TikTok, Instagram, YouTube, Facebook) e os números próprios dela.
  O banco recusa dados de uma rede numa conta de outra.
- **Depoimentos**: print enviado pelo painel, reduzido e convertido para WebP no navegador antes do upload.
  A ordem no painel é a ordem da faixa de resultados da home.
- **Pedidos**: o checkout chama a função `place_order`, que cria o pedido e reserva a conta numa operação só.
  A reserva vale 2 horas. Sem pagamento confirmado nesse prazo, a conta volta para a vitrine sozinha.
  - Confirmar pagamento: a conta fica reservada sem prazo.
  - Marcar como entregue: a conta vira vendida.
  - Cancelar: a conta volta para a vitrine.
- **Dashboard**: faturamento, lucro e vendas finalizadas do mês, o que está pendente (pagamento, entrega,
  retorno do CRM), estoque por rede, gráfico dos últimos 30 dias e os últimos pedidos.
- **Finalizados**: pedidos entregues. A data de entrega (`orders.delivered_at`) é gravada pelo banco ao marcar
  como entregue, e a garantia conta a partir dela com o prazo definido em **Site**. A aba "Entregues" saiu de Pedidos.
- **Parceiros**: quem fornece contas. Cada conta pode ter um parceiro (`accounts.partner_id`); a comissão é a
  porcentagem do parceiro sobre as vendas finalizadas das contas dele. Apagar o parceiro deixa as contas como da loja.
  Ainda não há registro de repasse pago: o total mostrado é sobre todas as vendas finalizadas.
- **Site**: contato, garantia e atalhos do conteúdo do site (antiga Configurações; `/admin/configuracoes` redireciona).
- **Usuários**: quem entra no sistema, todos com acesso completo. A lista vem da função `list_admin_users`.
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
3. Em **Authentication > Providers > Email**, desligar "Allow new users to sign up".
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
7. Publicar a função de usuários (cria e remove acessos pela aba Usuários):
   ```bash
   npx supabase functions deploy admin-users
   ```
8. Entrar em `/admin` e cadastrar o estoque real. Os 6 depoimentos atuais já entram pela migration.
9. Em **Site**, preencher WhatsApp do suporte, Instagram e dias de garantia. Com o banco ligado,
   o site usa o que estiver salvo ali (a tabela `store_settings` nasce com o WhatsApp vazio).

## Testes

- `npm run db:test`: aplica as migrations num Postgres em memória (PGlite) e verifica RLS, reserva, prazo,
  transições de pedido, parceiros, data de entrega, lista de usuários e storage.
- `npm run typecheck` e `npm run build`.

## Próximos passos

- Gateway de pagamento real (Pix e cartão) na porta `PaymentGateway`, confirmando o pedido por webhook.
- E-mail automático para o cliente e aviso para o Jota quando entra pedido.
- Registrar repasses pagos aos parceiros (hoje o painel mostra só a comissão calculada).
- Guardar login e senha da conta para entrega automática (exige criptografia e cuidado com acesso).
