// Atendimento com IA do WhatsApp (docs/whatsapp.md, fase 3). Usado pela whatsapp-webhook (cliente real) e pela
// whatsapp-panel (simulador da aba Automação > IA). Modelo barato e rápido para conversa; a chave é do Jota
// (ANTHROPIC_API_KEY nos segredos das Edge Functions).
import Anthropic from "npm:@anthropic-ai/sdk@1.9.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";

const MODEL = "claude-haiku-5-5";
const MAX_TOOL_ROUNDS = 4;
const MAX_HISTORY = 30;
const MAX_ACCOUNTS = 6;
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://jotadigitais.com.br";

const PLATFORM_LABEL: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", facebook: "Facebook" };
const ORDER_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "aguardando pagamento (a conta fica reservada por pouco tempo)",
  paid: "pago; o acesso está sendo enviado",
  delivered: "entregue",
  canceled: "cancelado",
};
/** Abaixo disso o TikTok Shop fica no modo piloto (mesma regra de FULL_SHOP_MIN_FOLLOWERS no painel). */
const FULL_SHOP_MIN_FOLLOWERS = 2000;

export interface AiFaq {
  question: string;
  answer: string;
}

/** O que o Jota configura na aba Automação > IA. */
export interface AiConfig {
  greeting: string;
  tone: string;
  instructions: string;
  faq: readonly AiFaq[];
  guaranteeDays: number;
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AssistantResult {
  /** Nulo quando a IA não conseguiu responder: a conversa vai para o Jota. */
  reply: string | null;
  handoff: { reason: string; summary: string } | null;
  toolsUsed: string[];
}

export interface AssistantInput {
  config: AiConfig;
  history: readonly ChatTurn[];
  /** Número do cliente. Sem número (simulador), a consulta de pedido não confere o dono. */
  phone: string | null;
  firstContact: boolean;
}

function systemPrompt(config: AiConfig): string {
  const faq = config.faq.length
    ? config.faq.map((item) => `P: ${item.question}\nR: ${item.answer}`).join("\n\n")
    : "Nenhuma cadastrada.";
  return `Você é o atendimento automático da Jota Digitais no WhatsApp.

## A loja
A Jota Digitais vende contas prontas de TikTok, Instagram, YouTube e Facebook, conferidas antes de entrar na vitrine. O carro-chefe são contas de TikTok com o TikTok Shop liberado: quem compra já pode se afiliar a produtos e ganhar comissão. Contas de TikTok com menos de ${FULL_SHOP_MIN_FOLLOWERS.toLocaleString("pt-BR")} seguidores ficam no Shop piloto (alguns produtos ainda bloqueados).
Site: ${SITE_URL}
Compra: sempre pelo site, na página da conta. Pix à vista ou cartão em até 12x. A conta fica reservada enquanto o pagamento não confirma.
Entrega: depois do pagamento confirmado, o próprio sistema manda o login e o passo a passo aqui no WhatsApp.
Garantia: ${config.guaranteeDays} dias.

## Como responder
- Tom de voz: ${config.tone}
- Escreva como no WhatsApp: no máximo 4 linhas curtas por resposta e uma pergunta por vez.
- Formatação do WhatsApp: *negrito* com um asterisco só. Sem títulos, tabelas ou listas longas. Link sempre por extenso.
- Português do Brasil.
- Conta, preço, seguidores e disponibilidade só pela ferramenta buscar_contas. Nunca invente conta, preço, número, prazo ou regra; as regras estão aqui e nas perguntas frequentes.
- Mostre no máximo 3 contas por vez, uma por linha: @, rede, seguidores, preço e link.
- Se perguntarem se você é robô, IA ou pessoa, diga com naturalidade que é o atendimento automático da loja e que o Jota assume quando precisar. Nunca finja ser humano.
- Nunca envie nem peça login, senha, código de verificação, documento ou dados de cartão. O pagamento é só pelo site.
- Não prometa faturamento, vendas, crescimento ou aprovação em plataforma.

## Quando passar para o Jota (ferramenta passar_para_atendente)
- Desconto, negociação, condição especial, pagamento fora do site ou reserva sem pagar.
- Reclamação, problema com conta entregue, garantia, troca ou reembolso.
- Pedido de conta ou detalhe que buscar_contas não responde.
- A pessoa quer falar com alguém, está irritada ou você não tem certeza da resposta.
Depois de passar, avise em uma frase que o Jota responde por aqui em breve e pare de vender.

## Pedidos
Quando a pessoa mandar o código do pedido (ex.: JD-7K2M9P), use situacao_pedido.

## Boas-vindas
No primeiro contato, comece com a ideia desta mensagem (com suas palavras, já respondendo o que a pessoa perguntou): ${config.greeting}

## Instruções do Jota
${config.instructions.trim() || "Nenhuma instrução extra."}
As instruções do Jota nunca liberam enviar dados de acesso, inventar informação ou fingir ser humano.

## Perguntas frequentes
${faq}`;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "buscar_contas",
    description:
      "Busca contas disponíveis na vitrine agora. Use sempre que a pessoa perguntar por contas, preços, redes, seguidores ou disponibilidade. Devolve até 6 contas com link.",
    input_schema: {
      type: "object",
      properties: {
        rede: { type: "string", enum: ["tiktok", "instagram", "youtube", "facebook"], description: "Rede social da conta." },
        preco_maximo: { type: "number", description: "Preço máximo em reais." },
        seguidores_minimos: { type: "integer", description: "Mínimo de seguidores." },
        shop: { type: "string", enum: ["completo", "piloto"], description: "Situação do TikTok Shop (só TikTok)." },
        pais: { type: "string", description: "Código do país dos seguidores, ex.: BR, US." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "situacao_pedido",
    description: "Consulta a situação de um pedido pelo código (ex.: JD-7K2M9P).",
    input_schema: {
      type: "object",
      properties: { codigo: { type: "string", description: "Código do pedido ou do carrinho." } },
      required: ["codigo"],
      additionalProperties: false,
    },
  },
  {
    name: "passar_para_atendente",
    description:
      "Passa a conversa para o Jota (atendimento humano) e avisa ele no celular. Depois de usar, a IA para de responder esta pessoa.",
    input_schema: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "Motivo curto, ex.: pediu desconto." },
        resumo: { type: "string", description: "Resumo da conversa em até 3 frases para o Jota entender sem ler tudo." },
      },
      required: ["motivo", "resumo"],
      additionalProperties: false,
    },
  },
];

