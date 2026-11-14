/**
 * Todo texto do site que o Jota edita pela aba Site do painel.
 * O padrão abaixo é o texto original: vale até a primeira edição e para qualquer campo que faltar no que foi salvo.
 *
 * Marcadores trocados na hora de mostrar: {dias} (garantia), {instagram} e {seguidores_shop}.
 * Na página do pedido também valem {nome} (primeiro nome do cliente) e {conta} (o @ comprado).
 */

import type { LeadSource } from "./lead";
import type { PaymentPlan } from "./payment";
import type { Platform } from "./platform";

export interface TitleBlock {
  eyebrow: string;
  title: string;
  description: string;
}

export interface TextCard {
  title: string;
  text: string;
}

/** Card com um texto para conta de TikTok e outro para as demais redes. */
export interface PlatformCard {
  title: string;
  tiktok: string;
  other: string;
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

/** Provas abaixo dos botões do topo: mais que isso quebra em linhas demais no celular. */
export const MAX_PROOF_POINTS = 6;

/** Ícones que o Jota escolhe para cada prova. "auto" escolhe pelo texto (WhatsApp, e-mail, Pix...). */
export const PROOF_ICONS = [
  "auto",
  "shield",
  "badge",
  "users",
  "wallet",
  "card",
  "mail",
  "whatsapp",
  "zap",
  "clock",
  "lock",
  "star",
  "headset",
  "check",
  "trending",
] as const;

export type ProofIcon = (typeof PROOF_ICONS)[number];

export interface ProofPoint {
  text: string;
  icon: ProofIcon;
}

/** O botão abre o WhatsApp do Jota com a mensagem pronta ou leva a um link (página do site ou endereço externo). */
export const PAGE_BUTTON_ACTIONS = ["whatsapp", "link"] as const;
export type PageButtonAction = (typeof PAGE_BUTTON_ACTIONS)[number];

export interface PageButton {
  label: string;
  action: PageButtonAction;
  /** Mensagem que já vai escrita no WhatsApp (só no botão de WhatsApp). */
  message: string;
  /** "/catalogo" para uma página do site ou "https://..." para fora dele (só no botão de link). */
  url: string;
}

/** Mais botões que isso viram uma fila no celular. O primeiro é o destaque; os outros, secundários. */
export const MAX_PAGE_BUTTONS = 3;
/** Passos da página de parceiro: até seis cabem em duas linhas de três. */
export const MAX_PARTNER_STEPS = 6;
/** Página Quem sou eu: destaques em até duas linhas de três e fotos numa grade de até seis. */
export const MAX_ABOUT_HIGHLIGHTS = 6;
export const MAX_ABOUT_PHOTOS = 6;

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
    /** De 1 a 6 frases curtas abaixo dos botões, cada uma com seu ícone. */
    proofPoints: ProofPoint[];
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
  /** Página que o cliente vê depois de fechar o pedido, antes e depois de pagar. */
  orderPage: {
    titleAwaiting: string;
    titlePaid: string;
    reserved: string;
    /** Primeiro card: o título é um só, o texto muda com a forma de pagamento escolhida. */
    paymentStepTitle: string;
    paymentStepText: Record<PaymentPlan, string>;
    steps: [TextCard, TextCard];
  };
  /** Ficha do cliente no checkout: a pergunta de origem e as opções que aparecem nela. */
  checkoutPage: {
    sourceQuestion: string;
    /** Com uma opção só, ela já vem marcada. */
    sources: LeadSource[];
  };
  /** Página /seja-parceiro: explica a parceria e leva ao WhatsApp do Jota com a mensagem pronta. */
  partnerPage: TitleBlock & {
    steps: TextCard[];
    perksTitle: string;
    perks: string[];
    ctaTitle: string;
    ctaText: string;
    /** Aparecem no topo e no fim da página, na mesma ordem. */
    buttons: PageButton[];
  };
  /** Página /quem-sou-eu: quem está por trás da loja, com foto, história, fotos e botões. */
  aboutPage: TitleBlock & {
    /** Foto principal. Sem foto (url vazia), a página mostra a marca no lugar. */
    photo: SiteImage;
    storyTitle: string;
    /** Parágrafos separados por uma linha em branco. */
    story: string;
    highlightsTitle: string;
    /** Nenhum: a parte de destaques some. */
    highlights: TextCard[];
    /** Nenhuma: a galeria some. */
    gallery: SiteImage[];
    /** Aparecem no topo e no fim da página, na mesma ordem. */
    buttons: PageButton[];
  };
  /** Página de cada conta (/contas/...): a vitrine de venda. */
  accountPage: {
    /** Botão para o perfil real da conta, quando ela tem o link cadastrado. {rede} vira TikTok, Instagram... */
    profileLink: string;
    priceLabel: string;
    pixLine: string;
    /** {parcelas} vira o máximo de parcelas no cartão. */
    cardLine: string;
    cardNote: string;
    available: string;
    reserved: string;
    sold: string;
    buyButton: string;
    /** Botão "Comprar" da barra fixa no celular, que aparece quando o botão principal sai da tela. */
    mobileBuyButton: string;
    cartButton: string;
    /** Depois que a conta entrou no carrinho, o mesmo botão leva até ele. */
    inCartButton: string;
    /** {canal} vira WhatsApp ou Instagram, conforme o contato cadastrado. */
    questionButton: string;
    /** Mensagem que já vai escrita no WhatsApp. {conta} vira o @ da conta. */
    questionMessage: string;
    otherButton: string;
    perkDelivery: TextCard;
    perkGuarantee: PlatformCard;
    perkSupport: PlatformCard;
    aboutTitle: string;
    nicheNote: string;
    specsTitle: string;
    /** Linhas iguais em toda conta de cada rede, entre os números e a data do anúncio. */
    fixedSpecs: Record<Platform, { label: string; value: string }[]>;
    includedTitle: string;
    /** Itens fixos de cada rede. Monetização, conta profissional e afins entram sozinhos, pelos dados da conta. */
    included: Record<Platform, string[]>;
    deliveryTitle: string;
    /** Null: usa os quatro passos de Como funciona. */
    deliverySteps: [TextCard, TextCard, TextCard, TextCard] | null;
    faqTitle: string;
    relatedTitle: string;
  };
}

