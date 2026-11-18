import type { AdminWhatsAppRepository } from "@/application/ports";
import {
  DEFAULT_AI_SETTINGS,
  DEFAULT_WHATSAPP_SETTINGS,
  type AiDraft,
  type InboundOutcome,
  type SimulatorReply,
  type SimulatorTurn,
  type WhatsAppAiSettings,
  type WhatsAppChatMessage,
  type WhatsAppContact,
  type WhatsAppContactKind,
  type WhatsAppFaq,
  type WhatsAppFaqDraft,
  type WhatsAppHandler,
  type WhatsAppMessage,
  type WhatsAppSettings,
} from "@/domain/whatsapp";
import {
  answerFlow,
  pickFlow,
  renderWithOptions,
  startFlow,
  templateGraph,
  type FlowStep,
  type WhatsAppFlow,
  type WhatsAppFlowDraft,
} from "@/domain/whatsapp-flow";
import { isBusinessHours } from "@/domain/whatsapp";
import { newId, simulateLatency, type DemoDatabase, type DemoState } from "./demo-database";

const SEED_FLOWS = (): WhatsAppFlow[] => [
  { id: "flow_atendimento", name: "Atendimento inicial", enabled: true, graph: templateGraph(), updatedAt: new Date().toISOString() },
];

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const SEED_FAQ: WhatsAppFaq[] = [
  {
    id: "faq_entrega",
    question: "Como recebo a conta?",
    answer: "Assim que o pagamento é confirmado, o login, a senha e o passo a passo chegam aqui no WhatsApp, no número informado na compra.",
  },
  { id: "faq_pagamento", question: "Quais as formas de pagamento?", answer: "Pix à vista ou cartão de crédito em até 12x (com juros da operadora)." },
  {
    id: "faq_garantia",
    question: "Tem garantia?",
    answer: "Tem. Se a conta não estiver como anunciada na entrega, você recebe outra ou o dinheiro de volta dentro do prazo de garantia.",
  },
];

/** Três conversas de exemplo: uma resolvida pela IA, uma esperando o Jota e uma de cliente antigo. */
function seedConversations(): { contacts: WhatsAppContact[]; chat: Record<string, WhatsAppChatMessage[]> } {
  const contact = (id: string, fields: Partial<WhatsAppContact>): WhatsAppContact => ({
    id,
    phone: "5511999990000",
    name: null,
    kind: "lead",
    handler: "ai",
    optedOut: false,
    handoffSummary: null,
    unreadCount: 0,
    lastInboundAt: null,
    lastMessageAt: minutesAgo(0),
    lastMessagePreview: null,
    ...fields,
  });
  const message = (id: string, author: WhatsAppChatMessage["author"], body: string, minutes: number): WhatsAppChatMessage => ({
    id,
    author,
    body,
    status: author === "customer" ? "received" : "test",
    error: null,
    createdAt: minutesAgo(minutes),
  });
  return {
    contacts: [
      contact("wa_bruna", {
        phone: "5527998887766",
        name: "Bruna Alves",
        handler: "staff",
        unreadCount: 1,
        handoffSummary: "Pediu desconto. Quer a conta de TikTok com Shop completo de R$ 370 e pergunta se faz por R$ 300 no Pix.",
        lastInboundAt: minutesAgo(4),
        lastMessageAt: minutesAgo(3),
        lastMessagePreview: "Combinado! Vou chamar o Jota, ele responde por aqui em breve.",
      }),
      contact("wa_carlos", {
        phone: "5511987654321",
        name: "Carlos",
        lastInboundAt: minutesAgo(48),
        lastMessageAt: minutesAgo(47),
        lastMessagePreview: "Tenho sim! *@achadinhos.dabia*, TikTok, 1.259 seguidores…",
      }),
      contact("wa_marina", {
        phone: "5521976543210",
        name: "Marina",
        kind: "customer",
        lastInboundAt: minutesAgo(60 * 30),
        lastMessageAt: minutesAgo(60 * 30),
        lastMessagePreview: "O pedido JD-7K2M9P foi entregue. Qualquer dúvida na troca, me chama!",
      }),
    ],
    chat: {
      wa_bruna: [
        message("m1", "customer", "Oi, vi a conta de TikTok com Shop completo. Ainda tá disponível?", 9),
        message("m2", "ai", "Oi, Bruna! Tá sim: *@loja.dabru*, TikTok, 2.340 seguidores, Shop completo, R$ 370.\nhttps://jotadigitais.com.br/contas/loja-da-bru", 8),
        message("m3", "customer", "Faz por 300 no pix?", 4),
        message("m4", "ai", "Combinado! Vou chamar o Jota, ele responde por aqui em breve.", 3),
      ],
      wa_carlos: [
        message("m5", "customer", "Boa tarde, tem conta de tiktok até 400 reais?", 48),
        message(
          "m6",
          "ai",
          "Tenho sim! *@achadinhos.dabia*, TikTok, 1.259 seguidores, Shop piloto, R$ 370.\nhttps://jotadigitais.com.br/contas/achadinhos-da-bia",
          47,
        ),
      ],
      wa_marina: [
        message("m7", "customer", "Recebi o acesso, obrigada!", 60 * 30 + 2),
        message("m8", "staff", "O pedido JD-7K2M9P foi entregue. Qualquer dúvida na troca, me chama!", 60 * 30),
      ],
    },
  };
}

