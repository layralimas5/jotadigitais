/** Onde o sistema guarda dados. Hoje só o Supabase; outro banco entra aqui com o seu leitor de uso. */
export const STORAGE_PROVIDERS = ["supabase"] as const;
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number];

export const STORAGE_PROVIDER_LABEL: Record<StorageProvider, string> = { supabase: "Supabase" };

export interface TableUsage {
  name: string;
  bytes: number;
  /** Estimativa do próprio banco: serve para ordem de grandeza, não para contagem exata. */
  rows: number;
}

export interface BucketUsage {
  id: string;
  public: boolean;
  files: number;
  bytes: number;
}

/** Quanto ocupa e quanto cabe. Limite nulo: o plano não tem teto conhecido. */
export interface Meter {
  usedBytes: number;
  limitBytes: number | null;
}

/** Um banco conectado ao sistema e o uso dele no momento da leitura. */
export interface DatabaseUsage {
  id: string;
  name: string;
  provider: StorageProvider;
  planLabel: string;
  database: Meter;
  files: Meter & { count: number };
  tables: TableUsage[];
  buckets: BucketUsage[];
  measuredAt: string;
}

/** Faixas de alerta: abaixo de 70% tranquilo, até 90% atenção, acima disso perto do limite. */
export type UsageLevel = "ok" | "warning" | "critical";

export const usageShare = (meter: Meter): number | null => (meter.limitBytes ? Math.min(1, meter.usedBytes / meter.limitBytes) : null);

export function usageLevelOf(meter: Meter): UsageLevel {
  const share = usageShare(meter);
  if (share === null || share < 0.7) return "ok";
  return share < 0.9 ? "warning" : "critical";
}

const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** "15 MB", "1,2 GB": base 1024, como o painel do Supabase mostra; a partir de 1000 já sobe de unidade ("1 GB", não "1.008 MB"). */
export function formatBytes(bytes: number): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? Math.round(value) : decimal.format(value)} ${UNITS[unit]}`;
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

/** Limites de cada plano do Supabase (banco e arquivos). */
export const SUPABASE_PLANS = {
  free: { label: "Plano grátis", database: 500 * MB, files: 1 * GB },
  pro: { label: "Plano Pro", database: 8 * GB, files: 100 * GB },
} as const;
export type SupabasePlan = keyof typeof SUPABASE_PLANS;

/** Nome em português de cada tabela, para o Jota entender o que ocupa espaço. Tabela nova sem nome aparece crua. */
const TABLE_LABEL: Record<string, string> = {
  accounts: "Contas",
  admin_preferences: "Preferências do painel",
  admin_users: "Usuários do sistema",
  audit_events: "Histórico de alterações",
  consent_records: "Consentimentos de cookies",
  countries: "Países",
  coupons: "Cupons",
  customers: "Clientes",
  data_requests: "Pedidos de privacidade",
  email_accounts: "E-mails das contas",
  expenses: "Despesas",
  leads: "CRM",
  legal_documents: "Termos e privacidade",
  message_templates: "Mensagens prontas",
  notification_dismissals: "Avisos apagados",
  notifications: "Avisos do sininho",
  order_payments: "Pagamentos",
  orders: "Pedidos",
  partners: "Parceiros",
  rate_limit_hits: "Proteção contra abuso",
  revenues: "Receitas",
  site_content: "Textos do site",
  store_settings: "Configurações da loja",
  support_attachments: "Anexos do suporte",
  support_labels: "Etiquetas do suporte",
  support_replies: "Respostas do suporte",
  support_status_events: "Histórico do suporte",
  support_ticket_views: "Leituras do suporte",
  support_tickets: "Chamados de suporte",
  testimonials: "Depoimentos",
};

export const tableLabelOf = (name: string): string => TABLE_LABEL[name] ?? name;

const BUCKET_LABEL: Record<string, string> = {
  media: "Fotos e imagens (contas, site, depoimentos)",
  support: "Anexos do suporte",
};

export const bucketLabelOf = (id: string): string => BUCKET_LABEL[id] ?? id;