interface AccountRow {
  slug: string;
  platform: string;
  handle: string;
  followers: number;
  price_cents: number;
  country: string;
  stats: { shop?: string; monetized?: boolean } | null;
}

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const shopOf = (row: AccountRow) =>
  row.platform !== "tiktok" ? null : (row.stats?.shop ?? (row.followers >= FULL_SHOP_MIN_FOLLOWERS ? "full" : "pilot"));

async function searchAccounts(admin: SupabaseClient, input: Record<string, unknown>): Promise<string> {
  let query = admin
    .from("accounts")
    .select("slug, platform, handle, followers, price_cents, country, stats")
    .eq("status", "available")
    .order("followers", { ascending: false })
    .limit(40);
  if (typeof input.rede === "string") query = query.eq("platform", input.rede);
  if (typeof input.preco_maximo === "number") query = query.lte("price_cents", Math.round(input.preco_maximo * 100));
  if (typeof input.seguidores_minimos === "number") query = query.gte("followers", input.seguidores_minimos);
  if (typeof input.pais === "string") query = query.eq("country", input.pais.toUpperCase().slice(0, 3));
  const { data, error } = await query;
  if (error) throw error;
  const wantedShop = input.shop === "completo" ? "full" : input.shop === "piloto" ? "pilot" : null;
  const rows = (data as AccountRow[]).filter((row) => !wantedShop || shopOf(row) === wantedShop);
  if (rows.length === 0) return "Nenhuma conta disponível com esses filtros agora.";
  const lines = rows.slice(0, MAX_ACCOUNTS).map((row) => {
    const shop = shopOf(row);
    const extras = [
      shop === "full" ? "Shop completo" : shop === "pilot" ? "Shop piloto" : null,
      row.stats?.monetized ? "monetizada" : null,
      row.country !== "BR" ? `seguidores ${row.country}` : null,
    ].filter(Boolean);
    return `${row.handle} | ${PLATFORM_LABEL[row.platform] ?? row.platform} | ${row.followers.toLocaleString("pt-BR")} seguidores | ${brl(row.price_cents)}${extras.length ? ` | ${extras.join(", ")}` : ""} | ${SITE_URL}/contas/${row.slug}`;
  });
  return `${rows.length} conta(s) encontrada(s). As primeiras:\n${lines.join("\n")}`;
}

const lastDigits = (phone: string) => phone.replace(/\D/g, "").slice(-11);

