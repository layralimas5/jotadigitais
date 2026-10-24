# Pagamentos: InfinitePay (cartão) e Pix Nubank

## Como funciona

- Formas no checkout: **Pix**, **cartão** ou **dividir em dois** (dois cartões, ou cartão + Pix).
  Cada parte vira uma linha em `order_payments`; com todas pagas, o pedido passa sozinho para `paid`.
- **Cartão**: Edge Function `infinitepay` cria um link do Checkout Integrado por parte
  (`order_nsu` = id da parte). A confirmação vem pelo webhook e pela volta do cliente
  (`redirect_url`), e nos dois casos é conferida no `payment_check` da InfinitePay antes de marcar pago.
- **Pix**: o Nubank PJ não tem API. O site gera o código copia e cola (BR Code estático com valor e
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
