# Jota Digitais

Loja de contas de TikTok com a Central de Criadores do TikTok Shop já liberada.

## Rodar

```bash
npm install
cp .env.example .env   # opcional: número do WhatsApp de suporte
npm run dev            # http://localhost:5210
npm run build          # typecheck + build de produção
```

## Stack

React 19 + TypeScript strict + Vite + Tailwind CSS 4 + Framer Motion + React Router + zod.

## Estrutura

```
src/
  domain/          entidades e regras (conta, pedido, dinheiro, erros)
  application/     portas (interfaces), validação do checkout e casos de uso
  infrastructure/  implementações das portas (estoque em memória, pedidos no localStorage, pagamento pendente)
  app/             container de dependências, config e rotas
  ui/              componentes, hooks, seções da home e páginas
```

As páginas só falam com os casos de uso pelos hooks em `ui/hooks/useStore.ts`. Trocar o
backend é trocar a implementação em `app/container.ts`.

## Páginas

- `/` home (hero, problema, contas em destaque, como funciona, resultados, garantia, dúvidas)
- `/contas` vitrine com busca, filtro por nicho e faixa de seguidores, ordenação (estado na URL)
- `/contas/:slug` detalhe da conta
- `/checkout/:slug` dados do comprador + forma de pagamento
- `/pedido/:code` confirmação do pedido
- `/termos` termos de compra e garantia

## O que ainda é provisório

| Item | Hoje | Próximo passo |
|---|---|---|
| Estoque | `infrastructure/seed/accounts.ts`, perfis e preços fictícios | Tabela no Supabase + painel para cadastrar contas |
| Pagamento | `PendingPaymentGateway` registra o pedido sem cobrar | Implementar `PaymentGateway` com o gateway escolhido (Pix + cartão 12x) e webhook de confirmação |
| Entrega por e-mail | Só o texto da tela de confirmação | Enviar login/senha após o webhook de pagamento, via serviço de e-mail transacional |
| Pedidos | `localStorage` do navegador | Tabela de pedidos com RLS |
| Garantia | 7 dias, troca ou reembolso (texto provisório) | Confirmar a política real com o cliente |
| Logo | Recriado em código a partir do Canva | Substituir pelo arquivo oficial se existir |
