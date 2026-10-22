import type { ComponentType } from "react";
import { MAX_PROOF_POINTS, type SiteContent, type SiteSectionKey, type TextCard } from "@/domain/site-content";
import { ToggleField } from "../components/FormControls";
import { CopyField, CopyListField, ImageCopyField, Repeater, type FieldErrors } from "./fields";

interface SectionFormProps<K extends SiteSectionKey> {
  value: SiteContent[K];
  onChange: (value: SiteContent[K]) => void;
  errors: FieldErrors;
}

type Form<K extends SiteSectionKey> = ComponentType<SectionFormProps<K>>;

/** Liga cada campo de texto ao seu caminho ("hero.title") e à atualização da seção. */
function copyFieldsFor<K extends SiteSectionKey>(key: K, { value, onChange, errors }: SectionFormProps<K>) {
  return <F extends keyof SiteContent[K] & string>(field: F, label: string, max: number, extra: { multiline?: boolean; hint?: string } = {}) => (
    <CopyField
      label={label}
      path={`${key}.${field}`}
      value={String(value[field] ?? "")}
      max={max}
      errors={errors}
      onChange={(next) => onChange({ ...value, [field]: next })}
      {...extra}
    />
  );
}

const TOKEN_HINT = "Use {dias} para o prazo de garantia e {instagram} para o @ da loja.";

function FourCards({
  path,
  cards,
  onChange,
  errors,
  itemLabel,
}: {
  path: string;
  cards: [TextCard, TextCard, TextCard, TextCard];
  onChange: (cards: [TextCard, TextCard, TextCard, TextCard]) => void;
  errors: FieldErrors;
  itemLabel: string;
}) {
  const update = (index: number, patch: Partial<TextCard>) =>
    onChange(cards.map((card, position) => (position === index ? { ...card, ...patch } : card)) as typeof cards);
  return (
    <div className="space-y-3">
      {cards.map((card, index) => (
        <fieldset key={index} className="space-y-3 rounded-2xl border border-line-strong bg-ink/60 p-3.5">
          <legend className="sr-only">{`${itemLabel} ${index + 1}`}</legend>
          <p aria-hidden className="text-xs font-semibold text-mist">{`${itemLabel} ${index + 1}`}</p>
          <CopyField label="Título" path={`${path}.${index}.title`} value={card.title} max={60} errors={errors} onChange={(title) => update(index, { title })} />
          <CopyField label="Texto" path={`${path}.${index}.text`} value={card.text} max={220} multiline errors={errors} onChange={(text) => update(index, { text })} />
        </fieldset>
      ))}
    </div>
  );
}

const HeroForm: Form<"hero"> = (props) => {
  const copy = copyFieldsFor("hero", props);
  const { value, onChange, errors } = props;
  return (
    <>
      {copy("badge", "Selo acima do título", 60)}
      {copy("title", "Título", 60)}
      {copy("titleHighlight", "Final do título (em degradê)", 40, { hint: "Opcional." })}
      {copy("subtitle", "Texto de apoio", 260, { multiline: true })}
      <div className="grid gap-3">
        {copy("primaryCta", "Botão principal", 32)}
        {copy("secondaryCta", "Botão secundário", 32)}
      </div>
      <CopyListField
        label="Provas abaixo dos botões"
        path="hero.proofPoints"
        items={value.proofPoints}
        itemMax={40}
        min={1}
        max={MAX_PROOF_POINTS}
        addLabel="Adicionar prova"
        errors={errors}
        onChange={(proofPoints) => onChange({ ...value, proofPoints })}
      />
      <p className="-mt-2 text-xs text-mist">
        Até {MAX_PROOF_POINTS}, com 40 caracteres cada. O ícone segue o texto: WhatsApp, e-mail, Pix ou cartão e garantia ganham o
        símbolo certo.
      </p>
      <p className="border-t border-line pt-4 text-xs font-semibold text-mist">Celular ilustrativo (só no computador)</p>
      <div className="grid gap-3">
        {copy("phoneName", "Nome no perfil", 30)}
        {copy("phoneHandle", "@ no perfil", 30)}
        {copy("chipTitle", "Selo: título", 24)}
        {copy("chipText", "Selo: texto", 32)}
        {copy("statLabel", "Número: legenda", 40)}
        {copy("statValue", "Número em destaque", 10)}
      </div>
    </>
  );
};