export const DEFAULT_SITE_CONTENT: SiteContent = {
  seo: {
    title: "Jota Digitais | Contas de TikTok com TikTok Shop liberado",
    description:
      "Contas brasileiras de TikTok com a Central de Criadores do TikTok Shop já ativa. Escolha, pague no Pix ou em até 12x e receba o acesso no seu WhatsApp.",
  },
  hero: {
    badge: "Central de Criadores do TikTok Shop já liberada",
    title: "Sua conta no TikTok Shop,",
    titleHighlight: "já aprovada.",
    subtitle:
      "Pule a fila de análise que recusa a maioria dos pedidos. Escolha uma conta com o Shop ativo, troque nome, @ e foto, e comece a afiliar produtos e ganhar comissão hoje.",
    primaryCta: "Ver contas disponíveis",
    secondaryCta: "Como funciona",
    proofPoints: [
      { text: "Seguidores reais e brasileiros", icon: "auto" },
      { text: "Pix ou até 12x no cartão", icon: "auto" },
      { text: "Acesso entregue no seu WhatsApp", icon: "auto" },
    ],
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
        title: "Receba o acesso no WhatsApp",
        text: "Com o pagamento confirmado, login e senha chegam no WhatsApp que você informou.",
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
        answer: "Assim que o pagamento é confirmado, enviamos login, senha e o passo a passo para o WhatsApp informado na compra.",
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
  orderPage: {
    titleAwaiting: "Pedido recebido, {nome}!",
    titlePaid: "Pagamento confirmado, {nome}!",
    reserved: "A conta {conta} está reservada para você.",
    paymentStepTitle: "Confirmação do pagamento",
    paymentStepText: {
      pix: "O Pix é confirmado assim que cai na conta.",
      card: "No cartão, a confirmação é automática assim que a InfinitePay aprova.",
      two_cards: "Cada cartão é confirmado automaticamente assim que é aprovado.",
      card_pix: "O cartão é confirmado na hora; o Pix, assim que cai na conta.",
    },
    steps: [
      {
        title: "Acesso no seu WhatsApp",
        text: "Login, senha e o passo a passo chegam no WhatsApp que você informou na compra.",
      },
      { title: "Deixe a conta com a sua cara", text: "Troque nome, @ e foto e afilie seus primeiros produtos na vitrine." },
    ],
  },
  checkoutPage: {
    sourceQuestion: "Como você conheceu a Jota Digitais?",
    sources: ["referral"],
  },
  partnerPage: {
    eyebrow: "Seja parceiro",
    title: "Você tem as contas. A gente vende.",
    description:
      "Tem contas de TikTok, Instagram, YouTube ou Facebook? A Jota Digitais anuncia, atende o cliente e entrega. Você recebe a sua parte de cada venda no Pix.",
    steps: [
      {
        title: "Chame no WhatsApp",
        text: "Conte quais contas você tem, de qual rede e com quantos seguidores. A gente responde e combina a sua parte.",
      },
      {
        title: "A gente anuncia e vende",
        text: "Suas contas entram na vitrine do site com fotos e números. Atendimento, pagamento e entrega ficam com a gente.",
      },
      {
        title: "Você recebe no Pix",
        text: "Quando a venda é finalizada, depois do prazo de garantia do comprador, a sua parte vai para a sua chave Pix.",
      },
    ],
    perksTitle: "Por que ser parceiro",
    perks: [
      "Atendimento, pagamento e entrega por nossa conta",
      "Suas contas na vitrine com fotos e números",
      "Garantia para quem compra, o que ajuda a vender",
      "Repasse no Pix, venda por venda",
    ],
    ctaTitle: "Quer ser parceiro?",
    ctaText: "Chame o Jota no WhatsApp. A mensagem já vai pronta, é só enviar.",
    buttons: [
      {
        label: "Quero ser parceiro",
        action: "whatsapp",
        message: "Olá, Jota! Vim pelo site e quero ser parceiro da Jota Digitais. Tenho contas para vender.",
        url: "",
      },
    ],
  },
  aboutPage: {
    eyebrow: "Quem sou eu",
    title: "Prazer, eu sou o Jota.",
    description:
      "Estou por trás da Jota Digitais: separo cada conta, confiro os números, atendo você no WhatsApp e acompanho a entrega até o fim.",
    photo: { url: "", alt: "Foto do Jota, fundador da Jota Digitais" },
    storyTitle: "Minha história",
    story:
      "A Jota Digitais nasceu para encurtar o caminho de quem quer vender pelas redes sociais. Em vez de começar do zero e esperar meses, você já começa com uma conta pronta, com seguidores e liberada para vender.\n\nCada conta passa por mim antes de entrar na vitrine. E depois da compra você não fica sozinho: o atendimento é pelo WhatsApp e a compra tem garantia.",
    highlightsTitle: "Como eu trabalho",
    highlights: [
      { title: "Conta conferida", text: "Antes de entrar na vitrine, cada conta tem os números e o acesso conferidos." },
      { title: "Atendimento de perto", text: "Você fala direto comigo no WhatsApp, antes e depois da compra." },
      { title: "Compra com garantia", text: "Se algo der errado no prazo de garantia, eu resolvo com você." },
    ],
    gallery: [],
    buttons: [
      {
        label: "Falar comigo no WhatsApp",
        action: "whatsapp",
        message: "Olá, Jota! Vim pela página Quem sou eu e quero saber mais sobre as contas.",
        url: "",
      },
      { label: "Ver as contas", action: "link", message: "", url: "/contas" },
    ],
  },
  accountPage: {
    profileLink: "Ver a conta no {rede}",
    priceLabel: "Valor da conta",
    pixLine: "À vista no Pix",
    cardLine: "Ou em até {parcelas}x no cartão",
    cardNote: "(juros da operadora)",
    available: "Disponível. Unidade única: quando alguém compra, ela sai da vitrine.",
    reserved: "Esta conta está reservada por outro cliente.",
    sold: "Esta conta já foi vendida.",
    buyButton: "Comprar esta conta",
    mobileBuyButton: "Comprar",
    cartButton: "Adicionar ao carrinho",
    inCartButton: "No carrinho · ver carrinho",
    questionButton: "Tirar dúvida no {canal}",
    questionMessage: "Olá! Tenho uma dúvida sobre a conta {conta}.",
    otherButton: "Ver outras contas",
    perkDelivery: { title: "Entrega pelo WhatsApp", text: "Login, senha e passo a passo logo após a confirmação do pagamento." },
    perkGuarantee: {
      title: "{dias} dias de garantia",
      tiktok: "Shop inativo na entrega? Você recebe outra conta ou o dinheiro de volta.",
      other: "Conta diferente do anunciado na entrega? Você recebe outra ou o dinheiro de volta.",
    },
    perkSupport: {
      title: "Suporte na troca",
      tiktok: "Ajudamos a trocar nome, @, foto e a fazer a primeira afiliação.",
      other: "Ajudamos a trocar nome, @, foto e a deixar a conta com a sua cara.",
    },
    aboutTitle: "Sobre esta conta",
    nicheNote: "O nicho é só o conteúdo de hoje. Você pode mudar o tipo de publicação e o público que quer atingir.",
    specsTitle: "Ficha técnica",
    fixedSpecs: {
      tiktok: [
        { label: "Central de Criadores", value: "Ativa" },
        { label: "Origem dos seguidores", value: "Brasil" },
        { label: "Documentos vinculados", value: "Nenhum" },
        { label: "Troca de nome, @ e foto", value: "Liberada" },
      ],
      instagram: [{ label: "Troca de nome, @ e foto", value: "Liberada" }],
      youtube: [{ label: "Troca de nome, @ e foto", value: "Liberada" }],
      facebook: [{ label: "Troca de nome, @ e foto", value: "Liberada" }],
    },
    includedTitle: "O que está incluso",
    included: {
      tiktok: [
        "Seguidores reais e brasileiros",
        "Sem documentos vinculados",
        "Troca livre de nome, @ e foto",
        "Login e senha entregues pelo WhatsApp",
      ],
      instagram: ["Troca livre de nome, @ e foto", "Login e senha entregues pelo WhatsApp", "E-mail da conta trocado para o seu"],
      youtube: ["Acesso de proprietário ao canal", "Troca livre de nome, @ e foto", "Login e senha entregues pelo WhatsApp"],
      facebook: ["Troca livre de nome, @ e foto", "Login e senha entregues pelo WhatsApp"],
    },
    deliveryTitle: "Como você recebe",
    deliverySteps: null,
    faqTitle: "Dúvidas sobre a compra",
    relatedTitle: "Você também pode gostar",
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

function mergeTree(saved: unknown, defaults: unknown): unknown {
  if (!isPlainObject(defaults)) return saved === undefined ? defaults : saved;
  if (!isPlainObject(saved)) return defaults;
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(defaults)) merged[key] = mergeTree(saved[key], value);
  return merged;
}

/** A página de parceiro tinha um botão só (button + whatsappMessage): vira o primeiro da lista, com o texto que o Jota salvou. */
function upgradePartnerPage(saved: Record<string, unknown>): Record<string, unknown> {
  const page = saved.partnerPage;
  if (!isPlainObject(page) || "buttons" in page || typeof page.button !== "string") return saved;
  const [fallback] = DEFAULT_SITE_CONTENT.partnerPage.buttons;
  const message = typeof page.whatsappMessage === "string" ? page.whatsappMessage : (fallback?.message ?? "");
  return { ...saved, partnerPage: { ...page, buttons: [{ label: page.button, action: "whatsapp", message, url: "" }] } };
}

/**
 * Junta o que foi salvo por cima do padrão, campo a campo. Listas salvas substituem a lista padrão inteira.
 * Assim um conteúdo salvo antes de existir um campo novo continua válido.
 */
export function mergeWithDefaults(saved: unknown): unknown {
  return mergeTree(isPlainObject(saved) ? upgradePartnerPage(saved) : saved, DEFAULT_SITE_CONTENT);
}

/** Endereço que o botão de link aceita: uma página do site ("/catalogo") ou um endereço https. */
export function isPageButtonUrl(url: string): boolean {
  if (/^\/(?!\/)/.test(url)) return true;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
