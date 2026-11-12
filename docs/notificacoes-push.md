# Painel como app e notificações no celular

O painel (`/admin`) pode ser instalado como app no celular e no computador. Com o aviso ligado, chegam
notificações com som, na tela de bloqueio, mesmo com o painel fechado.

## O que avisa

| Tipo | Quando | Quem recebe |
| --- | --- | --- |
| Venda nova | pedido entra no site | Jota, ajudante com Pedidos |
| Pagamento confirmado | cartão (InfinitePay) ou Pix do C6 confirma sozinho | Jota, ajudante com Pedidos |
| Suporte e pendências | chamado aberto, respondido ou encaminhado para o Jota | Jota (e a Layra, se houver aviso para ela) |
| Segurança | login novo, tentativas bloqueadas | Jota e Layra |
| Privacidade (LGPD) | pedido em Meus dados | Jota |
| Novidades do sistema | função nova | Jota |

Cada pessoa escolhe os tipos em **Configurações > Notificações no celular** (vale para todos os aparelhos dela).
"Som com o painel aberto" é um plim tocado pelo próprio painel quando chega aviso novo no sininho; vale por aparelho.

Marcar um pedido como pago à mão no painel não gera "Pagamento confirmado" (quem marcou já sabe).

## Como funciona

1. Toda linha nova em `notifications` dispara o gatilho `dispatch_push`, que chama a Edge Function `push-send`
   pelo `pg_net` com o segredo `push_send_secret` (Vault). O pedido entra mesmo se o envio falhar.
2. `push-send` lê o aviso, aplica a mesma regra do sininho e as preferências (`push_preferences`) e manda
   Web Push (VAPID) para os aparelhos de `push_subscriptions`. Aparelho que não existe mais (404/410) é apagado.
3. O service worker `public/sw.js` (escopo `/admin`) mostra a notificação; o toque abre a tela do aviso.
4. O manifesto `public/admin.webmanifest` só é colocado na página dentro de `/admin`: o site da loja não vira app.

## Ativar (uma vez)

1. **SQL Editor:** colar o arquivo `colar-no-sql-editor-push.sql` (migration `20261130120000_web_push`,
   segredos do Vault e registro em `schema_migrations`). Precisa vir antes do push da main.
2. **CLI logada** (`npx supabase login`):
   ```sh
   npx supabase secrets set --env-file push-secrets.env
   npx supabase functions deploy push-send --no-verify-jwt
   ```
3. Push da main (a Netlify publica sozinha).

A chave pública VAPID está em `src/app/config.ts` (pode ser trocada por `VITE_VAPID_PUBLIC_KEY`). A privada fica
só nos segredos da função. Trocar o par de chaves invalida os aparelhos inscritos: cada um liga de novo.

## Instalar no aparelho

- **iPhone (iOS 16.4+):** abrir o painel no Safari, Compartilhar, **Adicionar à Tela de Início**, abrir pelo ícone,
  entrar e ligar em Configurações. Sem estar na Tela de Início o iPhone não recebe push.
- **Android:** Chrome, botão **Instalar o painel como app** em Configurações (ou menu, Instalar app), depois
  **Ligar avisos neste aparelho**.
- **Computador:** Chrome ou Edge, mesmo caminho do Android.

Depois de ligar, **Enviar teste** confere o aparelho.

## Conferir

- `select * from net._http_response order by created desc limit 5;` mostra as chamadas do banco para a função.
- Logs da função `push-send` no painel do Supabase mostram falhas de envio por aparelho.
