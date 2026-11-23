import { Megaphone, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  affiliateAnnouncementSchema,
  listAffiliateAnnouncements,
  removeAffiliateAnnouncement,
  saveAffiliateAnnouncement,
} from "@/application/affiliate-use-cases";
import { fieldErrorsOf } from "@/application/schemas";
import type { AffiliateAnnouncement, AffiliateAnnouncementData } from "@/domain/affiliate";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { InlineError, LoadingBlock } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TextAreaField, ToggleField } from "../components/FormControls";
import { useAdminQuery, useMutation } from "../hooks";
import { formatDate } from "../lib/dates";
import { useToast } from "../toast";

const EMPTY: AffiliateAnnouncementData = { title: "", body: "", pinned: false };

function AnnouncementForm({
  editing,
  onDone,
  onCancel,
}: {
  editing: AffiliateAnnouncement | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [values, setValues] = useState<AffiliateAnnouncementData>(editing ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation((deps, raw: unknown) => saveAffiliateAnnouncement(deps, editing?.id ?? null, raw));

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = affiliateAnnouncementSchema.safeParse(values);
    setErrors(result.success ? {} : fieldErrorsOf(result.error));
    if (!result.success) return;
    const saved = await save.run(values);
    if (!saved) return;
    toast.show(editing ? "Recado atualizado." : "Recado publicado no painel dos afiliados.");
    onDone();
  };

  return (
    <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="space-y-4 rounded-3xl border border-line bg-surface p-4 sm:p-5">
      <TextField
        label="Título"
        name="title"
        maxLength={120}
        placeholder="Ex.: Chegaram 5 contas de TikTok com Shop"
        value={values.title}
        onChange={(event) => setValues({ ...values, title: event.target.value })}
        error={errors.title}
      />
      <TextAreaField
        label="Recado"
        name="body"
        rows={4}
        maxLength={4000}
        value={values.body}
        onChange={(event) => setValues({ ...values, body: event.target.value })}
        error={errors.body}
      />
      <ToggleField label="Fixar no topo" checked={values.pinned} onChange={(pinned) => setValues({ ...values, pinned })} />
      {save.error && <InlineError message={save.error.message} />}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={save.pending}>
          {save.pending ? "Salvando…" : editing ? "Salvar recado" : "Publicar"}
        </Button>
      </div>
    </form>
  );
}

/** Mural de comunicados: o que o Jota publica aparece na tela inicial de todo afiliado aprovado. */
export function AffiliateMuralTab() {
  const toast = useToast();
  const announcements = useAdminQuery(listAffiliateAnnouncements, "affiliate-announcements");
  const [editing, setEditing] = useState<AffiliateAnnouncement | "new" | null>(null);
  const [removing, setRemoving] = useState<AffiliateAnnouncement | null>(null);
  const remove = useMutation(async (deps, id: string) => {
    await removeAffiliateAnnouncement(deps, id);
    return true;
  });

  const done = () => {
    setEditing(null);
    announcements.reload();
  };

  const confirmRemove = async () => {
    if (!removing) return;
    const removed = await remove.run(removing.id);
    if (!removed) return;
    toast.show("Recado apagado.");
    setRemoving(null);
    announcements.reload();
  };

  return (
    <div className="max-w-3xl space-y-5">
      {editing === null ? (
        <Button onClick={() => setEditing("new")}>
          <Plus aria-hidden className="size-4" /> Novo recado
        </Button>
      ) : (
        <AnnouncementForm key={editing === "new" ? "new" : editing.id} editing={editing === "new" ? null : editing} onDone={done} onCancel={() => setEditing(null)} />
      )}

      {announcements.status === "loading" && <LoadingBlock />}
      {announcements.status === "error" && <ErrorState message={announcements.error.message} onRetry={announcements.reload} />}
      {announcements.status === "success" && announcements.data.length === 0 && editing === null && (
        <EmptyState title="Mural vazio" description="Use o mural para avisar os afiliados de contas novas, campanhas e mudanças nas regras." />
      )}
      {announcements.status === "success" && announcements.data.length > 0 && (
        <ul className="grid gap-3">
          {announcements.data.map((item) => (
            <li key={item.id} className="rounded-3xl border border-line bg-surface/60 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 font-semibold text-white">
                    {item.pinned ? <Pin aria-label="Fixado" className="size-4 shrink-0 text-electric" /> : <Megaphone aria-hidden className="size-4 shrink-0 text-mist" />}
                    <span className="truncate">{item.title}</span>
                  </h3>
                  <p className="mt-0.5 text-xs text-mist">{formatDate(item.createdAt)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(item)}
                    aria-label={`Editar ${item.title}`}
                    className="grid size-9 place-items-center rounded-full text-mist hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-electric"
                  >
                    <Pencil aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoving(item)}
                    aria-label={`Apagar ${item.title}`}
                    className="grid size-9 place-items-center rounded-full text-mist hover:bg-alert/10 hover:text-[#ff9a9a] focus-visible:outline-2 focus-visible:outline-electric"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </div>
              </div>
              <p className="mt-3 text-sm whitespace-pre-line text-fog">{item.body}</p>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Apagar este recado?"
        description="Ele some do painel de todos os afiliados."
        confirmLabel="Apagar"
        pending={remove.pending}
        onConfirm={() => void confirmRemove()}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
