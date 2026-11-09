import { CheckCircle2, TicketPercent, X } from "lucide-react";
import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { formatBRL } from "@/domain/money";
import { cn } from "@/ui/lib/cn";
import type { CouponController } from "@/ui/hooks/useCoupon";

/**
 * Cupom no resumo do pedido. Fica recolhido em "Tem um cupom?" para não distrair quem não tem.
 * Não é um <form> próprio: está dentro do checkout, então Enter aplica o cupom sem enviar o pedido.
 */
export function CouponField({ coupon, disabled = false }: { coupon: CouponController; disabled?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const { state } = coupon;
  const checking = state.status === "checking";

  if (state.status === "applied") {
    return (
      <div role="status" className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.07] px-4 py-3">
        <CheckCircle2 aria-hidden className="size-4 shrink-0 text-emerald-300" />
        <p className="min-w-0 flex-1 text-sm text-white">
          Cupom <strong className="font-mono">{state.applied.code}</strong> aplicado
          <span className="block text-xs text-emerald-200">Você economiza {formatBRL(state.applied.discount)}</span>
        </p>
        <button
          type="button"
          onClick={() => {
            coupon.remove();
            setCode("");
          }}
          disabled={disabled}
          aria-label={`Remover o cupom ${state.applied.code}`}
          className="grid size-8 shrink-0 place-items-center rounded-full text-mist hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-electric"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-electric-soft hover:underline focus-visible:outline-2 focus-visible:outline-electric"
      >
        <TicketPercent aria-hidden className="size-4" /> Tem um cupom de desconto?
      </button>
    );
  }

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!code.trim() || checking || disabled) return;
    void coupon.apply(code);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") submit(event);
  };

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-fog">
        Cupom de desconto
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id={id}
          name="couponCode"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={30}
          placeholder="Digite o código"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          onKeyDown={onKeyDown}
          aria-invalid={state.status === "error" ? true : undefined}
          aria-describedby={state.status === "error" ? `${id}-error` : undefined}
          className={cn(
            "h-11 min-w-0 flex-1 rounded-xl border bg-ink px-4 font-mono text-sm tracking-wide text-white uppercase placeholder:font-sans placeholder:tracking-normal placeholder:normal-case placeholder:text-mist/70 focus:outline-none",
            state.status === "error" ? "border-alert/70 focus:border-alert" : "border-line-strong focus:border-electric",
          )}
        />
        <button
          type="button"
          onClick={() => submit()}
          disabled={!code.trim() || checking || disabled}
          className="h-11 shrink-0 rounded-xl border border-line-strong px-4 text-sm font-semibold text-white transition-colors hover:border-electric hover:bg-electric/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-electric"
        >
          {checking ? "Conferindo…" : "Aplicar"}
        </button>
      </div>
      {state.status === "error" && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-[#ff7a7a]">
          {state.error}
        </p>
      )}
    </div>
  );
}
