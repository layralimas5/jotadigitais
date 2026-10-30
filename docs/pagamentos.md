# Pagamentos: InfinitePay (cartão) e Pix C6 (automático)

## Como funciona

- Formas no checkout: **Pix**, **cartão** ou **dividir em dois** (dois cartões, ou cartão + Pix).
  Cada parte vira uma linha em `order_payments`; com todas pagas, o pedido passa sozinho para `paid`.
- **Cartão**: Edge Function `infinitepay` cria um link do Checkout Integrado por parte
  (`order_nsu` = id da parte). A confirmação vem pelo webhook e pela volta do cliente
  (`redirect_url`), e nos dois casos é conferida no `payment_check` da InfinitePay antes de marcar pago.
- **Pix automático (C6 Bank)**: ao abrir o pedido, a Edge Function `c6-pix` cria uma cobrança imediata
  (`PUT /v2/pix/cob/{txid}`, txid = id da parte sem hífens, vence junto com a reserva do pedido) e o site mostra
  o QR Code e o copia e cola do C6. A confirmação vem pelo webhook do C6 e pela própria página do pedido, que
  confere a cada 5 s; nos dois casos a função consulta `GET /v2/pix/cob/{txid}` e só marca pago com a cobrança
  `CONCLUIDA` e o valor inteiro recebido (`confirm_c6_pix_payment`). O painel mostra "Pago via Pix (C6)" com o
  ID do Pix (endToEndId). O webhook da chave é cadastrado sozinho na primeira cobrança.
- **Pix de reserva (Nubank)**: se o C6 não responder (sem certificado, fora do ar), o site volta ao QR Code
  estático abaixo e o Jota confirma à mão. O Nubank PJ não tem API. O site gera o código copia e cola (BR Code estático com valor e
  o código do pedido como txid) a partir da chave salva em `store_settings`. O Jota confirma em
  Pedidos > "Confirmar Pix recebido".
- Pedido marcado como pago à mão em Pedidos dá as partes como pagas; cancelado fecha as abertas.

Referência da API: https://www.infinitepay.io/checkout-documentacao

## Publicar (nesta ordem)

1. Migrations no Supabase: `20261028120000_email_vault`, `20261029120000_customer_referrals`,
   `20261030120000_split_payments`. Sem elas o site novo não carrega as configurações da loja nem
   fecha pedido.
2. Segredos da função (o `SUPABASE_URL` e a service role já existem):
   ```
   npx supabase secrets set INFINITEPAY_HANDLE=<infinitetag sem o $> SITE_URL=https://<dominio do site>
   ```
3. Deploy da função, sem exigir token (o webhook da InfinitePay não manda o JWT do Supabase):
   ```
   npx supabase functions deploy infinitepay --no-verify-jwt
   ```
4. Push da main (Netlify publica o site).
5. No painel: Site > Contato > Pix (chave, nome até 25 letras, cidade até 15). Sem os três, o Pix
   some do checkout e só o cartão aparece.

## Testar depois de publicar

- Pedido de valor baixo no cartão: o link abre, depois de pagar a página do pedido mostra "Pago".
- Pedido cartão + Pix: Pix aparece com QR; ler o QR num app de banco deve mostrar o valor e o
  recebedor certos; confirmar em Pedidos deixa o pedido pago.
- A resposta exata do endpoint `/links` não está documentada: a função aceita `url`, `link` ou
  `checkout_url`. Se a InfinitePay devolver outro nome, o log da função mostra as chaves recebidas.

## Ligar o Pix do C6 (nesta ordem)

1. Migration `20261102120000_c6_pix` no SQL Editor (com o insert em `supabase_migrations.schema_migrations`).
   Antes de publicar o site: o painel novo lê as colunas `pix_copy_paste` e `pix_end_to_end_id`.
2. Segredos em Edge Functions > Secrets:
   - `C6_CLIENT_ID` e `C6_CLIENT_SECRET` (gravados em 30/10).
   - `C6_CERT` e `C6_KEY`: conteúdo do certificado e da chave privada do portal do C6. Se o painel estragar as
     quebras de linha, colar o arquivo em base64 (`base64 -w0 arquivo.crt`).
   - `C6_PIX_KEY`: a chave Pix cadastrada na conta C6 do Jota.
   - `C6_ENV=sandbox` só para testar no ambiente de testes do C6; sem ele vale produção.
3. `npx supabase functions deploy c6-pix --no-verify-jwt` (o webhook do C6 não manda token do Supabase).
4. Push da main.

Teste: pedido Pix de valor baixo, pagar pelo app do banco. Em até 5 s a página do pedido mostra "Pago" e
Pedidos mostra "Pago via Pix (C6)". Se a página ficar no QR Code estático, o log da função `c6-pix` diz o motivo.

A API do C6 exige mTLS em tudo. A função usa `Deno.createHttpClient({ cert, key })`; o contrato da cob segue o
padrão Bacen e foi conferido com SDKs de terceiros, não com a documentação oficial do C6. Se o C6 responder
diferente, o erro aparece no log da função.
