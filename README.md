# Jota Digitais

Loja de contas de TikTok, Instagram, YouTube e Facebook, com painel para o Jota cadastrar o estoque,
publicar depoimentos e acompanhar pedidos.

## Rodar

```bash
npm install
cp .env.example .env   # WhatsApp de suporte e, quando houver, as chaves do Supabase
npm run dev            # http://localhost:5210  (painel em /admin)
npm run build          # typecheck + build de produção
npm run db:test        # testa as migrations do banco num Postgres em memória
```

Sem as chaves do Supabase o projeto roda em **modo demonstração**, com os dados no navegador.
Para ligar o banco de verdade, siga [docs/sistema.md](docs/sistema.md).

## Stack

React 19 + TypeScript strict + Vite + Tailwind CSS 4 + Framer Motion + React Router + zod.
Backend no Supabase (Postgres com RLS, Auth e Storage).

## Estrutura

```
src/
  domain/          entidades e regras (conta por rede social, depoimento, pedido, erros)
  application/     portas (interfaces), schemas zod, casos de uso da loja e do painel
  infrastructure/  supabase/ (produção), demo/ (navegador) e pagamento pendente
  app/             container (escolhe Supabase ou demo pelas variáveis), config e rotas
  ui/              loja (páginas, seções, componentes) e admin/ (painel)
supabase/
  migrations/      tabelas, RLS, funções de pedido e bucket de imagens
scripts/
  db-test.mjs      testes do banco
```

As telas só falam com os casos de uso. Trocar o backend é trocar a implementação em `app/container.ts`.

## Páginas

- `/` home (hero, problema, contas em destaque, como funciona, resultados, garantia, dúvidas)
- `/contas` vitrine com busca, filtro por rede social e faixa de seguidores, ordenação (estado na URL)
- `/contas/:slug` detalhe da conta, com ficha técnica própria de cada rede
- `/checkout/:slug` dados do comprador + forma de pagamento (reserva a conta por 2 horas)
- `/pedido/:code` confirmação do pedido
- `/termos` termos de compra e garantia
- `/admin` painel: contas, depoimentos, pedidos, configurações da loja (WhatsApp, Instagram, garantia) e minha conta (login obrigatório)

## O que ainda é provisório

| Item | Hoje | Próximo passo |
|---|---|---|
| Banco | Pronto nas migrations, projeto Supabase ainda não criado | Criar o projeto e seguir `docs/sistema.md` |
| Pagamento | `PendingPaymentGateway` registra o pedido sem cobrar; o Jota confirma no painel | Gateway real (Pix + cartão 12x) com webhook de confirmação |
| Entrega por e-mail | Só o texto da tela de confirmação | E-mail transacional após a confirmação do pagamento |
| Garantia | 7 dias, troca ou reembolso (texto provisório) | Confirmar a política real com o cliente |
| Copy da home | Ainda fala só de TikTok Shop | Ajustar se a oferta principal passar a ser multirrede |
| Logo | Recriado em código a partir do Canva | Substituir pelo arquivo oficial se existir |