const DEMO_AI_REPLY =
  "No modo demonstração a IA não está conectada. No sistema real, ela responderia aqui consultando as contas da vitrine e as perguntas frequentes que você cadastrou.";

/** Modo demonstração: tudo fica no navegador, sem Meta e sem IA de verdade. */
export class DemoWhatsAppRepository implements AdminWhatsAppRepository {
  constructor(private readonly db: DemoDatabase) {}

  async getSettings(): Promise<WhatsAppSettings> {
    return { ...DEFAULT_WHATSAPP_SETTINGS, autoDelivery: this.db.read().whatsappAutoDelivery ?? DEFAULT_WHATSAPP_SETTINGS.autoDelivery };
  }

  async setAutoDelivery(enabled: boolean): Promise<WhatsAppSettings> {
    await simulateLatency();
    this.db.write((state) => {
      state.whatsappAutoDelivery = enabled;
    });
    return this.getSettings();
  }

  async listMessages(): Promise<WhatsAppMessage[]> {
    return [];
  }

  async getAiSettings(): Promise<WhatsAppAiSettings> {
    return this.db.read().whatsappAi ?? DEFAULT_AI_SETTINGS;
  }

  async saveAiSettings(settings: WhatsAppAiSettings): Promise<WhatsAppAiSettings> {
    await simulateLatency();
    return this.db.write((state) => (state.whatsappAi = { ...settings }));
  }

  async setAiEnabled(enabled: boolean): Promise<WhatsAppAiSettings> {
    await simulateLatency();
    return this.db.write((state) => (state.whatsappAi = { ...(state.whatsappAi ?? DEFAULT_AI_SETTINGS), enabled }));
  }

  async listFaq(): Promise<WhatsAppFaq[]> {
    return this.db.read().whatsappFaq ?? SEED_FAQ;
  }

  async saveFaq(items: readonly WhatsAppFaqDraft[]): Promise<WhatsAppFaq[]> {
    await simulateLatency();
    return this.db.write(
      (state) => (state.whatsappFaq = items.map((item) => ({ id: item.id ?? newId("faq"), question: item.question, answer: item.answer }))),
    );
  }

  async simulate(history: readonly SimulatorTurn[], draft: AiDraft): Promise<SimulatorReply> {
    await simulateLatency();
    void history;
    void draft;
    return { reply: DEMO_AI_REPLY, handoff: null, toolsUsed: [] };
  }

  /** Lê as conversas guardadas; na primeira vez, grava os exemplos. */
  private conversations(state: DemoState): { contacts: WhatsAppContact[]; chat: Record<string, WhatsAppChatMessage[]> } {
    if (!state.whatsappContacts || !state.whatsappChat) {
      const seed = seedConversations();
      state.whatsappContacts = seed.contacts;
      state.whatsappChat = seed.chat;
    }
    return { contacts: state.whatsappContacts, chat: state.whatsappChat };
  }

  private updateContact(contactId: string, change: (contact: WhatsAppContact) => void) {
    this.db.write((state) => {
      const contact = this.conversations(state).contacts.find((item) => item.id === contactId);
      if (contact) change(contact);
    });
  }

  async listContacts(): Promise<WhatsAppContact[]> {
    const contacts = this.db.write((state) => this.conversations(state).contacts);
    return [...contacts].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  }

  async listChat(contactId: string): Promise<WhatsAppChatMessage[]> {
    return this.db.write((state) => this.conversations(state).chat[contactId] ?? []);
  }

