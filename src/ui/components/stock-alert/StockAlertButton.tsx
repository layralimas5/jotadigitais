import { BellRing, Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import { STOCK_ALERT_CATEGORIES, STOCK_ALERT_CATEGORY_LABEL, categoriesLabel, type StockAlertCategory } from "@/domain/stock-alert";
import { Modal } from "@/ui/admin/components/Modal";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { useStockAlert } from "@/ui/hooks/useStockAlert";
import { cn } from "@/ui/lib/cn";

const CATEGORY_HINT: Record<StockAlertCategory, string> = {
  shop_full: "TikTok com todos os produtos do Shop liberados",
  shop_pilot: "TikTok com o Shop ativo em modo piloto",
  tiktok_monetized: "TikTok que já recebe pelas visualizações",
  tiktok: "TikTok sem Shop e sem monetização",
  instagram: "Perfis de Instagram",
  youtube: "Canais de YouTube",
};

function CategoryOption({ category, checked, onToggle }: { category: StockAlertCategory; checked: boolean; onToggle: () => void }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-electric",
        checked ? "border-electric/60 bg-electric/10" : "border-line-strong bg-ink hover:border-white/30",
      )}
    >
      <input type="checkbox" className="sr-only" checked={checked} onChange={onToggle} />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border",
          checked ? "border-electric bg-electric text-ink" : "border-line-strong",
        )}
      >
        {checked && <Check className="size-3.5" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white">{STOCK_ALERT_CATEGORY_LABEL[category]}</span>
        <span className="block text-xs text-mist">{CATEGORY_HINT[category]}</span>
      </span>
    </label>
  );
}

function StockAlertForm({ initial, onClose }: { initial: readonly StockAlertCategory[]; onClose: () => void }) {
  const { state, submit } = useStockAlert();
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [categories, setCategories] = useState<StockAlertCategory[]>([...initial]);
  const errors = state.status === "error" ? state.fieldErrors : {};

  const toggle = (category: StockAlertCategory) =>
    setCategories((current) => (current.includes(category) ? current.filter((item) => item !== category) : [...current, category]));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit({ name, whatsapp, categories: STOCK_ALERT_CATEGORIES.filter((category) => categories.includes(category)) });
  };

  if (state.status === "done") {
    return (
      <div role="status" className="space-y-5">
        <p className="flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.08] p-4 text-sm leading-relaxed text-fog">
          <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-emerald-300" />
          <span>
            Pronto, você está na lista! Assim que chegar conta de <strong className="text-white">{categoriesLabel(categories)}</strong>, a gente te chama no
            WhatsApp.
          </span>
        </p>
        <Button className="w-full" onClick={onClose}>
          Fechar
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <fieldset>
        <legend className="text-sm font-medium text-fog">Quais contas você quer?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {STOCK_ALERT_CATEGORIES.map((category) => (
            <CategoryOption key={category} category={category} checked={categories.includes(category)} onToggle={() => toggle(category)} />
          ))}
        </div>
        {errors.categories && <p className="mt-1.5 text-xs font-medium text-[#ff7a7a]">{errors.categories}</p>}
      </fieldset>
      <TextField label="Seu nome" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} error={errors.name} />
      <TextField
        label="WhatsApp com DDD"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="(84) 91234-5678"
        value={whatsapp}
        onChange={(event) => setWhatsapp(event.target.value)}
        error={errors.whatsapp}
      />
      <p className="text-xs leading-relaxed text-mist">
        Usamos seu nome e WhatsApp só para esse aviso. Quer sair da lista? É só responder a mensagem pedindo.
      </p>
      {state.status === "error" && Object.keys(errors).length === 0 && (
        <p role="alert" className="text-sm font-medium text-[#ff7a7a]">
          {state.message}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={state.status === "submitting"}>
        <BellRing aria-hidden className="size-4" />
        {state.status === "submitting" ? "Salvando..." : "Quero ser avisado"}
      </Button>
    </form>
  );
}

interface StockAlertButtonProps {
  /** Tipos já marcados ao abrir (ex.: o filtro de rede da vitrine). */
  initial?: readonly StockAlertCategory[];
  variant?: "primary" | "secondary";
  className?: string;
}

/** "Me avise quando chegar": o cliente entra na lista de espera do tipo de conta que quer. */
export function StockAlertButton({ initial = [], variant = "secondary", className }: StockAlertButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>
        <BellRing aria-hidden className="size-4" /> Me avise quando chegar conta
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        placement="center"
        title="Avise-me quando chegar"
        description="Escolha os tipos de conta. Quando chegar uma nova, a gente te chama no WhatsApp."
      >
        <StockAlertForm initial={initial} onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}
