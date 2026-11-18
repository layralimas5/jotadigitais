import {
  AFFILIATE_STATUS_LABEL,
  COMMISSION_STATE_LABEL,
  commissionStateOf,
  type AffiliateCommission,
  type AffiliateStatus,
  type CommissionState,
} from "@/domain/affiliate";
import { cn } from "@/ui/lib/cn";

const pill = "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold";

const STATUS_TONE: Record<AffiliateStatus, string> = {
  pending: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  approved: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  rejected: "border-white/15 bg-white/[0.05] text-mist",
  suspended: "border-orange-400/40 bg-orange-400/10 text-orange-200",
  blocked: "border-alert/50 bg-alert/10 text-[#ff9a9a]",
};

export function AffiliateStatusBadge({ status }: { status: AffiliateStatus }) {
  return <span className={cn(pill, STATUS_TONE[status])}>{AFFILIATE_STATUS_LABEL[status]}</span>;
}

const STATE_TONE: Record<CommissionState, string> = {
  pending: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  released: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  paid: "border-electric/50 bg-electric/10 text-electric-soft",
  canceled: "border-white/15 bg-white/[0.05] text-mist line-through decoration-mist/60",
};

export function CommissionStateBadge({ commission }: { commission: Pick<AffiliateCommission, "status" | "releaseAt"> }) {
  const state = commissionStateOf(commission);
  return <span className={cn(pill, STATE_TONE[state])}>{COMMISSION_STATE_LABEL[state]}</span>;
}
