# Jota Digitais: análise do material do Canva

Fonte: catálogo "Contas de Tiktok" no Canva (17 páginas, formato vertical de story/carrossel).
Capturas das páginas 1 a 9 em `referencias-canva/`. As páginas 10 a 17 não carregaram
(o Canva bloqueou por excesso de acessos); pelo padrão, são mais cards de conta.

## O que o material vende hoje

- Produto: contas de TikTok com a **Central de Criadores do TikTok Shop já liberada**
  (afiliado pronto para vender e ganhar comissão).
- Dor que ataca: "60% das solicitações para entrar no Shop são rejeitadas".
- Promessa: conta ativa, aprovada, sem documento vinculado, seguidores reais e brasileiros,
  comprador troca nome, @ e foto. "Nicho não importa".
- Faixa das contas: cerca de 1.000 a 1.300 seguidores (abaixo de 2 mil = "modo piloto/beta").
- Preço: **R$ 370,00** no Pix ou até 12x com juros.
- Prova social: prints de WhatsApp de clientes com GMV/comissão (R$ 23.500 e R$ 2.900).
- Instagram: **@jotadigitais**.
- Assinatura religiosa no rodapé: "Jesus é o caminho, a verdade e a vida."

## Logo

- Wordmark "JOTA / DIGITAIS" em duas linhas, fonte display bold condensada **em contorno**
  (outline), com camadas deslocadas em azul e rosa (efeito glitch/3D estilo neon).
- Selo de verificado azul (o "check" das redes) encostado no fim de "DIGITAIS". É o símbolo
  da marca e funciona sozinho como ícone/favicon.
- No Canva o logo é texto com efeito, não arquivo. **Pedir o PNG/SVG em alta** ao cliente;
  se não existir, redesenhar em SVG para o site.

## Paleta (extraída do arquivo, por frequência de uso)

| Papel | Cor | Hex |
|---|---|---|
| Fundo base | Preto | `#000000` |
| Primária (destaque, CTA, logo) | Azul elétrico | `#2799FF` |
| Secundária (logo, destaque) | Rosa/magenta | `#FF66C4` / `#D34D9C` |
| Profundidade do gradiente | Violeta/índigo | `#3232C4` |
| Selo de verificado | Azul profundo | `#2169AC` |
| Alerta/negativo ("rejeitada", "60%") | Vermelho | `#FF3131` |
| Texto | Branco | `#FFFFFF` |
| Texto secundário | Cinza | `#A6A6A6` |
| Apoio (caixa de preço) | Azul aço | `#507EA4` |
| Apoio claro | Lilás claro | `#FBD0FC` |

Gradiente assinatura: rosa `#FF66C4` → violeta `#3232C4` → azul `#2799FF` (barras diagonais,
anéis e quadrados vazados do fundo).

## Tipografia observada

- Corpo e títulos: sans bold humanista (Open Sans/Canva Sans).
- Apoio ("Arraste pra o lado"): geométrica fina (Glacial Indifference/League Spartan).
- "2026": serifada.
- Logo: display outline.

Proposta para o site: **uma** sans forte para título (ex.: Sora ou Space Grotesk), Inter no
corpo, e o logo como única peça "neon". O visual do Canva é carregado demais para
e-commerce; manter preto + azul elétrico como base e usar o gradiente rosa→azul só em
detalhe (bordas, selo, hover), o que segura o premium sem perder a cara da marca.

## Pontos de atenção antes de construir

1. **Termos das plataformas.** TikTok, Instagram e YouTube proíbem compra e venda de contas.
   A conta pode ser derrubada depois da transferência; precisa de política clara de garantia
   e troca no site.
2. **Pagamento.** Stripe, Mercado Pago e boa parte dos gateways vetam venda de contas de rede
   social. Confirmar com o cliente qual gateway ele já usa e se aceita o produto, senão o
   checkout pode ser bloqueado com dinheiro retido.
3. **Anúncio pago.** Meta Ads e Google Ads não aprovam esse tipo de oferta. Tráfego vai ser
   orgânico/indicação/WhatsApp; isso muda o funil do site.
4. **Marca de terceiro.** Uma das contas do catálogo se chama "havan" e posta vídeos da Havan.
   Não pode aparecer assim no site (risco de notificação).
5. **Prova social.** Prints com GMV são promessa de ganho; usar com aviso "resultados
   individuais variam" para não cair em propaganda enganosa (CDC).
6. **Entrega.** Definir como o login é entregue (área do cliente, e-mail, WhatsApp) e o prazo
   de troca de e-mail/senha. Isso é o coração do sistema.

## Perguntas para o cliente

- Nome/contato do responsável e se o domínio já existe.
- Quantas contas em estoque e com que frequência entram novas (cadastro manual ou em massa).
- Instagram e YouTube já têm estoque ou é só TikTok por enquanto?
- Gateway de pagamento atual e se a venda hoje é toda pelo WhatsApp.
- Política de garantia (quantos dias, o que cobre).
- Logo em arquivo.
- Manter a frase religiosa no site? (rodapé, por exemplo)
