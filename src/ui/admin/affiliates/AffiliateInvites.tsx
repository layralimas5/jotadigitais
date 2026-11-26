import { CheckCircle2, MessageCircle, Settings2, UserPlus, X } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import {
  affiliateInviteSchema,
  createAffiliateInvite,
  loadPendingInvites,
  revokeAffiliateInvite,
  type InviteBoardItem,
} from "@/application/affiliate-use-cases";
import { fieldErrorsOf } from "@/application/schemas";
import {
  COMMISSION_KINDS,
  COMMISSION_KIND_LABEL,
  MAX_COMMISSION_PERCENT,
  commissionRuleLabel,
  type AffiliateProgramTexts,
  type CommissionKind,
} from "@/domain/affiliate";
import { commissionRuleSummary, type CommissionRuleData } from "@/domain/affiliate-commission-rules";
import { affiliateInviteLink, affiliateInviteMessage, affiliateInviteWhatsAppUrl, type AffiliateInvite } from "@/domain/affiliate-invite";
import { formatBRL, parseMoneyToCents } from "@/domain/money";
import { LinkBox } from "@/ui/affiliate/components/AffiliateUi";
import { Button, buttonClasses } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { ErrorState } from "@/ui/components/StateViews";
import { InlineError, LoadingBlock } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SegmentedField, TextAreaField, ToggleField } from "../components/FormControls";
import { Modal } from "../components/Modal";
import { PersonAvatar } from "../components/PersonAvatar";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";
import { CommissionRulesEditor, DraftRulesEditor } from "./CommissionRulesEditor";

interface InviteFormValues {
  name: string;
  whatsapp: string;
  email: string;
  customCommission: boolean;
  commissionKind: CommissionKind;
  commissionValue: string;
  note: string;
}

const EMPTY_INVITE: InviteFormValues = { name: "", whatsapp: "", email: "", customCommission: false, commissionKind: "percent", commissionValue: "", note: "" };

const rawInviteOf = (values: InviteFormValues) => ({
  name: values.name,
  whatsapp: values.whatsapp,
  email: values.email,
  commission: values.customCommission
    ? {
        kind: values.commissionKind,
        value: values.commissionKind === "percent" ? Number(values.commissionValue.replace(",", ".").trim()) : parseMoneyToCents(values.commissionValue),
      }
    : null,
  note: values.note,
});

/** Link do convite, copiar e "Mandar no WhatsApp" com a mensagem pronta (editável em Programa > Textos). */
function InviteShare({ invite, texts }: { invite: AffiliateInvite; texts: AffiliateProgramTexts }) {
  const origin = window.location.origin;
  const message = affiliateInviteMessage(texts, invite, origin);
  return (
    <div className="space-y-3">
      <LinkBox link={affiliateInviteLink(origin, invite.token)} label="Copiar link" />
      <a
        href={affiliateInviteWhatsAppUrl(invite.whatsapp, message)}
        target="_blank"
        rel="noreferrer"
        className={buttonClasses({ variant: "secondary", className: "w-full sm:w-auto" })}
      >
        <MessageCircle aria-hidden className="size-4" /> Mandar no WhatsApp
      </a>
    </div>
  );
}

