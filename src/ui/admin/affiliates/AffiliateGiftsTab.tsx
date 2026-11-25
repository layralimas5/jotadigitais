import { Gift, PackageCheck, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  affiliateGiftSchema,
  loadGiftBoard,
  removeAffiliateGift,
  saveAffiliateGift,
  setAffiliateGiftDelivered,
  type GiftBoardItem,
} from "@/application/affiliate-use-cases";
import { fieldErrorsOf } from "@/application/schemas";
import type { Affiliate } from "@/domain/affiliate";
import type { AffiliateGift } from "@/domain/affiliate-rewards";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { InlineError, LoadingBlock } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SelectField, TextAreaField, ToggleField } from "../components/FormControls";
import { Modal } from "../components/Modal";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";

const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

interface GiftFormValues {
  title: string;
  description: string;
  affiliateId: string;
  /** "aaaa-mm-dd" do campo de data; vazio = sem prazo. */
  expiresOn: string;
  active: boolean;
}

const EMPTY_FORM: GiftFormValues = { title: "", description: "", affiliateId: "", expiresOn: "", active: true };

const fromGift = (gift: AffiliateGift): GiftFormValues => ({
  title: gift.title,
  description: gift.description ?? "",
  affiliateId: gift.affiliateId ?? "",
  expiresOn: gift.expiresAt ? gift.expiresAt.slice(0, 10) : "",
  active: gift.active,
});

/** O prazo vale até o fim do dia escolhido, no horário do navegador. */
const toRaw = (values: GiftFormValues) => ({
  title: values.title,
  description: values.description,
  affiliateId: values.affiliateId || null,
  expiresAt: values.expiresOn ? new Date(`${values.expiresOn}T23:59:59`).toISOString() : null,
  active: values.active,
});

