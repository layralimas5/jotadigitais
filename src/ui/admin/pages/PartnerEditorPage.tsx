import { ArrowLeft, MessageCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deletePartner, findPartnerSummary, savePartner } from "@/application/admin-use-cases";
import { fieldErrorsOf, partnerDataSchema } from "@/application/schemas";
import { formatBRL } from "@/domain/money";
import type { Partner, PartnerSummary } from "@/domain/partner";
import { TextField } from "@/ui/components/form/Fields";
import { PlatformGlyph } from "@/ui/components/PlatformGlyph";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { FormSection, LoadingBlock, PageHeader } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TextAreaField, ToggleField } from "../components/FormControls";
import { FormFooter } from "../components/FormFooter";
import { useAdminQuery, useMutation } from "../hooks";
import { formatDate } from "../lib/dates";
import { formatPercent, parsePercent } from "../lib/percent";
import { firstNameOf, whatsappChatUrl } from "../lib/whatsapp";
import { useToast } from "../toast";

interface PartnerFormValues {
  name: string;
  whatsapp: string;
  instagram: string;
  pixKey: string;
  commissionPercent: string;
  active: boolean;
  notes: string;
}

const FIELD_ORDER = ["name", "whatsapp", "instagram", "pixKey", "commissionPercent", "notes"] as const;

const EMPTY: PartnerFormValues = {
  name: "",
  whatsapp: "",
  instagram: "",
  pixKey: "",
  commissionPercent: "",
  active: true,
  notes: "",
};

const fromPartner = (partner: Partner): PartnerFormValues => ({
  name: partner.name,
  whatsapp: partner.whatsapp ?? "",
  instagram: partner.instagram ?? "",
  pixKey: partner.pixKey ?? "",
  commissionPercent: String(partner.commissionPercent).replace(".", ","),
  active: partner.active,
  notes: partner.notes ?? "",
});

const toRaw = (values: PartnerFormValues) => ({ ...values, commissionPercent: parsePercent(values.commissionPercent) });

function validate(values: PartnerFormValues) {
  const result = partnerDataSchema.safeParse(toRaw(values));
  return result.success ? { data: result.data, errors: {} } : { data: null, errors: fieldErrorsOf(result.error) };
}

const ACCOUNT_STATUS_LABEL = { available: "Disponível", reserved: "Reservada", sold: "Vendida" } as const;

