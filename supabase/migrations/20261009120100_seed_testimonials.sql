-- Prints reais que já estavam no site. As imagens ficam em /public/images; os novos entram pelo painel.
insert into public.testimonials (kind, title, subtitle, image_url, image_alt, width, height, position) values
  ('result', 'R$ 23,5 mil no mês', 'Marina, em comissões', '/images/depoimento-marina.webp',
   'WhatsApp da cliente Marina com o painel do TikTok Shop: R$ 23,5 mil em comissões estimadas no mês.', 553, 1200, 0),
  ('delivered', 'Shop para criadores ativo', '1.093 seguidores', '/images/conta-entregue-1.webp',
   'Perfil de conta entregue com a aba TikTok Shop para criadores ativa e 1.093 seguidores.', 540, 1063, 1),
  ('result', 'R$ 2,9 mil em um dia', 'Taah, em comissões', '/images/depoimento-taah.webp',
   'WhatsApp da cliente Taah com o painel do TikTok Shop: R$ 2,9 mil em comissões estimadas no dia.', 553, 1200, 2),
  ('delivered', 'Pagamentos do Shop liberados', '1.129 seguidores', '/images/conta-entregue-2.webp',
   'Perfil de conta entregue com a opção Comece a receber pagamentos do TikTok Shop e 1.129 seguidores.', 540, 1063, 3),
  ('delivered', 'Vitrine e link de afiliado', '1.517 seguidores', '/images/conta-entregue-3.webp',
   'Perfil de conta entregue com a vitrine ativa, link de afiliado e 1.517 seguidores.', 540, 1063, 4),
  ('delivered', 'Pronta para vender', '1.061 seguidores', '/images/conta-entregue-4.webp',
   'Perfil de conta entregue com a opção Comece a receber pagamentos do TikTok Shop e 1.061 seguidores.', 540, 1063, 5);