const ProblemForm: Form<"problem"> = (props) => {
  const copy = copyFieldsFor("problem", props);
  const { value, onChange, errors } = props;
  return (
    <>
      {copy("eyebrow", "Chamada pequena", 40)}
      {copy("title", "Título", 60)}
      {copy("titleMuted", "Continuação do título (em cinza)", 60, { hint: "Opcional." })}
      {copy("description", "Texto de apoio", 240, { multiline: true })}
      <div className="space-y-4 rounded-2xl border border-line-strong p-3.5">
        {copy("fromScratchTitle", "Card da esquerda: título", 50)}
        <ImageCopyField label="Card da esquerda: print" path="problem.fromScratchImage" image={value.fromScratchImage} errors={errors} onChange={(fromScratchImage) => onChange({ ...value, fromScratchImage })} />
        <CopyListField label="Card da esquerda: itens" path="problem.fromScratch" items={value.fromScratch} itemMax={90} min={1} max={6} addLabel="Adicionar item" errors={errors} onChange={(fromScratch) => onChange({ ...value, fromScratch })} />
      </div>
      <div className="space-y-4 rounded-2xl border border-electric/30 p-3.5">
        {copy("withUsTitle", "Card da direita: título", 50)}
        <ImageCopyField label="Card da direita: print" path="problem.withUsImage" image={value.withUsImage} errors={errors} onChange={(withUsImage) => onChange({ ...value, withUsImage })} />
        <CopyListField label="Card da direita: itens" path="problem.withUs" items={value.withUs} itemMax={90} min={1} max={6} addLabel="Adicionar item" errors={errors} onChange={(withUs) => onChange({ ...value, withUs })} />
      </div>
    </>
  );
};

const FeaturedForm: Form<"featured"> = (props) => {
  const copy = copyFieldsFor("featured", props);
  return (
    <>
      {copy("eyebrow", "Chamada pequena", 40)}
      {copy("title", "Título", 90)}
      {copy("description", "Texto de apoio", 240, { multiline: true })}
      {copy("allButton", "Botão para ver todas", 24)}
      <p className="text-xs text-mist">As contas em si vêm do estoque, na aba Contas.</p>
    </>
  );
};

const HowItWorksForm: Form<"howItWorks"> = (props) => {
  const copy = copyFieldsFor("howItWorks", props);
  const { value, onChange, errors } = props;
  return (
    <>
      {copy("eyebrow", "Chamada pequena", 40)}
      {copy("title", "Título", 90)}
      <FourCards path="howItWorks.steps" itemLabel="Passo" cards={value.steps} errors={errors} onChange={(steps) => onChange({ ...value, steps })} />
      <p className="text-xs text-mist">Os passos também aparecem em “Como você recebe”, na página de cada conta.</p>
    </>
  );
};

const ResultsForm: Form<"results"> = (props) => {
  const copy = copyFieldsFor("results", props);
  return (
    <>
      {copy("eyebrow", "Chamada pequena", 40)}
      {copy("title", "Título", 90)}
      {copy("description", "Texto de apoio", 240, { multiline: true })}
      {copy("disclaimer", "Aviso abaixo dos prints", 400, { multiline: true })}
      <p className="text-xs text-mist">Os prints vêm da aba Depoimentos. Sem depoimento publicado, a seção some do site.</p>
    </>
  );
};

const GuaranteeForm: Form<"guarantee"> = (props) => {
  const copy = copyFieldsFor("guarantee", props);
  const { value, onChange, errors } = props;
  return (
    <>
      {copy("eyebrow", "Chamada pequena", 40)}
      {copy("title", "Título", 90)}
      {copy("description", "Texto de apoio", 240, { multiline: true })}
      <p className="text-xs text-mist">{TOKEN_HINT}</p>
      <FourCards path="guarantee.items" itemLabel="Card" cards={value.items} errors={errors} onChange={(items) => onChange({ ...value, items })} />
    </>
  );
};

const FaqForm: Form<"faq"> = (props) => {
  const copy = copyFieldsFor("faq", props);
  const { value, onChange, errors } = props;
  return (
    <>
      {copy("eyebrow", "Chamada pequena", 40)}
      {copy("title", "Título", 90)}
      {copy("description", "Texto de apoio", 240, { multiline: true })}
      <p className="text-xs text-mist">
        {TOKEN_HINT} Use {"{seguidores_shop}"} para o mínimo de seguidores do Shop completo.
      </p>
      <Repeater
        legend="Perguntas"
        path="faq.items"
        items={value.items}
        errors={errors}
        min={1}
        max={20}
        addLabel="Adicionar pergunta"
        itemLabel={(index) => `Pergunta ${index + 1}`}
        empty={() => ({ question: "", answer: "", tiktokOnly: false })}
        onChange={(items) => onChange({ ...value, items })}
        render={(item, update, itemPath) => (
          <>
            <CopyField label="Pergunta" path={`${itemPath}.question`} value={item.question} max={120} errors={errors} onChange={(question) => update({ question })} />
            <CopyField label="Resposta" path={`${itemPath}.answer`} value={item.answer} max={600} multiline errors={errors} onChange={(answer) => update({ answer })} />
            <ToggleField
              label="Só em contas de TikTok"
              description="Na página de uma conta de outra rede, esta pergunta não aparece."
              checked={item.tiktokOnly}
              onChange={(tiktokOnly) => update({ tiktokOnly })}
            />
          </>
        )}
      />
    </>
  );
};

