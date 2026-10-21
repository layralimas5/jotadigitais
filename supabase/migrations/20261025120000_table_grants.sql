-- Projetos novos do Supabase não dão mais acesso automático às tabelas do schema public para anon e
-- authenticated: sem isso o site e o painel recebem "permission denied" em tudo. Quem pode ver o quê
-- continua sendo decidido pelas políticas de RLS de cada tabela; aqui só se abre a porta para elas.

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;

-- Tabelas criadas daqui em diante já nascem com o mesmo acesso.
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant all on tables to service_role;

-- Os cortes que as migrations anteriores fizeram valem de novo por cima da concessão geral.
revoke insert, delete, truncate on public.store_settings from anon, authenticated;
revoke all on public.leads from anon;
revoke all on public.customers from anon;
revoke all on public.message_templates from anon;
revoke all on public.admin_preferences from anon;
revoke all on public.expenses from anon;
revoke all on public.partners from anon;
revoke all on public.notifications from anon;
revoke insert, update, delete on public.notifications from authenticated;
revoke all on public.notification_dismissals from anon;
revoke all on public.revenues from anon;
revoke insert, update, delete on public.site_content from anon;