function GiftForm({
  editing,
  affiliates,
  onClose,
  onSaved,
}: {
  editing: AffiliateGift | "new";
  affiliates: readonly Affiliate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [values, setValues] = useState<GiftFormValues>(() => (editing === "new" ? EMPTY_FORM : fromGift(editing)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation(saveAffiliateGift);
  const update = (patch: Partial<GiftFormValues>) => setValues((current) => ({ ...current, ...patch }));

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = affiliateGiftSchema.safeParse(toRaw(values));
    if (!result.success) {
      setErrors(fieldErrorsOf(result.error));
      return;
    }
    setErrors({});
    const saved = await save.run(editing === "new" ? null : editing.id, toRaw(values));
    if (!saved) return;
    toast.show(editing === "new" ? "Brinde criado. Já aparece no painel dos afiliados." : "Brinde salvo.");
    onSaved();
  };

  const approved = affiliates.filter((affiliate) => affiliate.status === "approved");
  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      <TextField
        label="Nome do brinde"
        name="giftTitle"
        maxLength={120}
        autoComplete="off"
        placeholder="Ex.: Aula bônus de TikTok Shop"
        value={values.title}
        onChange={(event) => update({ title: event.target.value })}
        error={errors.title}
      />
      <TextAreaField
        label="Descrição (opcional)"
        name="giftDescription"
        rows={3}
        maxLength={1000}
        placeholder="O que é e como ele vai receber."
        value={values.description}
        onChange={(event) => update({ description: event.target.value })}
        error={errors.description}
      />
      <SelectField
        label="Para quem"
        name="giftAffiliate"
        value={values.affiliateId}
        onChange={(event) => update({ affiliateId: event.target.value })}
        options={[{ value: "", label: "Todos os afiliados aprovados" }, ...approved.map((affiliate) => ({ value: affiliate.id, label: affiliate.name }))]}
      />
      <TextField
        label="Receber até (opcional)"
        name="giftExpires"
        type="date"
        value={values.expiresOn}
        onChange={(event) => update({ expiresOn: event.target.value })}
        error={errors.expiresAt}
        hint="Depois dessa data o botão Receber some."
      />
      <ToggleField label="Brinde ligado" description="Desligado, ele some do painel dos afiliados." checked={values.active} onChange={(active) => update({ active })} />
      {save.error && <InlineError message={save.error.message} />}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={save.pending}>
          {save.pending ? "Salvando..." : "Salvar brinde"}
        </Button>
      </div>
    </form>
  );
}

function GiftRow({ item, onEdit, onRemove, onChanged }: { item: GiftBoardItem; onEdit: () => void; onRemove: () => void; onChanged: () => void }) {
  const toast = useToast();
  const deliver = useMutation(async (deps, giftId: string, affiliateId: string, delivered: boolean) => {
    await setAffiliateGiftDelivered(deps, giftId, affiliateId, delivered);
    return true;
  });
  const { gift, claims } = item;
  const waiting = claims.filter((claim) => !claim.deliveredAt).length;

  const toggleDelivered = async (affiliateId: string, delivered: boolean) => {
    const done = await deliver.run(gift.id, affiliateId, delivered);
    if (!done) {
      toast.show("Não deu para salvar agora. Tente de novo.", "error");
      return;
    }
    onChanged();
  };

  return (
    <li className={cn("rounded-3xl border p-4 sm:p-5", waiting > 0 ? "border-electric/45 bg-electric/[0.05]" : "border-line bg-surface/60")}>
      <div className="flex items-start gap-3">
        <Gift aria-hidden className={cn("mt-0.5 size-5 shrink-0", gift.active ? "text-electric" : "text-mist")} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">
            {gift.title}
            {!gift.active && <span className="ml-2 text-xs font-normal text-mist">(desligado)</span>}
          </p>
          <p className="mt-0.5 text-xs text-mist">
            {item.affiliateName ? `Só para ${item.affiliateName}` : "Para todos os aprovados"}
            {gift.expiresAt ? ` · até ${dateTime.format(new Date(gift.expiresAt))}` : ""}
            {` · ${claims.length} ${claims.length === 1 ? "pedido" : "pedidos"}`}
            {waiting > 0 ? `, ${waiting} para entregar` : ""}
          </p>
        </div>
        <Button variant="ghost" onClick={onEdit} aria-label={`Editar ${gift.title}`}>
          <Pencil aria-hidden className="size-4" />
        </Button>
        <Button variant="ghost" onClick={onRemove} aria-label={`Apagar ${gift.title}`}>
          <Trash2 aria-hidden className="size-4" />
        </Button>
      </div>
      {claims.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-ink/50">
          {claims.map((claim) => (
            <li key={claim.affiliateId} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-white">{claim.affiliateName}</span>
                <span className="block text-xs text-mist">Pediu em {dateTime.format(new Date(claim.claimedAt))}</span>
              </span>
              {claim.deliveredAt ? (
                <button
                  type="button"
                  onClick={() => void toggleDelivered(claim.affiliateId, false)}
                  disabled={deliver.pending}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-fog hover:text-white"
                >
                  <PackageCheck aria-hidden className="size-4 text-electric" /> Entregue (desfazer)
                </button>
              ) : (
                <Button onClick={() => void toggleDelivered(claim.affiliateId, true)} disabled={deliver.pending}>
                  Marcar como entregue
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Aba Brindes: o Jota cria o brinde, o afiliado toca em "Receber" e aparece aqui para entregar. */
export function AffiliateGiftsTab() {
  const toast = useToast();
  const board = useAdminQuery(loadGiftBoard, "admin-affiliate-gifts");
  const [editing, setEditing] = useState<AffiliateGift | "new" | null>(null);
  const [removing, setRemoving] = useState<AffiliateGift | null>(null);
  const remove = useMutation(async (deps, id: string) => {
    await removeAffiliateGift(deps, id);
    return true;
  });

  if (board.status === "loading") return <LoadingBlock />;
  if (board.status === "error") return <ErrorState message={board.error.message} onRetry={board.reload} />;

  const confirmRemove = async () => {
    if (!removing) return;
    const done = await remove.run(removing.id);
    if (!done) {
      toast.show("Não deu para apagar agora. Tente de novo.", "error");
      return;
    }
    toast.show("Brinde apagado.");
    setRemoving(null);
    board.reload();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-fog">O afiliado recebe o aviso no sininho do painel e você recebe o pedido aqui e no seu sininho.</p>
        <Button onClick={() => setEditing("new")} className="shrink-0">
          <Plus aria-hidden className="size-4" /> Novo brinde
        </Button>
      </div>
      {board.data.items.length === 0 ? (
        <EmptyState title="Nenhum brinde criado" description="Crie um brinde para premiar quem mais divulga. Ele aparece na aba Brindes do painel do afiliado." />
      ) : (
        <ul className="space-y-3">
          {board.data.items.map((item) => (
            <GiftRow key={item.gift.id} item={item} onEdit={() => setEditing(item.gift)} onRemove={() => setRemoving(item.gift)} onChanged={board.reload} />
          ))}
        </ul>
      )}
      <Modal open={editing !== null} title={editing === "new" ? "Novo brinde" : "Editar brinde"} onClose={() => setEditing(null)}>
        {editing !== null && (
          <GiftForm
            key={editing === "new" ? "new" : editing.id}
            editing={editing}
            affiliates={board.data.affiliates}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              board.reload();
            }}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={removing !== null}
        title="Apagar este brinde?"
        description="Ele some do painel dos afiliados, junto com os pedidos dele."
        confirmLabel="Apagar"
        pending={remove.pending}
        onConfirm={() => void confirmRemove()}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
