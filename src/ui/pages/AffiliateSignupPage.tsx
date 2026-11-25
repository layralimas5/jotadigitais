import { BadgeCheck, CircleDollarSign, Link2, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { container } from "@/app/container";
import { affiliateSignupSchema, sha256Hex, signUpAffiliate } from "@/application/affiliate-use-cases";
import type { AffiliateSignupResult } from "@/application/affiliate-ports";
import { fieldErrorsOf, PASSWORD_RULE_HINT } from "@/application/schemas";
import { commissionRuleLabel, type AffiliateProgram } from "@/domain/affiliate";
import { maskDocumentInput } from "@/domain/brazil";
import { formatBRL } from "@/domain/money";
import { Button, ButtonLink, buttonClasses } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { PasswordField } from "@/ui/components/form/PasswordField";
import { Reveal, RevealItem } from "@/ui/components/Reveal";
import { AffiliateFaq, AffiliatePerks, EarningsShowcase } from "@/ui/sections/affiliate/AffiliateLanding";
import { useAsync } from "@/ui/hooks/useAsync";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";

const { portal } = container.affiliates;

interface SignupValues {
  name: string;
  email: string;
  whatsapp: string;
  document: string;
  password: string;
  acceptedTerms: boolean;
}

const EMPTY: SignupValues = { name: "", email: "", whatsapp: "", document: "", password: "", acceptedTerms: false };
const FIELD_ORDER = ["name", "email", "whatsapp", "document", "password", "acceptedTerms"] as const;

function Steps({ program }: { program: AffiliateProgram }) {
  const steps = [
    { icon: UserPlus, title: "Cadastre-se grátis", text: "Sem taxa, sem mensalidade e sem compra obrigatória." },
    { icon: Link2, title: "Divulgue seu link", text: `Cada conta da vitrine tem o seu link. O clique vale por ${program.linkDays} dias.` },
    {
      icon: CircleDollarSign,
      title: "Ganhe por venda paga",
      text: `${commissionRuleLabel(program.commission, formatBRL)}, liberada quando a garantia da conta acaba.`,
    },
  ];
  return (
    <Reveal as="ol" stagger className="mt-10 grid gap-3 sm:grid-cols-3 sm:gap-5">
      {steps.map(({ icon: Icon, title, text }, index) => (
        <RevealItem as="li" key={title}>
          <div className="flex h-full gap-4 rounded-2xl border border-line bg-surface/70 p-4 sm:block sm:rounded-3xl sm:p-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-ink text-electric sm:size-14 sm:rounded-2xl">
              <Icon aria-hidden className="size-5 sm:size-6" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold text-white sm:mt-6 sm:text-lg">
                <span aria-hidden className="mr-2 text-electric-soft/60 tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {title}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-mist sm:mt-2">{text}</p>
            </div>
          </div>
        </RevealItem>
      ))}
    </Reveal>
  );
}

function SignupDone({ result }: { result: AffiliateSignupResult }) {
  const approved = result.status === "approved";
  return (
    <div role="status" className="rounded-3xl border border-emerald-400/30 bg-emerald-400/[0.05] p-6 text-center sm:p-8">
      <BadgeCheck aria-hidden className="mx-auto size-10 text-emerald-300" />
      <h2 className="mt-4 font-display text-xl font-semibold text-white">{approved ? "Cadastro aprovado!" : "Cadastro recebido!"}</h2>
      <p className="mt-2 text-sm text-fog">
        {approved
          ? "Entre no painel do afiliado para pegar os seus links."
          : "A loja vai analisar o seu cadastro. Você já pode entrar no painel e acompanhar por lá."}
      </p>
      <ButtonLink to="/afiliado/entrar" size="lg" className="mt-6">
        <LogIn aria-hidden className="size-4" /> Entrar no painel do afiliado
      </ButtonLink>
    </div>
  );
}

function SignupForm({ program }: { program: AffiliateProgram }) {
  const [values, setValues] = useState<SignupValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [result, setResult] = useState<AffiliateSignupResult | null>(null);
  const termsSha = useAsync(() => sha256Hex(program.terms), program.terms);

  const rawOf = (current: SignupValues) => ({ ...current, termsSha256: termsSha.status === "success" ? termsSha.data : "" });

  const update = (patch: Partial<SignupValues>) => {
    const next = { ...values, ...patch };
    setValues(next);
    if (submitted) {
      const parsed = affiliateSignupSchema.safeParse(rawOf(next));
      setErrors(parsed.success ? {} : fieldErrorsOf(parsed.error));
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    setFailure(null);
    const form = event.currentTarget;
    const parsed = affiliateSignupSchema.safeParse(rawOf(values));
    if (!parsed.success) {
      const found = fieldErrorsOf(parsed.error);
      setErrors(found);
      const first = FIELD_ORDER.find((field) => found[field]);
      if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setErrors({});
    setPending(true);
    try {
      setResult(await signUpAffiliate(portal, rawOf(values)));
    } catch (error) {
      console.error(error);
      setFailure(error instanceof Error ? error.message : "Não foi possível concluir o cadastro agora.");
    } finally {
      setPending(false);
    }
  };

  if (result) return <SignupDone result={result} />;

  return (
    <form noValidate onSubmit={onSubmit} aria-busy={pending} className="space-y-4 rounded-3xl border border-line bg-surface p-5 sm:p-7">
      <h2 className="font-display text-xl font-semibold text-white">Quero ser afiliado</h2>
      <TextField label="Nome completo" name="name" autoComplete="name" value={values.name} onChange={(event) => update({ name: event.target.value })} error={errors.name} />
      <TextField
        label="E-mail"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={values.email}
        onChange={(event) => update({ email: event.target.value })}
        error={errors.email}
        hint="É o seu login no painel do afiliado."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="WhatsApp"
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(84) 99999-0000"
          value={values.whatsapp}
          onChange={(event) => update({ whatsapp: event.target.value })}
          error={errors.whatsapp}
        />
        <TextField
          label="CPF"
          name="document"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          value={values.document}
          onChange={(event) => update({ document: maskDocumentInput(event.target.value).slice(0, 14) })}
          error={errors.document}
          hint="Para pagar as comissões no seu nome."
        />
      </div>
      <PasswordField
        label="Crie uma senha"
        name="password"
        autoComplete="new-password"
        value={values.password}
        onChange={(event) => update({ password: event.target.value })}
        error={errors.password}
        hint={PASSWORD_RULE_HINT}
      />
      <details className="rounded-2xl border border-line bg-ink/60 px-4 py-3 text-sm text-fog">
        <summary className="cursor-pointer font-medium text-white">Ler os termos do programa</summary>
        <div className="mt-3 max-h-72 overflow-y-auto pr-2 whitespace-pre-line">{program.terms}</div>
      </details>
      <label className="flex items-start gap-3 text-sm text-fog">
        <input
          type="checkbox"
          name="acceptedTerms"
          checked={values.acceptedTerms}
          onChange={(event) => update({ acceptedTerms: event.target.checked })}
          aria-invalid={errors.acceptedTerms ? true : undefined}
          className="mt-0.5 size-4 shrink-0 accent-electric"
        />
        <span>Li e aceito os termos do programa de afiliados e declaro ter 18 anos ou mais.</span>
      </label>
      {errors.acceptedTerms && <p className="text-xs font-medium text-[#ff7a7a]">{errors.acceptedTerms}</p>}
      {failure && (
        <p role="alert" className="rounded-xl border border-alert/40 bg-alert/10 px-4 py-3 text-sm text-[#ffb4b4]">
          {failure}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending || termsSha.status !== "success"}>
        {pending ? "Enviando…" : "Cadastrar"}
      </Button>
      <p className="text-center text-sm text-mist">
        Já é afiliado?{" "}
        <a href="/afiliado/entrar" className="font-medium text-electric hover:text-white">
          Entrar no painel
        </a>
      </p>
    </form>
  );
}

function ProgramClosed() {
  return (
    <div className="rounded-3xl border border-line bg-surface p-6 text-center sm:p-8">
      <ShieldCheck aria-hidden className="mx-auto size-9 text-electric" />
      <h2 className="mt-4 font-display text-xl font-semibold text-white">Cadastros fechados no momento</h2>
      <p className="mt-2 text-sm text-fog">O programa de afiliados não está recebendo cadastros agora. Volte em breve.</p>
    </div>
  );
}

export default function AffiliateSignupPage() {
  useDocumentMeta("Seja afiliado", "Divulgue as contas da Jota Digitais com o seu link e ganhe comissão por venda paga.");
  const program = useAsync(() => portal.getProgram(), "affiliate-program");

  return (
    <div className="pt-28 pb-14 sm:pb-20 md:pt-36 md:pb-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-3xl">
          <p className="font-display text-xs font-semibold tracking-[0.2em] text-electric uppercase">Programa de afiliados</p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-balance text-white md:text-6xl">
            Indique contas prontas e ganhe por cada venda
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-pretty text-fog md:mt-6">
            Você divulga, o cliente compra pelo seu link ou cupom e a comissão cai no seu painel. Sem estoque, sem atendimento.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href="#cadastro" className={buttonClasses({ size: "lg" })}>
              Quero ser afiliado
            </a>
            <ButtonLink to="/afiliado/entrar" variant="secondary" size="lg">
              <LogIn aria-hidden className="size-4" /> Já sou afiliado
            </ButtonLink>
          </div>
        </Reveal>

        {program.status === "loading" && <div className="mt-10 h-48 animate-pulse rounded-3xl bg-surface" aria-label="Carregando" />}
        {program.status === "error" && (
          <p role="alert" className="mt-10 text-sm text-[#ffb4b4]">
            Não deu para carregar o programa agora.{" "}
            <button type="button" onClick={program.retry} className="font-medium underline">
              Tentar de novo
            </button>
          </p>
        )}
        {program.status === "success" && (
          <>
            {program.data.enabled && (
              <>
                <Steps program={program.data} />
                <EarningsShowcase program={program.data} />
                <AffiliatePerks program={program.data} />
              </>
            )}
            <div id="cadastro" className="mx-auto mt-10 max-w-xl scroll-mt-28 sm:mt-14">
              {program.data.enabled ? <SignupForm program={program.data} /> : <ProgramClosed />}
            </div>
            {program.data.enabled && <AffiliateFaq program={program.data} />}
          </>
        )}
      </div>
    </div>
  );
}
