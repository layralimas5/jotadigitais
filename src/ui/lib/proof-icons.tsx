import {
  BadgeCheck,
  CircleCheck,
  Clock,
  CreditCard,
  Headset,
  Lock,
  Mail,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { normalizeSearch } from "@/application/catalog";
import type { ProofIcon, ProofPoint } from "@/domain/site-content";
import { WhatsAppGlyph } from "@/ui/components/whatsapp/WhatsAppGlyph";

export type ProofIconComponent = LucideIcon | typeof WhatsAppGlyph;

type FixedProofIcon = Exclude<ProofIcon, "auto">;

/** Ícone e nome de cada opção do seletor (o nome vai para o leitor de tela e para a dica do botão). */
export const PROOF_ICON_VIEW: Record<FixedProofIcon, { icon: ProofIconComponent; label: string }> = {
  shield: { icon: ShieldCheck, label: "Escudo" },
  badge: { icon: BadgeCheck, label: "Verificado" },
  users: { icon: Users, label: "Seguidores" },
  wallet: { icon: Wallet, label: "Carteira" },
  card: { icon: CreditCard, label: "Cartão" },
  mail: { icon: Mail, label: "E-mail" },
  whatsapp: { icon: WhatsAppGlyph, label: "WhatsApp" },
  zap: { icon: Zap, label: "Rápido" },
  clock: { icon: Clock, label: "Relógio" },
  lock: { icon: Lock, label: "Cadeado" },
  star: { icon: Star, label: "Estrela" },
  headset: { icon: Headset, label: "Suporte" },
  check: { icon: CircleCheck, label: "Check" },
  trending: { icon: TrendingUp, label: "Crescimento" },
};

/** No modo automático o ícone sai do texto. A primeira regra que bater vale. */
const AUTO_RULES: readonly { words: RegExp; icon: FixedProofIcon }[] = [
  { words: /whats|zap/, icon: "whatsapp" },
  { words: /e-?mail/, icon: "mail" },
  { words: /pix|cartao|parcel|\d+x|pagamento|boleto/, icon: "wallet" },
  { words: /seguidor|garantia|seguran|segur|real|reais|verificad|conferid/, icon: "shield" },
];

export function autoProofIcon(text: string): FixedProofIcon {
  const normalized = normalizeSearch(text);
  return AUTO_RULES.find((rule) => rule.words.test(normalized))?.icon ?? "check";
}

export function resolveProofIcon(point: ProofPoint): FixedProofIcon {
  return point.icon === "auto" ? autoProofIcon(point.text) : point.icon;
}

export function proofIconComponent(point: ProofPoint): ProofIconComponent {
  return PROOF_ICON_VIEW[resolveProofIcon(point)].icon;
}
