/**
 * Todo texto do site que o Jota edita pela aba Site do painel.
 * O padrão abaixo é o texto original: vale até a primeira edição e para qualquer campo que faltar no que foi salvo.
 *
 * Marcadores trocados na hora de mostrar: {dias} (garantia), {instagram} e {seguidores_shop}.
 */

export interface TitleBlock {
  eyebrow: string;
  title: string;
  description: string;
}

export interface TextCard {
  title: string;
  text: string;
}

export interface SiteImage {
  url: string;
  alt: string;
}

export interface FaqEntry {
  question: string;
  answer: string;
  /** Só aparece nas páginas de conta do TikTok (ex.: Shop piloto). */
  tiktokOnly: boolean;
}

export interface SiteContent {
  seo: { title: string; description: string };
  hero: {
    badge: string;
    title: string;
    /** Parte final do título, com o degradê da marca. */
    titleHighlight: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    proofPoints: [string, string, string];
    phoneName: string;
    phoneHandle: string;
    chipTitle: string;
    chipText: string;
    statLabel: string;
    statValue: string;
  };
  problem: {
    eyebrow: string;
    title: string;
    /** Continuação do título, em cinza. */
    titleMuted: string;
    description: string;
    fromScratchTitle: string;
    fromScratch: string[];
    fromScratchImage: SiteImage;
    withUsTitle: string;
    withUs: string[];
    withUsImage: SiteImage;
  };
  featured: TitleBlock & { allButton: string };
  howItWorks: { eyebrow: string; title: string; steps: [TextCard, TextCard, TextCard, TextCard] };
  results: TitleBlock & { disclaimer: string };
  guarantee: TitleBlock & { items: [TextCard, TextCard, TextCard, TextCard] };
  faq: TitleBlock & { items: FaqEntry[] };
  finalCta: { titleLine1: string; titleLine2: string; button: string };
  footer: { tagline: string; slogan: string; disclaimer: string };
  whatsapp: { teaserTitle: string; teaserText: string };
}