  async setHandler(contactId: string, handler: WhatsAppHandler): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const contact = this.conversations(state).contacts.find((item) => item.id === contactId);
      if (!contact) return;
      contact.handler = handler;
      // Mudou quem atende: o fluxo em andamento acaba, como no banco.
      delete this.flowState(state)[contactId];
      if (handler === "ai") {
        contact.handoffSummary = null;
        contact.unreadCount = 0;
      }
    });
  }

  async setContactKind(contactId: string, kind: WhatsAppContactKind): Promise<void> {
    await simulateLatency();
    this.updateContact(contactId, (contact) => {
      contact.kind = kind;
    });
  }

  async markRead(contactId: string): Promise<void> {
    this.updateContact(contactId, (contact) => {
      contact.unreadCount = 0;
    });
  }

  private append(state: DemoState, contactId: string, author: WhatsAppChatMessage["author"], body: string) {
    const { contacts, chat } = this.conversations(state);
    const now = new Date().toISOString();
    chat[contactId] = [
      ...(chat[contactId] ?? []),
      { id: newId("msg"), author, body, status: author === "customer" ? "received" : "test", error: null, createdAt: now },
    ];
    const contact = contacts.find((item) => item.id === contactId);
    if (!contact) return;
    contact.lastMessageAt = now;
    contact.lastMessagePreview = body.slice(0, 160);
    if (author === "customer") {
      contact.lastInboundAt = now;
      contact.unreadCount += 1;
    } else contact.unreadCount = 0;
  }

  async sendReply(contactId: string, text: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      this.append(state, contactId, "staff", text);
      const contact = this.conversations(state).contacts.find((item) => item.id === contactId);
      if (contact) contact.handler = "staff";
      delete this.flowState(state)[contactId];
    });
  }

  async simulateInbound(phone: string, name: string | null, text: string): Promise<{ contactId: string; outcome: InboundOutcome }> {
    await simulateLatency();
    const ai = await this.getAiSettings();
    return this.db.write((state) => {
      const { contacts } = this.conversations(state);
      let contact = contacts.find((item) => item.phone === phone);
      const isNew = !contact;
      if (!contact) {
        contact = {
          id: newId("wa"),
          phone,
          name,
          kind: "lead",
          handler: "ai",
          optedOut: false,
          handoffSummary: null,
          unreadCount: 0,
          lastInboundAt: null,
          lastMessageAt: new Date().toISOString(),
          lastMessagePreview: null,
        };
        contacts.push(contact);
      }
      this.append(state, contact.id, "customer", text);
      if (contact.handler === "staff") return { contactId: contact.id, outcome: "staff" as const };

      const flow = this.runFlow(state, contact, text, isNew, ai);
      if (flow === "handled") return { contactId: contact.id, outcome: "flow" as const };
      if (flow === "handoff") return { contactId: contact.id, outcome: "handoff" as const };
      if (!ai.enabled) return { contactId: contact.id, outcome: "ai_off" as const };
      this.append(state, contact.id, "ai", DEMO_AI_REPLY);
      return { contactId: contact.id, outcome: "replied" as const };
    });
  }

  private flowState(state: DemoState): Record<string, { flowId: string; node: string }> {
    state.whatsappFlowState ??= {};
    return state.whatsappFlowState;
  }

  private flows(state: DemoState): WhatsAppFlow[] {
    state.whatsappFlows ??= SEED_FLOWS();
    return state.whatsappFlows;
  }

  /** O mesmo caminho da função whatsapp-webhook, com o motor compartilhado. */
  private runFlow(
    state: DemoState,
    contact: WhatsAppContact,
    text: string,
    isNew: boolean,
    ai: WhatsAppAiSettings,
  ): "handled" | "handoff" | "ai" | "none" {
    const flows = this.flows(state).filter((flow) => flow.enabled);
    const states = this.flowState(state);
    const hours = { schedule: ai.schedule, start: ai.businessStart, end: ai.businessEnd, days: ai.businessDays };
    const context = { kind: contact.kind, businessHours: isBusinessHours(hours, new Date()) };

    let flowId: string | null = null;
    let step: FlowStep | null = null;
    const saved = states[contact.id];
    const waiting = saved ? flows.find((flow) => flow.id === saved.flowId) : undefined;
    if (saved && waiting) {
      const answered = answerFlow(waiting.graph, saved.node, text, context);
      if (answered.actions.length > 0 || answered.waitingAt) {
        flowId = waiting.id;
        step = answered;
      }
    }
    if (!step) {
      const picked = pickFlow(flows, { body: text, isNew });
      if (picked) {
        flowId = picked.id;
        step = startFlow(picked.graph, context);
      }
    }
    if (step?.waitingAt && flowId) states[contact.id] = { flowId, node: step.waitingAt };
    else delete states[contact.id];
    if (!step || (step.actions.length === 0 && !step.waitingAt)) return "none";

    for (const action of step.actions) {
      if (action.type === "send") {
        this.append(state, contact.id, "system", renderWithOptions(action.text, action.options));
      } else if (action.type === "handoff") {
        contact.handler = "staff";
        contact.handoffSummary = action.note.trim() || "O fluxo passou a conversa para você.";
        contact.unreadCount = 1;
        return "handoff";
      } else {
        return "ai";
      }
    }
    return "handled";
  }

  async listFlows(): Promise<WhatsAppFlow[]> {
    return this.db.read().whatsappFlows ?? SEED_FLOWS();
  }

  async saveFlow(draft: WhatsAppFlowDraft): Promise<WhatsAppFlow> {
    await simulateLatency();
    return this.db.write((state) => {
      const flows = this.flows(state);
      const saved: WhatsAppFlow = {
        id: draft.id ?? newId("flow"),
        name: draft.name,
        enabled: draft.enabled,
        graph: draft.graph,
        updatedAt: new Date().toISOString(),
      };
      const index = flows.findIndex((flow) => flow.id === saved.id);
      if (index >= 0) flows[index] = saved;
      else flows.push(saved);
      return saved;
    });
  }

  async deleteFlow(id: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      state.whatsappFlows = this.flows(state).filter((flow) => flow.id !== id);
      const states = this.flowState(state);
      for (const [contactId, saved] of Object.entries(states)) if (saved.flowId === id) delete states[contactId];
    });
  }
}
