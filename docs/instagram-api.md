# Instagram pela API oficial da Meta

O "Puxar dados" do Instagram tenta primeiro a API oficial (Business Discovery): seguidores exatos, posts,
nome, bio, foto e as 3 capas mais recentes. Ela só lê contas **comerciais ou de criador**. Conta pessoal,
token vencido ou limite de uso fazem a busca seguir pelo caminho antigo (página pública), sem erro na tela.
"Seguindo" não vem pela API.

O token pode ser de **qualquer** conta profissional do Instagram ligada a uma Página do Facebook. Não precisa
ser do Jota: hoje é da conta da desenvolvedora.

## Configurar (uma vez)

1. Instagram profissional (comercial ou criador) ligado a uma Página do Facebook.
2. developers.facebook.com > Meus apps > Criar app (caso de uso "Outro", tipo "Empresa").
3. No app, adicionar o produto Instagram, opção "API com Login do Facebook".
4. Ferramentas > Explorador da API do Graph: escolher o app, adicionar `instagram_basic`, `pages_show_list`,
   `pages_read_engagement` e `business_management`, gerar o token e autorizar a Página e o Instagram.
5. Ícone ⓘ do token > Abrir na ferramenta de token de acesso > Estender token de acesso. Copiar o token novo.
6. No Explorador: `me/accounts?fields=name,instagram_business_account`. O `instagram_business_account.id` é o
   `META_IG_USER_ID`.
7. Gravar os secrets e publicar a função:

```sh
npx supabase secrets set META_IG_USER_ID=<id> META_ACCESS_TOKEN=<token estendido>
npx supabase functions deploy account-lookup
```

Em desenvolvimento, as mesmas duas variáveis em `.env.local` ligam a API no servidor do Vite.

## Renovar

O token estendido vale cerca de 60 dias. Quando vencer, a busca volta ao caminho antigo e o log da função
mostra `instagram graph: 400 code=190`. Repetir os passos 4 e 5 e o `secrets set` do passo 7 (não precisa
publicar a função de novo).