/** "Novo afiliado": convite com a comissão já combinada. A pessoa aceita os termos e valida o CPF ela mesma. */
function NewInviteDialog({ open, texts, onClose, onCreated }: { open: boolean; texts: AffiliateProgramTexts; onClose: () => void; onCreated: () => void }) {
  const formId = useId();
  const [values, setValues] = useState<InviteFormValues>(EMPTY_INVITE);
  const [rules, setRules] = useState<CommissionRuleData[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<AffiliateInvite | null>(null);
  const create = useMutation((deps, raw: unknown, rawRules: readonly unknown[]) => createAffiliateInvite(deps, raw, rawRules));
  const percent = values.commissionKind === "percent";
  const update = (patch: Partial<InviteFormValues>) => setValues((current) => ({ ...current, ...patch }));

  const close = () => {
    setValues(EMPTY_INVITE);
    setRules([]);
    setErrors({});
    setCreated(null);
    onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = rawInviteOf(values);
    const parsed = affiliateInviteSchema.safeParse(raw);
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }
    setErrors({});
    const invite = await create.run(raw, rules);
    if (!invite) return;
    setCreated(invite);
    onCreated();
  };

  return (
    <Modal open={open} title={created ? "Convite criado" : "Novo afiliado"} onClose={close} placement="center">
      {created ? (
        <div className="space-y-4 text-sm">
          <p className="flex gap-2 text-fog">
            <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-300" />
            Mande o link para {created.name.split(" ")[0]}. Ao abrir, a pessoa confere os dados, cria a senha, informa o CPF e aceita os termos. Entra
            aprovada, com a comissão combinada, mesmo com o programa fechado.
          </p>
          <InviteShare invite={created} texts={texts} />
          <div className="flex justify-end">
            <Button onClick={close}>Concluir</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5 text-sm">
          <form id={formId} noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
            <TextField label="Nome" name="inviteName" autoComplete="off" value={values.name} onChange={(event) => update({ name: event.target.value })} error={errors.name} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="WhatsApp"
                name="inviteWhatsapp"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="(84) 99999-0000"
                value={values.whatsapp}
                onChange={(event) => update({ whatsapp: event.target.value })}
                error={errors.whatsapp}
              />
              <TextField
                label="E-mail (opcional)"
                name="inviteEmail"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={values.email}
                onChange={(event) => update({ email: event.target.value })}
                error={errors.email}
              />
            </div>
            <ToggleField
              label="Comissão própria"
              description="Substitui a comissão padrão do programa para esta pessoa."
              checked={values.customCommission}
              onChange={(customCommission) => update({ customCommission })}
            />
            {values.customCommission && (
              <>
                <SegmentedField<CommissionKind>
                  legend="Tipo"
                  name="inviteCommissionKind"
                  value={values.commissionKind}
                  options={COMMISSION_KINDS.map((kind) => ({ value: kind, label: COMMISSION_KIND_LABEL[kind] }))}
                  onChange={(commissionKind) => update({ commissionKind, commissionValue: "" })}
                />
                <TextField
                  label={percent ? "Comissão (%)" : "Comissão por venda (R$)"}
                  name="inviteCommissionValue"
                  inputMode={percent ? "numeric" : "decimal"}
                  autoComplete="off"
                  value={values.commissionValue}
                  onChange={(event) => update({ commissionValue: event.target.value })}
                  error={errors["commission.value"]}
                  hint={percent ? `De 1% a ${MAX_COMMISSION_PERCENT}%.` : "Valor fixo por conta vendida."}
                />
              </>
            )}
            <TextAreaField
              label="Anotação (opcional, só você vê)"
              name="inviteNote"
              rows={2}
              maxLength={500}
              value={values.note}
              onChange={(event) => update({ note: event.target.value })}
              error={errors.note}
            />
          </form>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-white">Comissões personalizadas (opcional)</legend>
            <DraftRulesEditor rules={rules} onChange={setRules} />
          </fieldset>
          {create.error && <InlineError message={create.error.message} />}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" form={formId} disabled={create.pending}>
              <UserPlus aria-hidden className="size-4" /> {create.pending ? "Criando..." : "Criar convite"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function InviteCard({ item, texts, onRules, onRevoke }: { item: InviteBoardItem; texts: AffiliateProgramTexts; onRules: () => void; onRevoke: () => void }) {
  const { invite, rules } = item;
  return (
    <li className="rounded-2xl border border-line bg-surface/70 p-4">
      <div className="flex items-center gap-3">
        <PersonAvatar name={invite.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{invite.name}</p>
          <p className="truncate text-xs text-mist">{[invite.whatsapp, invite.email].filter(Boolean).join(" · ") || "Sem contato"}</p>
        </div>
        <span className="shrink-0 rounded-full border border-amber-300/30 bg-amber-300/[0.08] px-2 py-0.5 text-xs font-semibold text-amber-200">Convite enviado</span>
      </div>
      <ul className="mt-3 space-y-1 text-xs text-fog">
        <li>Comissão: {invite.commission ? commissionRuleLabel(invite.commission, formatBRL) : "a padrão do programa"}</li>
        {rules.map((rule) => (
          <li key={rule.id}>{commissionRuleSummary(rule, formatBRL)}</li>
        ))}
      </ul>
      <div className="mt-4">
        <InviteShare invite={invite} texts={texts} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={onRules}>
          <Settings2 aria-hidden className="size-4" /> Regras
        </Button>
        <Button variant="ghost" onClick={onRevoke}>
          <X aria-hidden className="size-4" /> Cancelar convite
        </Button>
      </div>
    </li>
  );
}

/** Botão "Novo afiliado" e os convites esperando a pessoa aceitar (aba Afiliados). */
export function AffiliateInvitesSection({ texts }: { texts: AffiliateProgramTexts }) {
  const toast = useToast();
  const invites = useAdminQuery(loadPendingInvites, "admin-affiliate-invites");
  const [creating, setCreating] = useState(false);
  const [editingRules, setEditingRules] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<AffiliateInvite | null>(null);
  const revoke = useMutation(async (deps, id: string) => {
    await revokeAffiliateInvite(deps, id);
    return true;
  });
  const items = invites.status === "success" ? invites.data : [];
  const rulesItem = items.find((item) => item.invite.id === editingRules) ?? null;

  const confirmRevoke = async () => {
    if (!revoking) return;
    const done = await revoke.run(revoking.id);
    if (!done) return;
    toast.show(`Convite de ${revoking.name} cancelado. O link deixa de valer.`);
    setRevoking(null);
    invites.reload();
  };

  return (
    <section aria-labelledby="convites-title" className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="convites-title" className="font-display text-lg font-semibold text-white">
            Convites
          </h2>
          <p className="text-sm text-mist">Cadastre um afiliado com a comissão já combinada. Ele aceita os termos e valida o CPF pelo link.</p>
        </div>
        <Button onClick={() => setCreating(true)} className="shrink-0">
          <UserPlus aria-hidden className="size-4" /> Novo afiliado
        </Button>
      </div>
      {invites.status === "loading" && <LoadingBlock label="Carregando convites" />}
      {invites.status === "error" && <ErrorState message={invites.error.message} onRetry={invites.reload} />}
      {items.length > 0 && (
        <ul className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <InviteCard key={item.invite.id} item={item} texts={texts} onRules={() => setEditingRules(item.invite.id)} onRevoke={() => setRevoking(item.invite)} />
          ))}
        </ul>
      )}
      {revoke.error && <InlineError message={revoke.error.message} />}
      <NewInviteDialog open={creating} texts={texts} onClose={() => setCreating(false)} onCreated={invites.reload} />
      <Modal open={rulesItem !== null} title={rulesItem ? `Regras do convite de ${rulesItem.invite.name}` : "Regras"} onClose={() => setEditingRules(null)} placement="center">
        {rulesItem && (
          <CommissionRulesEditor
            title="Regras"
            description="Passam para o afiliado quando ele aceitar o convite."
            rules={rulesItem.rules}
            owner={{ kind: "invite", inviteId: rulesItem.invite.id }}
            onChanged={invites.reload}
            framed={false}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={revoking !== null}
        title="Cancelar este convite?"
        description="O link para de funcionar. Se mudar de ideia, crie um convite novo."
        confirmLabel="Cancelar convite"
        pending={revoke.pending}
        onConfirm={() => void confirmRevoke()}
        onClose={() => setRevoking(null)}
      />
    </section>
  );
}
