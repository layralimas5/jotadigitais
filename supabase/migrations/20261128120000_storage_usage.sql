-- Aba Armazenamento: quanto o banco e os arquivos ocupam, para o Jota e a desenvolvedora acompanharem o limite do plano.
-- Só leitura de tamanhos (nenhum dado de cliente sai daqui) e só para admin e desenvolvedora.

create or replace function public.storage_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_admin_role() is null or public.current_admin_role() not in ('admin', 'developer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'database_bytes', pg_database_size(current_database()),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object('name', t.relname, 'bytes', t.bytes, 'rows', t.rows) order by t.bytes desc)
      from (
        select c.relname, pg_total_relation_size(c.oid) as bytes, greatest(c.reltuples, 0)::bigint as rows
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
      ) t
    ), '[]'::jsonb),
    'buckets', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'public', b.public, 'files', b.files, 'bytes', b.bytes) order by b.bytes desc)
      from (
        select bk.id, bk.public, count(o.id) as files, coalesce(sum((o.metadata ->> 'size')::bigint), 0) as bytes
        from storage.buckets bk
        left join storage.objects o on o.bucket_id = bk.id
        group by bk.id, bk.public
      ) b
    ), '[]'::jsonb),
    'measured_at', now()
  );
end;
$$;

revoke all on function public.storage_usage() from public, anon;
grant execute on function public.storage_usage() to authenticated;
