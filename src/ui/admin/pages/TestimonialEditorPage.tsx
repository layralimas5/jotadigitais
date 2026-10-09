import { ArrowLeft, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteTestimonial, findTestimonial, saveTestimonial } from "@/application/admin-use-cases";
import { fieldErrorsOf, testimonialDataSchema } from "@/application/schemas";
import type { Testimonial, TestimonialData, TestimonialKind } from "@/domain/testimonial";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { PrintCard } from "@/ui/sections/home/Results";
import { FormSection, InlineError, LoadingBlock, MobileActionBar, PageHeader } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SegmentedField, TextAreaField, ToggleField } from "../components/FormControls";
import { SingleImageField } from "../components/ImageUpload";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";

const EMPTY: TestimonialData = {
  kind: "result",
  title: "",
  subtitle: "",
  imageUrl: "",
  imageAlt: "",
  width: 0,
  height: 0,
  published: true,
};

const FIELD_ORDER = ["imageUrl", "title", "subtitle", "imageAlt"] as const;

function TestimonialEditor({ testimonial }: { testimonial: Testimonial | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [values, setValues] = useState<TestimonialData>(testimonial ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const save = useMutation((deps, data: TestimonialData) => saveTestimonial(deps, testimonial?.id ?? null, data));
  const remove = useMutation(async (deps, id: string) => {
    await deleteTestimonial(deps, id);
    return true;
  });

  const validate = (next: TestimonialData) => {
    const result = testimonialDataSchema.safeParse(next);
    return result.success ? { data: result.data, errors: {} } : { data: null, errors: fieldErrorsOf(result.error) };
  };

  const update = (patch: Partial<TestimonialData>) => {
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
    const saved = await save.run(result.data);
    if (!saved) {
      toast.show("Não foi possível salvar. Veja o aviso no formulário.", "error");
      return;
    }
    toast.show(`Depoimento "${saved.title}" salvo.`);
    navigate("/admin/depoimentos");
  };

  const onDelete = async () => {
    if (!testimonial) return;
    const removed = await remove.run(testimonial.id);
    if (!removed) return;
    toast.show("Depoimento apagado.");
    navigate("/admin/depoimentos");
  };

  const preview: Testimonial | null = values.imageUrl
    ? { ...values, id: testimonial?.id ?? "preview", position: 0, title: values.title || "Título", subtitle: values.subtitle || "Complemento" }
    : null;

  return (
    <>
      <Link to="/admin/depoimentos" className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
        <ArrowLeft aria-hidden className="size-4" /> Voltar para os depoimentos
      </Link>
      <div className="mt-4">
        <PageHeader title={testimonial ? "Editar depoimento" : "Novo depoimento"} description="Entra na faixa de resultados da página inicial." />
      </div>

      <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
        <div className="space-y-5">
          <FormSection title="Print" description="Desfoque nome, @ e foto de clientes antes de enviar.">
            <SingleImageField
              label="Imagem"
              name="imageUrl"
              folder="testimonials"
              value={values.imageUrl}
              alt={values.imageAlt || "Print do depoimento"}
              error={errors.imageUrl}
              onUploaded={(image) => update({ imageUrl: image.url, width: image.width, height: image.height })}
            />
          </FormSection>

          <FormSection title="Texto">
            <SegmentedField<TestimonialKind>
              legend="Tipo"
              name="kind"
              value={values.kind}
              options={[
                { value: "result", label: "Resultado de cliente" },
                { value: "delivered", label: "Conta entregue" },
              ]}
              onChange={(kind) => update({ kind })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Título"
                name="title"
                placeholder="R$ 23,5 mil no mês"
                maxLength={60}
                value={values.title}
                onChange={(event) => update({ title: event.target.value })}
                error={errors.title}
              />
              <TextField
                label="Complemento"
                name="subtitle"
                placeholder="Marina, em comissões"
                maxLength={60}
                value={values.subtitle}
                onChange={(event) => update({ subtitle: event.target.value })}
                error={errors.subtitle}
              />
            </div>
            <TextAreaField
              label="Descrição da imagem"
              name="imageAlt"
              maxLength={300}
              value={values.imageAlt}
              onChange={(event) => update({ imageAlt: event.target.value })}
              error={errors.imageAlt}
              hint="Para quem usa leitor de tela e para o Google. Ex.: WhatsApp da cliente com R$ 2,9 mil em comissões no dia."
            />
            <ToggleField
              label="Mostrar no site"
              description="Desligue para guardar sem publicar."
              checked={values.published}
              onChange={(published) => update({ published })}
            />
          </FormSection>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <p className="text-sm font-medium text-fog">Prévia no site</p>
          {preview ? (
            <ul aria-label="Prévia do depoimento" className="pointer-events-none flex justify-center">
              <PrintCard proof={preview} />
            </ul>
          ) : (
            <p className="rounded-3xl border border-dashed border-line-strong p-6 text-center text-sm text-mist">
              Envie o print para ver a prévia.
            </p>
          )}
          {Object.keys(errors).length > 0 && <InlineError message="Revise os campos marcados em vermelho." />}
          {save.error && <InlineError message={save.error.message} />}
          <Button type="submit" size="lg" className="w-full max-md:hidden" disabled={save.pending}>
            {save.pending ? "Salvando…" : testimonial ? "Salvar alterações" : "Publicar depoimento"}
          </Button>
          {testimonial && (
            <Button variant="ghost" className="w-full text-[#ff7a7a] hover:text-[#ff9a9a]" onClick={() => setConfirmOpen(true)}>
              <Trash2 aria-hidden className="size-4" /> Apagar depoimento
            </Button>
          )}
          {remove.error && <InlineError message={remove.error.message} />}
        </aside>

        <MobileActionBar>
          <Button variant="secondary" size="lg" className="shrink-0" onClick={() => navigate("/admin/depoimentos")}>
            Voltar
          </Button>
          <Button type="submit" size="lg" className="flex-1" disabled={save.pending}>
            {save.pending ? "Salvando…" : testimonial ? "Salvar" : "Publicar depoimento"}
          </Button>
        </MobileActionBar>
      </form>

      {testimonial && (
        <ConfirmDialog
          open={confirmOpen}
          title="Apagar este depoimento?"
          description="Ele sai do site na hora. Para só esconder, desligue “Mostrar no site”."
          confirmLabel="Apagar"
          pending={remove.pending}
          onConfirm={() => void onDelete()}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
}

export default function TestimonialEditorPage() {
  const { id } = useParams();
  const testimonial = useAdminQuery((deps) => (id ? findTestimonial(deps, id) : Promise.resolve(null)), id ?? "new");

  if (testimonial.status === "loading") return <LoadingBlock />;
  if (testimonial.status === "error") return <ErrorState message={testimonial.error.message} onRetry={testimonial.reload} />;
  if (id && !testimonial.data) {
    return (
      <EmptyState
        title="Depoimento não encontrado"
        description="Ele pode ter sido apagado."
        action={
          <Link to="/admin/depoimentos" className="text-sm text-electric-soft underline-offset-4 hover:underline">
            Voltar para os depoimentos
          </Link>
        }
      />
    );
  }
  return <TestimonialEditor key={id ?? "new"} testimonial={testimonial.data} />;
}