function PartnerAccounts({ summary }: { summary: PartnerSummary }) {
  return (
    <FormSection title="Contas deste parceiro" description="Para ligar uma conta, escolha o parceiro no cadastro da conta.">
      {summary.accounts.length === 0 ? (
        <p className="text-sm text-mist">Nenhuma conta ligada ainda.</p>
      ) : (
        <ul className="divide-y divide-line">
          {summary.accounts.map((account) => (
            <li key={account.id}>
              <Link to={`/admin/contas/${account.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:text-electric-soft">
                <PlatformGlyph platform={account.platform} className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-white">{account.handle}</span>
                <span className="text-xs text-mist">{ACCOUNT_STATUS_LABEL[account.status]}</span>
                <span className="w-24 text-right text-fog tabular-nums">{formatBRL(account.price)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </FormSection>
  );
}

function ReferredCustomers({ summary }: { summary: PartnerSummary }) {
  const { referredCustomers } = summary;
  return (
    <FormSection
      title="Clientes indicados"
      description={`Quem escreveu ${summary.partner.name} (ou o @ dele) em “quem indicou”, no checkout ou no cadastro do cliente.`}
    >
      {referredCustomers.length === 0 ? (
        <p className="text-sm text-mist">Nenhuma indicação ainda.</p>
      ) : (
        <ul className="divide-y divide-line">
          {referredCustomers.map((customer) => (
            <li key={customer.key}>
              <Link
                to={`/admin/clientes/${encodeURIComponent(customer.key)}`}
                className="flex items-center gap-3 py-2.5 text-sm hover:text-electric-soft"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-white">{customer.name}</span>
                  <span className="block text-xs text-mist">
                    {customer.since ? `Desde ${formatDate(customer.since)} · ` : ""}
                    {customer.purchases} {customer.purchases === 1 ? "compra" : "compras"}
                  </span>
                </span>
                <span className="w-24 text-right text-fog tabular-nums">{formatBRL(customer.totalSpent)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </FormSection>
  );
}

function SummaryCard({ summary }: { summary: PartnerSummary }) {
  const { partner } = summary;
  return (
    <div className="rounded-3xl border border-line bg-surface/60 p-5">
      <p className="text-sm font-medium text-fog">Resumo</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-mist">No estoque</dt>
          <dd className="text-white tabular-nums">{summary.inStock}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-mist">Vendidas</dt>
          <dd className="text-white tabular-nums">{summary.sold}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-mist">Vendas finalizadas</dt>
          <dd className="text-white tabular-nums">{formatBRL(summary.revenue)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-line pt-2">
          <dt className="text-mist">Comissão ({formatPercent(partner.commissionPercent)})</dt>
          <dd className="font-semibold text-white tabular-nums">{formatBRL(summary.commission)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-line pt-2">
          <dt className="text-mist">Clientes indicados</dt>
          <dd className="text-white tabular-nums">{summary.referredCustomers.length}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-mist">Compras dos indicados</dt>
          <dd className="text-white tabular-nums">{summary.referredPurchases}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-mist">Total gasto pelos indicados</dt>
          <dd className="text-white tabular-nums">{formatBRL(summary.referredRevenue)}</dd>
        </div>
      </dl>
      {partner.whatsapp && (
        <a
          href={whatsappChatUrl(partner.whatsapp, `Olá, ${firstNameOf(partner.name)}!`)}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-emerald-300 hover:underline"
        >
          <MessageCircle aria-hidden className="size-4" /> Chamar no WhatsApp
        </a>
      )}
    </div>
  );
}

function PartnerEditor({ summary }: { summary: PartnerSummary | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const partner = summary?.partner ?? null;
  const [values, setValues] = useState<PartnerFormValues>(() => (partner ? fromPartner(partner) : EMPTY));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const save = useMutation((deps, raw: ReturnType<typeof toRaw>) => savePartner(deps, partner?.id ?? null, raw));
  const remove = useMutation(async (deps, id: string) => {
    await deletePartner(deps, id);
    return true;
  });

  const update = (patch: Partial<PartnerFormValues>) => {
    const next = { ...values, ...patch };
    setValues(next);
    if (submitted) setErrors(validate(next).errors);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    const formElement = event.currentTarget;
    const result = validate(values);
    setErrors(result.errors);
    if (!result.data) {
      const first = FIELD_ORDER.find((field) => result.errors[field]);
      if (first) formElement.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      toast.show("Revise os campos marcados em vermelho.", "error");
      return;
    }
    const saved = await save.run(toRaw(values));
    if (!saved) {
      toast.show("Não foi possível salvar. Veja o aviso no formulário.", "error");
      return;
    }
    toast.show(`Parceiro salvo: ${firstNameOf(saved.name)}.`);
    navigate("/admin/parceiros");
  };

  const onDelete = async () => {
    if (!partner) return;
    const removed = await remove.run(partner.id);
    if (!removed) return;
    toast.show("Parceiro apagado. As contas dele continuam no estoque, como da loja.");
    navigate("/admin/parceiros");
  };

  return (
    <>
      <Link to="/admin/parceiros" className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
        <ArrowLeft aria-hidden className="size-4" /> Voltar
      </Link>
      <div className="mt-4">
        <PageHeader
          title={partner ? "Editar parceiro" : "Novo parceiro"}
          description="A comissão vale para as vendas finalizadas das contas ligadas a este parceiro."
        />
      </div>

      <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className={cn("mt-6 grid gap-6", summary ? "lg:grid-cols-[1fr_18rem] lg:items-start" : "max-w-3xl")}>
        <div className="space-y-5">
          <FormSection title="Dados">
            <TextField
              label="Nome"
              name="name"
              autoComplete="off"
              maxLength={80}
              value={values.name}
              onChange={(event) => update({ name: event.target.value })}
              error={errors.name}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="WhatsApp"
                name="whatsapp"
                type="tel"
                inputMode="tel"
                placeholder="(11) 91234-5678"
                value={values.whatsapp}
                onChange={(event) => update({ whatsapp: event.target.value })}
                error={errors.whatsapp}
              />
              <TextField
                label="Instagram"
                name="instagram"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="@perfil"
                maxLength={31}
                value={values.instagram}
                onChange={(event) => update({ instagram: event.target.value })}
                error={errors.instagram}
              />
            </div>
          </FormSection>

          <FormSection title="Repasse">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Comissão (%)"
                name="commissionPercent"
                inputMode="decimal"
                placeholder="30"
                value={values.commissionPercent}
                onChange={(event) => update({ commissionPercent: event.target.value })}
                error={errors.commissionPercent}
                hint="Parte do valor de cada venda finalizada."
              />
              <TextField
                label="Chave Pix"
                name="pixKey"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={140}
                value={values.pixKey}
                onChange={(event) => update({ pixKey: event.target.value })}
                error={errors.pixKey}
              />
            </div>
            <ToggleField
              label="Parceiro ativo"
              description="Inativo sai da lista de parceiros no cadastro de contas, mas continua no histórico."
              checked={values.active}
              onChange={(active) => update({ active })}
            />
            <TextAreaField
              label="Anotações"
              name="notes"
              maxLength={2000}
              placeholder="Combinados, prazos de repasse, tipo de conta que fornece…"
              value={values.notes}
              onChange={(event) => update({ notes: event.target.value })}
              error={errors.notes}
            />
          </FormSection>

          {summary && <ReferredCustomers summary={summary} />}
          {summary && <PartnerAccounts summary={summary} />}
        </div>

        {summary && (
          <aside className="space-y-4 lg:sticky lg:top-24">
            <SummaryCard summary={summary} />
          </aside>
        )}

        <FormFooter
          className={summary ? "lg:col-span-2" : undefined}
          submitLabel={partner ? "Salvar alterações" : "Cadastrar parceiro"}
          mobileSubmitLabel={partner ? "Salvar" : "Cadastrar parceiro"}
          pending={save.pending}
          onCancel={() => navigate("/admin/parceiros")}
          onDelete={partner ? () => setConfirmOpen(true) : undefined}
          deleteLabel="Apagar parceiro"
          errors={[Object.keys(errors).length > 0 ? "Revise os campos marcados em vermelho." : null, save.error?.message, remove.error?.message]}
        />
      </form>

      {partner && (
        <ConfirmDialog
          open={confirmOpen}
          title="Apagar este parceiro?"
          description="As contas dele continuam no estoque e passam a contar como da loja. Pedidos e vendas não mudam."
          confirmLabel="Apagar"
          pending={remove.pending}
          onConfirm={() => void onDelete()}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
}

export default function PartnerEditorPage() {
  const { id } = useParams();
  const summary = useAdminQuery((deps) => (id ? findPartnerSummary(deps, id) : Promise.resolve(null)), id ?? "new");

  if (summary.status === "loading") return <LoadingBlock />;
  if (summary.status === "error") return <ErrorState message={summary.error.message} onRetry={summary.reload} />;
  if (id && !summary.data) {
    return (
      <EmptyState
        title="Parceiro não encontrado"
        description="Ele pode ter sido apagado."
        action={
          <Link to="/admin/parceiros" className="text-sm text-electric-soft underline-offset-4 hover:underline">
            Voltar para os parceiros
          </Link>
        }
      />
    );
  }
  return <PartnerEditor key={id ?? "new"} summary={summary.data} />;
}
