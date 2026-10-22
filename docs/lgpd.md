# LGPD na Jota Digitais

O que existe, como publicar uma versão nova dos documentos e o que ainda depende do Jota.
Não é parecer jurídico: antes de lançar, um advogado de proteção de dados deve revisar os textos.

## O que está no ar

| Peça | Onde |
|---|---|
| Política de Privacidade | `/politica-de-privacidade`, texto em `src/domain/legal/privacy-policy.json` |
| Termos de Uso (inclui compra, garantia e reembolso) | `/termos-de-uso`, texto em `src/domain/legal/terms-of-use.json`. `/termos` redireciona |
| Dados do controlador | `src/domain/legal/controller.json` (nulo = aparece `[preencher: ...]` no site) |
| Aceite no checkout | caixa não marcada com link para os dois documentos |
| Prova do aceite | tabela `consent_records`: versão, SHA-256, data/hora, IP e navegador, gravados pelo `place_order` |
| Banner de cookies | aceitar todos, rejeitar não essenciais ou configurar; reabre por "Preferências de cookies" no rodapé |
| Meus dados | `/meus-dados`: e-mail + código do pedido, mostra tudo, baixa JSON e abre solicitação (11 tipos, prazo de 15 dias) |
| Painel | `/admin/privacidade`: responder ou recusar solicitações, anonimizar titular e aplicar os prazos de retenção |

Ferramenta analítica ou de marketing nova (Pixel, GA) só pode carregar quando
`useCookieConsent().allows("analytics" | "marketing")` for verdadeiro. Ao incluir uma, suba
`COOKIE_CONSENT_VERSION` em `src/domain/cookie-consent.ts` para o aviso aparecer de novo para todos,
e atualize a seção 12 da Política.

## Aplicar a migration no Supabase

`supabase/migrations/20261026120000_lgpd.sql`: cole no SQL Editor e rode. Depois registre:

```sql
insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20261026120000', 'lgpd', '{}');
```

Sem essa migration, o checkout do site novo falha (o `place_order` passou a exigir o aceite).
Por isso, aplicar a migration **antes** de publicar o site.

### Retenção automática (opcional)

Para não depender do botão do painel, agende no SQL Editor (precisa da extensão `pg_cron` ligada em Database > Extensions):

```sql
select cron.schedule('lgpd-retencao', '0 6 1 * *', $$select public.run_retention_policy()$$);
```

## Publicar uma versão nova dos documentos

Vale para qualquer mudança no texto **e** para o preenchimento de `controller.json`
(os dados do controlador entram no hash).

1. Edite o JSON e suba `version` (ex.: 1.0.0 para 1.1.0), `effectiveDate` e acrescente a linha em `history`.
2. Rode `node scripts/legal-hashes.mjs` e copie o `insert`.
3. Crie uma migration nova com esse `insert into public.legal_documents ...` (só as linhas que mudaram).
4. `npm run db:test` confere que a migration tem o hash atual.
5. Aplique a migration e publique o site **juntos**: o checkout só aceita a versão mais recente do banco.

Mudança relevante precisa de aviso prévio (Termos, seção 11: 15 dias; Política, seção 16).

## Pendências do controlador

- [ ] Preencher `controller.json`: razão social, CNPJ/CPF, endereço, e-mail de contato, e-mail de privacidade, encarregado (nome e e-mail), empresa de pagamento e emissor de nota.
- [ ] Revisão por advogado especializado antes de publicar.
- [ ] Confirmar os prazos de retenção da seção 8 da Política (são sugestões defensáveis, não regra fechada).
- [ ] Marco Civil, art. 15: guardar 6 meses de registros de acesso. Hoje ficam só os logs da Netlify e do Supabase, com retenção curta no plano gratuito. Opções: plano com retenção maior ou exportar os logs.
- [ ] Autorização por escrito de quem aparece nos prints de depoimento (Marina, Taah e os próximos).
- [ ] Acordo de tratamento de dados (DPA) aceito em Supabase, Netlify e Google, e conferir as cláusulas-padrão da Resolução CD/ANPD nº 19/2024.
- [ ] Confirmar o processo de entrega: a conta sai sem e-mail e telefone do dono anterior (os Termos, seção 3, pedem que o comprador apague dados de terceiros).
- [ ] SMTP do Gmail do Jota, para responder solicitações e avisar mudanças por e-mail.
