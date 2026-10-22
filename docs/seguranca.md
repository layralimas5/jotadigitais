# Segurança da Jota Digitais

O que protege o sistema, como publicar a migration de segurança e o que conferir no painel do Supabase.
Varredura completa feita em 22/10/2026 (40 itens). Rodar de novo antes de cada release, depois de criar
tabela nova e depois de integrar serviço de terceiro.

## O que existe

| Proteção | Onde |
|---|---|
| RLS em todas as tabelas, políticas separadas por operação | migrations; tabela nova no `public` nasce com RLS (gatilho `enforce_rls_on_new_tables`) e sem acesso para a chave anon |
| Admin só com sessão válida | `is_admin()`: sessão de até 7 dias, encerrada no "Sair" deixa de valer na hora, código do app para quem ligou as duas etapas |
| Verificação em duas etapas (TOTP) | Configurações > Verificação em duas etapas; o login pede o código depois da senha |
| CPF/CNPJ cifrado | `pgcrypto` com a chave `pii_encryption_key` no Vault. O painel lê por `customer_document_plain` e `document_plain` (só admin) |
| Limite de tentativas | checkout (3 pedidos abertos por IP, 2 por e-mail/WhatsApp/CPF, reserva fixa de 2h), página do pedido (60 a cada 10 min) e Meus dados (10 por hora). IP vem do `cf-connecting-ip` |
| Auditoria | tabela `audit_events`: logins de admin, exclusões, status de pedido, preço de conta, textos da loja, usuários, anonimização e retenção. Guardada por 1 ano |
| Avisos no sininho | tipo "Segurança": login no painel, usuário criado ou removido, limite de tentativas atingido |
| Headers | `netlify.toml`: CSP, HSTS, `X-Frame-Options: SAMEORIGIN`, `nosniff`, `Referrer-Policy` |
| Senha | 10+ caracteres com letras e números (painel, Edge Function `admin-users` e Supabase) |

Ao criar tabela pública (que a vitrine lê), declare o acesso na própria migration:
`grant select on public.<tabela> to anon;` e a política `for select to anon`.

## Publicar (nesta ordem)

1. **Banco**: as migrations `20261026120000_lgpd.sql` e `20261027120000_security_hardening.sql`, nessa ordem
   (`npx supabase login` e `npx supabase db push`, ou cole cada uma no SQL Editor e registre como em `docs/lgpd.md`).
   Se aparecer o aviso "Sem permissão para criar o gatilho em auth.sessions", tudo foi aplicado, menos o aviso de login.
2. **Edge Function**: `npx supabase functions deploy admin-users` (regra de senha nova).
3. **Site**: publicar na Netlify. O painel novo lê o CPF pela coluna cifrada: com o banco antigo, a lista de pedidos falha.

## Painel do Supabase (manual)

- **Authentication > Sign In / Providers > Email**: tamanho mínimo da senha 10 e exigência "letras e números";
  ligar "Secure password change".
- **Authentication > Rate Limits**: "Sign-ups and sign-ins" em 20 por 5 minutos por IP.
- **Authentication > Multi-Factor**: "TOTP (App Authenticator)" ligado.
- **Vault** (Project Settings > Vault): copie o valor de `pii_encryption_key` para o gerenciador de senhas.
  Sem essa chave os CPFs cifrados não voltam mais.

## Conferir depois de publicar

```sql
-- Gatilho do aviso de login instalado
select tgname from pg_trigger where tgname = 'audit_admin_login';
-- Nenhum CPF em texto aberto
select count(*) from public.orders where customer_document is not null;
select count(*) from public.customers where document is not null;
-- Últimos eventos de segurança
select created_at, action, entity, ip_address from public.audit_events order by id desc limit 20;
```

No terminal, 11 consultas ao Meus dados forjando o `X-Forwarded-For` precisam terminar em `too_many_attempts`
(troque `<URL>` e `<ANON>` pelos valores do `.env.local`):

```bash
for i in $(seq 1 11); do
  curl -s -X POST "<URL>/rest/v1/rpc/privacy_lookup" -H "apikey: <ANON>" -H "Content-Type: application/json" \
    -H "X-Forwarded-For: 10.0.0.$i" -d '{"p_email":"teste@exemplo.com","p_code":"JD-AAAAAA"}'; echo
done
```
