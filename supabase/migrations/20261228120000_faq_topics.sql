-- Chamado "Direcionamento para dúvidas": liga as perguntas que o Jota já escreveu aos selos da página da conta
-- (o link "Entenda o que é…" abre a resposta). Daqui em diante ele escolhe o selo no editor da pergunta.
-- Só preenche quem ainda não tem assunto; casa pelo texto da pergunta.

update public.site_content sc
set content = jsonb_set(
  sc.content,
  '{faq,items}',
  (
    select jsonb_agg(
      case
        when item ? 'topic' and item->>'topic' is not null then item
        when item->>'question' ilike '%piloto%' then item || '{"topic": "tiktok-shop-pilot"}'
        when item->>'question' ilike '%shop ativo%' then item || '{"topic": "tiktok-shop-full"}'
        when item->>'question' ilike '%monetizada%' and item->>'question' ilike '%tiktok%' then item || '{"topic": "tiktok-monetized"}'
        else item
      end
      order by ordinality
    )
    from jsonb_array_elements(sc.content->'faq'->'items') with ordinality as items(item, ordinality)
  )
)
where jsonb_typeof(sc.content->'faq'->'items') = 'array';