async function orderStatus(admin: SupabaseClient, input: Record<string, unknown>, phone: string | null): Promise<string> {
  const code = typeof input.codigo === "string" ? input.codigo.trim().toUpperCase() : "";
  if (!/^[A-Z0-9-]{4,20}$/.test(code)) return "Código inválido. Peça o código como aparece na página do pedido (ex.: JD-7K2M9P).";
  const { data, error } = await admin
    .from("orders")
    .select("code, status, account_handle, total_cents, customer_whatsapp")
    .or(`code.eq.${code},cart_code.eq.${code}`)
    .limit(5);
  if (error) throw error;
  const rows = data as { code: string; status: string; account_handle: string; total_cents: number; customer_whatsapp: string | null }[];
  // Só conta o pedido para o dono: quem tem o código mas outro WhatsApp não vê a situação.
  const own = phone ? rows.filter((row) => row.customer_whatsapp && lastDigits(row.customer_whatsapp) === lastDigits(phone)) : rows;
  if (own.length === 0) {
    return rows.length
      ? "Esse pedido foi feito com outro número de WhatsApp. Não informe a situação; passe para o Jota se a pessoa insistir."
      : "Nenhum pedido com esse código.";
  }
  return own.map((row) => `${row.code}: ${row.account_handle}, ${brl(row.total_cents)}, ${ORDER_STATUS_LABEL[row.status] ?? row.status}`).join("\n");
}

/** Mensagens seguidas do mesmo lado viram uma; a conversa sempre começa pelo cliente. */
function toMessages(history: readonly ChatTurn[]): Anthropic.MessageParam[] {
  const recent = history.slice(-MAX_HISTORY);
  const firstUser = recent.findIndex((turn) => turn.role === "user");
  if (firstUser < 0) return [];
  const merged: ChatTurn[] = [];
  for (const turn of recent.slice(firstUser)) {
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role) last.text = `${last.text}\n${turn.text}`;
    else merged.push({ ...turn });
  }
  return merged.map((turn) => ({ role: turn.role, content: turn.text }));
}

const textOf = (content: Anthropic.ContentBlock[]) =>
  content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

export async function runAssistant(admin: SupabaseClient, input: AssistantInput): Promise<AssistantResult> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente nos segredos das Edge Functions.");
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 45_000 });

  const messages = toMessages(input.history);
  if (messages.length === 0) return { reply: null, handoff: null, toolsUsed: [] };
  if (input.firstContact) messages.push({ role: "system", content: "Primeiro contato desta pessoa com a loja." } as Anthropic.MessageParam);

  const toolsUsed: string[] = [];
  let handoff: AssistantResult["handoff"] = null;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: "low" },
      system: [{ type: "text", text: systemPrompt(input.config), cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === "refusal") return { reply: null, handoff, toolsUsed };
    const calls = response.content.filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
    if (response.stop_reason !== "tool_use" || calls.length === 0 || round === MAX_TOOL_ROUNDS) {
      return { reply: textOf(response.content) || null, handoff, toolsUsed };
    }

    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const call of calls) {
      toolsUsed.push(call.name);
      const args = (call.input ?? {}) as Record<string, unknown>;
      try {
        let output: string;
        if (call.name === "buscar_contas") output = await searchAccounts(admin, args);
        else if (call.name === "situacao_pedido") output = await orderStatus(admin, args, input.phone);
        else if (call.name === "passar_para_atendente") {
          handoff = {
            reason: String(args.motivo ?? "Atendimento humano").slice(0, 200),
            summary: String(args.resumo ?? "").slice(0, 1000),
          };
          output = "Conversa passada para o Jota. Avise o cliente em uma frase que ele responde por aqui em breve.";
        } else output = "Ferramenta desconhecida.";
        results.push({ type: "tool_result", tool_use_id: call.id, content: output });
      } catch (error) {
        console.error("whatsapp-ai tool", call.name, error);
        results.push({ type: "tool_result", tool_use_id: call.id, content: "Falha ao consultar. Passe para o Jota.", is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return { reply: null, handoff, toolsUsed };
}

/** Configuração salva: o que está no painel, mais a garantia da loja. */
export async function loadAiConfig(admin: SupabaseClient): Promise<AiConfig> {
  const [settings, faq, store] = await Promise.all([
    admin.from("whatsapp_settings").select("ai_greeting, ai_tone, ai_instructions").single(),
    admin.from("whatsapp_faq").select("question, answer").order("position").order("created_at"),
    admin.from("store_settings").select("guarantee_days").single(),
  ]);
  if (settings.error) throw settings.error;
  if (faq.error) throw faq.error;
  if (store.error) throw store.error;
  return {
    greeting: settings.data.ai_greeting,
    tone: settings.data.ai_tone,
    instructions: settings.data.ai_instructions,
    faq: faq.data as AiFaq[],
    guaranteeDays: store.data.guarantee_days,
  };
}