const FinalCtaForm: Form<"finalCta"> = (props) => {
  const copy = copyFieldsFor("finalCta", props);
  return (
    <>
      {copy("titleLine1", "Título, primeira linha", 50)}
      {copy("titleLine2", "Título, segunda linha", 50, { hint: "Opcional." })}
      {copy("button", "Botão", 32)}
    </>
  );
};

const FooterForm: Form<"footer"> = (props) => {
  const copy = copyFieldsFor("footer", props);
  return (
    <>
      {copy("tagline", "Frase abaixo da logo", 160, { multiline: true })}
      {copy("slogan", "Frase em itálico", 120, { hint: "Opcional." })}
      {copy("disclaimer", "Aviso legal (depois do ©)", 200, { multiline: true })}
    </>
  );
};

const WhatsappForm: Form<"whatsapp"> = (props) => {
  const copy = copyFieldsFor("whatsapp", props);
  return (
    <>
      {copy("teaserTitle", "Convite: título", 40)}
      {copy("teaserText", "Convite: texto", 50)}
      <p className="text-xs text-mist">O balão aparece perto do botão do WhatsApp alguns segundos depois de a pessoa entrar no site.</p>
    </>
  );
};

const SeoForm: Form<"seo"> = (props) => {
  const copy = copyFieldsFor("seo", props);
  return (
    <>
      {copy("title", "Título na aba do navegador e no Google", 70)}
      {copy("description", "Descrição no Google", 170, { multiline: true, hint: "Entre 120 e 160 caracteres funciona melhor." })}
    </>
  );
};

export interface SiteSectionDefinition<K extends SiteSectionKey = SiteSectionKey> {
  key: K;
  title: string;
  description: string;
  /** Página e elemento que a prévia mostra quando a seção abre. */
  path: "/";
  anchor: string;
  Form: Form<K>;
}

const define = <K extends SiteSectionKey>(definition: SiteSectionDefinition<K>) => definition as unknown as SiteSectionDefinition;

/** Seções na ordem em que aparecem no site. */
export const SITE_SECTIONS: readonly SiteSectionDefinition[] = [
  define({ key: "hero", title: "Topo", description: "Título, texto e botões da primeira tela", path: "/", anchor: "hero-title", Form: HeroForm }),
  define({ key: "problem", title: "Por que comprar pronta", description: "Comparação com os dois prints", path: "/", anchor: "problema-title", Form: ProblemForm }),
  define({ key: "featured", title: "Contas em destaque", description: "Textos acima das contas da vitrine", path: "/", anchor: "destaques-title", Form: FeaturedForm }),
  define({ key: "howItWorks", title: "Como funciona", description: "Os quatro passos da compra", path: "/", anchor: "como-funciona-title", Form: HowItWorksForm }),
  define({ key: "results", title: "Resultados", description: "Textos da faixa de prints", path: "/", anchor: "resultados-title", Form: ResultsForm }),
  define({ key: "guarantee", title: "Garantia", description: "Os quatro cards de segurança", path: "/", anchor: "garantia-title", Form: GuaranteeForm }),
  define({ key: "faq", title: "Dúvidas", description: "Perguntas frequentes da home e das contas", path: "/", anchor: "duvidas-title", Form: FaqForm }),
  define({ key: "finalCta", title: "Chamada final", description: "O bloco antes do rodapé", path: "/", anchor: "cta-title", Form: FinalCtaForm }),
  define({ key: "footer", title: "Rodapé", description: "Frases e aviso legal", path: "/", anchor: "rodape", Form: FooterForm }),
  define({ key: "whatsapp", title: "Convite do WhatsApp", description: "Balão ao lado do botão flutuante", path: "/", anchor: "rodape", Form: WhatsappForm }),
  define({ key: "seo", title: "Google e aba do navegador", description: "Título e descrição da página inicial", path: "/", anchor: "hero-title", Form: SeoForm }),
];
