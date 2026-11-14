import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, MessageSquareText, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { deleteCannedReply, listCannedReplies, saveCannedReply } from "@/application/support-use-cases";
import {
  MAX_CANNED_BODY_LENGTH,
  MAX_CANNED_TITLE_LENGTH,
  type SupportCannedReply,
  type SupportCannedReplyData,
  type SupportRole,
} from "@/domain/support-ticket";
import { Button } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";
import { InlineError } from "../components/AdminUi";
import { useAdminQuery, useMutation } from "../hooks";
import { useCloseOnOutsideClick } from "../lib/use-close-on-outside";
import { useToast } from "../toast";

type Editing = { id: string | null; draft: SupportCannedReplyData } | null;

const fieldClass =
  "w-full rounded-xl border border-line-strong bg-ink px-3 text-sm text-white placeholder:text-mist/70 focus:border-electric focus:outline-none";

function CannedForm({ editing, onCancel, onSaved, role }: { editing: NonNullable<Editing>; onCancel: () => void; onSaved: () => void; role: SupportRole }) {
  const titleId = useId();
  const bodyId = useId();
  const [draft, setDraft] = useState(editing.draft);
  const save = useMutation((deps, data: SupportCannedReplyData) => saveCannedReply(deps, role, editing.id, data));

  const submit = async () => {
    if (await save.run(draft)) onSaved();
  };

  // Fica dentro do formulário da resposta: não pode ser outro <form> (o Salvar enviaria a resposta do chamado).
  // Enter no nome salva, sem enviar a resposta.
  const onTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void submit();
  };

  return (
    <div role="group" aria-label={editing.id ? "Editar resposta pronta" : "Nova resposta pronta"} className="space-y-2 p-1">
      <label htmlFor={titleId} className="text-xs font-medium text-fog">
        Nome
      </label>
      <input
        id={titleId}
        autoFocus
        maxLength={MAX_CANNED_TITLE_LENGTH}
        value={draft.title}
        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        onKeyDown={onTitleKeyDown}
        placeholder="Publicado, Preciso de um print…"
        className={cn(fieldClass, "h-10")}
      />
      <label htmlFor={bodyId} className="text-xs font-medium text-fog">
        Texto
      </label>
      <textarea
        id={bodyId}
        rows={4}
        maxLength={MAX_CANNED_BODY_LENGTH}
        value={draft.body}
        onChange={(event) => setDraft({ ...draft, body: event.target.value })}
        className={cn(fieldClass, "resize-y py-2")}
      />
      {save.error && <InlineError message={save.error.message} />}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={save.pending}>
          Voltar
        </Button>
        <Button type="button" onClick={() => void submit()} disabled={save.pending}>
          {save.pending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

function CannedItem({ reply, onUse, onEdit, onDeleted, role }: {
  reply: SupportCannedReply;
  onUse: () => void;
  onEdit: () => void;
  onDeleted: () => void;
  role: SupportRole;
}) {
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation(async (deps) => {
    await deleteCannedReply(deps, role, reply.id);
    return true;
  });
  return (
    <li className="group flex items-start gap-1 rounded-xl hover:bg-white/[0.04]">
      <button type="button" onClick={onUse} className="min-w-0 flex-1 rounded-xl px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-electric">
        <span className="block truncate text-sm font-semibold text-white">{reply.title}</span>
        <span className="line-clamp-2 text-xs text-mist">{reply.body}</span>
      </button>
      {confirming ? (
        <button
          type="button"
          onClick={() => void remove.run().then((ok) => ok && onDeleted())}
          disabled={remove.pending}
          className="mt-1.5 shrink-0 rounded-full bg-alert px-3 py-1 text-xs font-semibold text-white hover:bg-[#ff4d4d]"
        >
          {remove.pending ? "Apagando…" : "Apagar?"}
        </button>
      ) : (
        <span className="mt-1 flex shrink-0">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Editar a resposta ${reply.title}`}
            className="grid size-8 place-items-center rounded-full text-mist hover:bg-white/[0.08] hover:text-white"
          >
            <Pencil aria-hidden className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Apagar a resposta ${reply.title}`}
            className="grid size-8 place-items-center rounded-full text-mist hover:bg-alert/10 hover:text-alert"
          >
            <Trash2 aria-hidden className="size-3.5" />
          </button>
        </span>
      )}
    </li>
  );
}

interface CannedRepliesProps {
  role: SupportRole;
  /** O que já está escrito na resposta: dá para salvar como resposta pronta. */
  currentText: string;
  onInsert: (text: string) => void;
}

/** "Respostas prontas" da desenvolvedora: um clique põe o texto na resposta; criar, editar e apagar ali mesmo. */
export function CannedReplies({ role, currentText, onInsert }: CannedRepliesProps) {
  const toast = useToast();
  const reduceMotion = useReducedMotion();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const replies = useAdminQuery((deps) => listCannedReplies(deps, role), "support-canned-replies");
  const close = useCallback(() => {
    setOpen(false);
    setEditing(null);
  }, []);
  useCloseOnOutsideClick(open, close, rootRef);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  const use = (reply: SupportCannedReply) => {
    onInsert(reply.body);
    close();
  };

  const saved = () => {
    toast.show(editing?.id ? "Resposta pronta atualizada." : "Resposta pronta salva.");
    setEditing(null);
    replies.reload();
  };

  const list = replies.status === "success" ? replies.data : [];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-fog transition-colors hover:border-white/30 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
      >
        <MessageSquareText aria-hidden className="size-4" /> Respostas prontas
        <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            role="dialog"
            aria-label="Respostas prontas"
            initial={reduceMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full left-0 z-30 mt-2 w-[min(26rem,calc(100vw-2.5rem))] origin-top-left rounded-2xl border border-line-strong bg-surface-2 p-2 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.8)]"
          >
            {editing ? (
              <CannedForm editing={editing} role={role} onCancel={() => setEditing(null)} onSaved={saved} />
            ) : (
              <>
                {replies.status === "loading" && <p className="px-3 py-4 text-sm text-mist">Carregando…</p>}
                {replies.status === "error" && <InlineError message={replies.error.message} />}
                {replies.status === "success" && list.length === 0 && (
                  <p className="px-3 py-4 text-sm text-mist">Nenhuma resposta pronta ainda. Crie a primeira abaixo.</p>
                )}
                {list.length > 0 && (
                  <ul className="max-h-72 space-y-0.5 overflow-y-auto">
                    {list.map((reply) => (
                      <CannedItem
                        key={reply.id}
                        reply={reply}
                        role={role}
                        onUse={() => use(reply)}
                        onEdit={() => setEditing({ id: reply.id, draft: { title: reply.title, body: reply.body } })}
                        onDeleted={() => {
                          toast.show("Resposta pronta apagada.");
                          replies.reload();
                        }}
                      />
                    ))}
                  </ul>
                )}
                <div className="mt-1 flex flex-wrap gap-1 border-t border-line pt-2">
                  <button
                    type="button"
                    onClick={() => setEditing({ id: null, draft: { title: "", body: "" } })}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-electric-soft hover:bg-white/[0.06]"
                  >
                    <Plus aria-hidden className="size-3.5" /> Nova resposta pronta
                  </button>
                  {currentText.trim() && (
                    <button
                      type="button"
                      onClick={() => setEditing({ id: null, draft: { title: "", body: currentText.trim() } })}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-fog hover:bg-white/[0.06] hover:text-white"
                    >
                      Salvar o texto escrito
                    </button>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