export const DEFAULT_SITE_CONTENT: SiteContent = {
  seo: {
    title: "Jota Digitais | Contas de TikTok com TikTok Shop liberado",
    description:
      "Contas brasileiras de TikTok com a Central de Criadores do TikTok Shop já ativa. Escolha, pague no Pix ou em até 12x e receba o acesso no seu e-mail.",
  },
  hero: {
    badge: "Central de Criadores do TikTok Shop já liberada",
    title: "Sua conta no TikTok Shop,",
    titleHighlight: "já aprovada.",
    subtitle:
      "Pule a fila de análise que recusa a maioria dos pedidos. Escolha uma conta com o Shop ativo, troque nome, @ e foto, e comece a afiliar produtos e ganhar comissão hoje.",
    primaryCta: "Ver contas disponíveis",
    secondaryCta: "Como funciona",
    proofPoints: ["Seguidores reais e brasileiros", "Pix ou até 12x no cartão", "Acesso entregue no seu e-mail"],
    phoneName: "Sua Loja Aqui",
    phoneHandle: "@sualoja.aqui",
    chipTitle: "Shop ativo",
    chipText: "Sem nova solicitação",
    statLabel: "Pedidos recusados pelo TikTok",
    statValue: "~60%",
  },
  problem: {
    eyebrow: "Por que comprar pronta",
    title: "Criar do zero custa tempo.",
    titleMuted: "E pode terminar em recusa.",
    description:
      "O TikTok recusa boa parte dos pedidos para entrar no Shop. Com a conta pronta, você pula direto para a parte que dá dinheiro.",
    fromScratchTitle: "Criando sua própria conta",
    fromScratch: [
      "Meses postando para crescer a conta",
      "Pedido de acesso ao Shop sem garantia de aprovação",
      "Cerca de 60% das solicitações recusadas",
      "Recomeçar do zero a cada recusa",
    ],
    fromScratchImage: {
      url: "/images/tiktok-shop-rejeitada.webp",
      alt: "Print do TikTok Shop: Sua solicitação de conta foi rejeitada. No momento, você não se qualifica para o acesso de criador do TikTok Shop.",
    },
    withUsTitle: "Com uma conta Jota Digitais",
    withUs: [
      "Conta ativa com seguidores reais e brasileiros",
      "Central de Criadores do TikTok Shop já liberada",
      "Sem documentos vinculados à conta",
      "Você troca nome, @ e foto e já pode vender",
    ],
    withUsImage: {
      url: "/images/tiktok-shop-central.webp",
      alt: "Print do TikTok Shop: Central de criadores do TikTok Shop, publique seu primeiro vídeo com produtos à venda.",
    },
  },
  featured: {
    eyebrow: "Disponíveis agora",
    title: "Contas prontas para vender",
    description: "Cada conta é única. Quando alguém compra, ela sai da vitrine.",
    allButton: "Ver todas",
  },
  howItWorks: {
    eyebrow: "Como funciona",
    title: "Da escolha à primeira venda em quatro passos",
    steps: [
      { title: "Escolha a conta", text: "Veja seguidores, curtidas e o status do Shop de cada conta antes de decidir." },
      {
        title: "Pague no Pix ou no cartão",
        text: "À vista no Pix ou parcelado em até 12x. A conta fica reservada para você.",
      },
      {
        title: "Receba o acesso por e-mail",
        text: "Com o pagamento confirmado, login e senha chegam no e-mail que você informou.",
      },
      {
        title: "Deixe com a sua cara",
        text: "Troque nome, @ e foto, afilie produtos na vitrine e comece a ganhar comissão.",
      },
    ],
  },
  results: {
    eyebrow: "Resultados de clientes",
    title: "Quem comprou, já está vendendo",
    description: "Prints reais: resultados de clientes e contas entregues prontas para usar.",
    disclaimer:
      "Resultados individuais. O ganho depende do nicho, dos produtos escolhidos e da frequência de postagem. Não há garantia de faturamento. Nos perfis entregues, nome, @ e foto foram desfocados para preservar os novos donos.",
  },
  guarantee: {
    eyebrow: "Garantia",
    title: "Compra segura, do Pix ao primeiro vídeo",
    description: "Você não fica sozinho depois do pagamento. A conta chega conferida e com suporte para começar.",
    items: [
      {
        title: "{dias} dias de garantia",
        text: "Se a conta não tiver o Shop ativo na entrega, você recebe outra ou o dinheiro de volta.",
      },
      {
        title: "Acesso completo",
        text: "Você recebe login e senha e passa a ser o único dono. Trocamos o e-mail da conta para o seu.",
      },
      {
        title: "Conta conferida",
        text: "Cada conta é verificada antes de ir para a vitrine: Shop liberado e seguidores ativos.",
      },
      { title: "Suporte na troca", text: "Ajudamos você a trocar nome, @, foto e a fazer a primeira afiliação." },
    ],
  },
  faq: {
    eyebrow: "Dúvidas",
    title: "Perguntas frequentes",
    description: "Não achou o que procurava? Fale com a gente no Instagram.",
    items: [
      {
        question: "Posso mudar o nome, o @ e a foto da conta?",
        answer:
          "Pode. Depois da compra a conta é sua: você altera nome de usuário, foto e bio como quiser e se cadastra no TikTok Shop com os seus dados.",
        tiktokOnly: false,
      },
      {
        question: "O que é o Shop piloto?",
        answer:
          "Contas com menos de {seguidores_shop} seguidores estão no modo piloto (fase beta) do TikTok Shop. Tudo funciona normalmente, só alguns produtos ainda não ficam disponíveis para afiliação até a conta crescer.",
        tiktokOnly: true,
      },
      {
        question: "O nicho da conta importa?",
        answer:
          "Não. Você pode mudar o tipo de conteúdo e falar com qualquer público. Os seguidores também não precisam ser de um gênero específico.",
        tiktokOnly: false,
      },
      {
        question: "Vou perder seguidores quando trocar os dados?",
        answer: "Não. Os seguidores são reais e brasileiros e continuam na conta depois da troca de nome e foto.",
        tiktokOnly: false,
      },
      {
        question: "Como recebo a conta?",
        answer: "Assim que o pagamento é confirmado, enviamos login, senha e o passo a passo para o e-mail informado na compra.",
        tiktokOnly: false,
      },
      {
        question: "Quais as formas de pagamento?",
        answer: "Pix à vista ou cartão de crédito em até 12x (com juros da operadora).",
        tiktokOnly: false,
      },
    ],
  },
  finalCta: {
    titleLine1: "Pare de esperar aprovação.",
    titleLine2: "Comece a vender esta semana.",
    button: "Escolher minha conta",
  },
  footer: {
    tagline: "Contas de TikTok, Instagram, YouTube e Facebook conferidas e prontas para você usar.",
    slogan: "Jesus é o caminho, a verdade e a vida.",
    disclaimer: "Não somos afiliados, patrocinados ou endossados pelo TikTok ou pela ByteDance.",
  },
  whatsapp: {
    teaserTitle: "Deseja falar com o Jota?",
    teaserText: "Respondo pelo WhatsApp.",
  },
};

export type SiteSectionKey = keyof SiteContent;

export interface ContentTokens {
  guaranteeDays: number;
  instagramHandle: string;
  fullShopMinFollowers: number;
}

/** Troca {dias}, {instagram} e {seguidores_shop} pelos valores atuais da loja. */
export function fillTokens(text: string, tokens: ContentTokens): string {
  return text
    .replaceAll("{dias}", String(tokens.guaranteeDays))
    .replaceAll("{instagram}", tokens.instagramHandle)
    .replaceAll("{seguidores_shop}", tokens.fullShopMinFollowers.toLocaleString("pt-BR"));
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Junta o que foi salvo por cima do padrão, campo a campo. Listas salvas substituem a lista padrão inteira.
 * Assim um conteúdo salvo antes de existir um campo novo continua válido.
 */
export function mergeWithDefaults(saved: unknown, defaults: unknown = DEFAULT_SITE_CONTENT): unknown {
  if (!isPlainObject(defaults)) return saved === undefined ? defaults : saved;
  if (!isPlainObject(saved)) return defaults;
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(defaults)) merged[key] = mergeWithDefaults(saved[key], value);
  return merged;
}
