import type { ComponentType } from "react";
import { CHECKOUT_SOURCE_ORDER, LEAD_SOURCE_LABEL, orderCheckoutSources, type LeadSource } from "@/domain/lead";
import { PAYMENT_PLANS, PAYMENT_PLAN_LABEL } from "@/domain/payment";
import { PLATFORMS, PLATFORM_LABEL } from "@/domain/platform";
import type { PlatformCard, SiteContent, SiteSectionKey, TextCard } from "@/domain/site-content";
import { PARTNER_PATH, PREVIEW_ACCOUNT_PATH, PREVIEW_CHECKOUT_PATH, PREVIEW_ORDER_PATH } from "@/ui/lib/site-preview";
import { ToggleField } from "../components/FormControls";
import { CopyField, CopyListField, ImageCopyField, Repeater, type FieldErrors } from "./fields";
import { ProofPointsField } from "./ProofPointsField";

interface SectionFormProps<K extends SiteSectionKey> {
  value: SiteContent[K];
  /** O rascunho inteiro, para uma seção partir do texto de outra. */
  content: SiteContent;
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
      <ProofPointsField points={value.proofPoints} errors={errors} onChange={(proofPoints) => onChange({ ...value, proofPoints })} />
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
      <p className="text-xs text-mist">Os passos também aparecem em “Como você recebe”, na página de cada conta, enquanto ela usar os passos daqui.</p>
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

const CheckoutPageForm: Form<"checkoutPage"> = (props) => {
  const copy = copyFieldsFor("checkoutPage", props);
  const { value, onChange, errors } = props;
  const toggle = (source: LeadSource, on: boolean) =>
    onChange({ ...value, sources: orderCheckoutSources(on ? [...value.sources, source] : value.sources.filter((item) => item !== source)) });
  const sourcesError = errors["checkoutPage.sources"];
  return (
    <>
      {copy("sourceQuestion", "Pergunta de origem", 80)}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-semibold text-mist">Opções que o cliente pode escolher</legend>
        {CHECKOUT_SOURCE_ORDER.map((source) => (
          <ToggleField
            key={source}
            label={LEAD_SOURCE_LABEL[source]}
            description={source === "referral" ? "Pede o nome de quem indicou e liga a venda ao parceiro." : undefined}
            checked={value.sources.includes(source)}
            onChange={(on) => toggle(source, on)}
          />
        ))}
      </fieldset>
      {sourcesError && (
        <p role="alert" className="text-xs text-alert">
          {sourcesError}
        </p>
      )}
      <p className="text-xs text-mist">Com uma opção só, ela já vem marcada para o cliente. Na prévia, o botão de finalizar não registra pedido.</p>
    </>
  );
};

const OrderPageForm: Form<"orderPage"> = (props) => {
  const copy = copyFieldsFor("orderPage", props);
  const { value, onChange, errors } = props;
  const updateStep = (index: number, patch: Partial<TextCard>) =>
    onChange({ ...value, steps: value.steps.map((step, position) => (position === index ? { ...step, ...patch } : step)) as typeof value.steps });
  return (
    <>
      <p className="text-xs text-mist">Use {"{nome}"} para o primeiro nome do cliente e {"{conta}"} para o @ da conta comprada.</p>
      {copy("titleAwaiting", "Título antes de pagar", 60)}
      {copy("titlePaid", "Título com o pagamento confirmado", 60)}
      {copy("reserved", "Frase abaixo do título", 120)}
      <fieldset className="space-y-3 rounded-2xl border border-line-strong bg-ink/60 p-3.5">
        <legend className="sr-only">Card 1</legend>
        <p aria-hidden className="text-xs font-semibold text-mist">Card 1</p>
        {copy("paymentStepTitle", "Título", 60)}
        {PAYMENT_PLANS.map((plan) => (
          <CopyField
            key={plan}
            label={`Texto quando paga com ${PAYMENT_PLAN_LABEL[plan]}`}
            path={`orderPage.paymentStepText.${plan}`}
            value={value.paymentStepText[plan]}
            max={220}
            multiline
            errors={errors}
            onChange={(text) => onChange({ ...value, paymentStepText: { ...value.paymentStepText, [plan]: text } })}
          />
        ))}
      </fieldset>
      {value.steps.map((step, index) => (
        <fieldset key={index} className="space-y-3 rounded-2xl border border-line-strong bg-ink/60 p-3.5">
          <legend className="sr-only">{`Card ${index + 2}`}</legend>
          <p aria-hidden className="text-xs font-semibold text-mist">{`Card ${index + 2}`}</p>
          <CopyField label="Título" path={`orderPage.steps.${index}.title`} value={step.title} max={60} errors={errors} onChange={(title) => updateStep(index, { title })} />
          <CopyField label="Texto" path={`orderPage.steps.${index}.text`} value={step.text} max={220} multiline errors={errors} onChange={(text) => updateStep(index, { text })} />
        </fieldset>
      ))}
      <p className="text-xs text-mist">A prévia mostra um pedido de exemplo já pago.</p>
    </>
  );
};

function PlatformCardField({
  path,
  label,
  card,
  onChange,
  errors,
}: {
  path: string;
  label: string;
  card: PlatformCard;
  onChange: (card: PlatformCard) => void;
  errors: FieldErrors;
}) {
  return (
    <fieldset className="space-y-3 rounded-2xl border border-line-strong bg-ink/60 p-3.5">
      <legend className="sr-only">{label}</legend>
      <p aria-hidden className="text-xs font-semibold text-mist">{label}</p>
      <CopyField label="Título" path={`${path}.title`} value={card.title} max={60} errors={errors} onChange={(title) => onChange({ ...card, title })} />
      <CopyField label="Texto em contas de TikTok" path={`${path}.tiktok`} value={card.tiktok} max={220} multiline errors={errors} onChange={(tiktok) => onChange({ ...card, tiktok })} />
      <CopyField label="Texto nas outras redes" path={`${path}.other`} value={card.other} max={220} multiline errors={errors} onChange={(other) => onChange({ ...card, other })} />
    </fieldset>
  );
}

const GroupTitle = ({ children }: { children: string }) => <p className="border-t border-line pt-4 text-xs font-semibold text-mist">{children}</p>;

const AccountPageForm: Form<"accountPage"> = (props) => {
  const copy = copyFieldsFor("accountPage", props);
  const { value, onChange, errors, content } = props;
  const ownSteps = value.deliverySteps !== null;
  return (
    <>
      <p className="text-xs text-mist">Vale para a página de todas as contas. O texto de “Sobre esta conta”, os números e as fotos de cada uma ficam na aba Contas.</p>

      {copy("profileLink", "Botão para ver a conta na rede", 40, {
        hint: "Aparece abaixo do @ quando a conta tem o link cadastrado na aba Contas. Use {rede} para TikTok, Instagram...",
      })}

      <GroupTitle>Caixa de compra</GroupTitle>
      {copy("priceLabel", "Acima do preço", 40)}
      {copy("pixLine", "Linha do Pix", 60)}
      {copy("cardLine", "Linha do cartão", 60, { hint: "Use {parcelas} para o número máximo de parcelas." })}
      {copy("cardNote", "Observação do cartão", 60, { hint: "Opcional." })}
      {copy("available", "Conta disponível", 140, { multiline: true })}
      {copy("reserved", "Conta reservada por outro cliente", 140)}
      {copy("sold", "Conta vendida", 140)}
      {copy("buyButton", "Botão de comprar", 32)}
      {copy("otherButton", "Botão quando não está à venda", 32)}
      <fieldset className="space-y-3 rounded-2xl border border-line-strong bg-ink/60 p-3.5">
        <legend className="sr-only">Card de entrega</legend>
        <p aria-hidden className="text-xs font-semibold text-mist">Card de entrega</p>
        <CopyField label="Título" path="accountPage.perkDelivery.title" value={value.perkDelivery.title} max={60} errors={errors} onChange={(title) => onChange({ ...value, perkDelivery: { ...value.perkDelivery, title } })} />
        <CopyField label="Texto" path="accountPage.perkDelivery.text" value={value.perkDelivery.text} max={220} multiline errors={errors} onChange={(text) => onChange({ ...value, perkDelivery: { ...value.perkDelivery, text } })} />
      </fieldset>
      <PlatformCardField path="accountPage.perkGuarantee" label="Card de garantia" card={value.perkGuarantee} errors={errors} onChange={(perkGuarantee) => onChange({ ...value, perkGuarantee })} />
      <PlatformCardField path="accountPage.perkSupport" label="Card de suporte" card={value.perkSupport} errors={errors} onChange={(perkSupport) => onChange({ ...value, perkSupport })} />
      <p className="text-xs text-mist">{TOKEN_HINT}</p>

      <GroupTitle>Sobre e ficha técnica</GroupTitle>
      {copy("aboutTitle", "Título de “Sobre esta conta”", 60)}
      {copy("nicheNote", "Aviso abaixo da descrição (contas com nicho)", 240, { multiline: true, hint: "Opcional." })}
      {copy("specsTitle", "Título da ficha técnica", 60)}
      <p className="text-xs text-mist">
        Rede, nicho, números, monetização e data do anúncio vêm de cada conta, na aba Contas. Abaixo, as linhas fixas de cada rede, que entram depois dos números.
      </p>
      {PLATFORMS.map((platform) => (
        <Repeater
          key={platform}
          legend={`Linhas fixas em contas de ${PLATFORM_LABEL[platform]}`}
          path={`accountPage.fixedSpecs.${platform}`}
          items={value.fixedSpecs[platform]}
          onChange={(specs) => onChange({ ...value, fixedSpecs: { ...value.fixedSpecs, [platform]: specs } })}
          errors={errors}
          min={0}
          max={8}
          addLabel="Adicionar linha"
          itemLabel={(index) => `Linha ${index + 1}`}
          empty={() => ({ label: "", value: "" })}
          render={(item, update, itemPath) => (
            <div className="space-y-3">
              <CopyField label="Nome" path={`${itemPath}.label`} value={item.label} max={40} errors={errors} onChange={(label) => update({ label })} />
              <CopyField label="Valor" path={`${itemPath}.value`} value={item.value} max={60} errors={errors} onChange={(next) => update({ value: next })} />
            </div>
          )}
        />
      ))}

      <GroupTitle>O que está incluso</GroupTitle>
      {copy("includedTitle", "Título", 60)}
      <p className="text-xs text-mist">
        Monetização ativa, conta profissional e o tipo de acesso do Facebook entram sozinhos, pelos dados de cada conta. Abaixo, os itens fixos de cada rede.
      </p>
      {PLATFORMS.map((platform) => (
        <CopyListField
          key={platform}
          label={`Itens em contas de ${PLATFORM_LABEL[platform]}`}
          path={`accountPage.included.${platform}`}
          items={value.included[platform]}
          itemMax={90}
          min={1}
          max={10}
          addLabel="Adicionar item"
          errors={errors}
          onChange={(items) => onChange({ ...value, included: { ...value.included, [platform]: items } })}
        />
      ))}

      <GroupTitle>Como você recebe</GroupTitle>
      {copy("deliveryTitle", "Título", 60)}
      <ToggleField
        label="Usar os passos de Como funciona"
        description="Ligado, esta parte mostra os mesmos quatro passos da página inicial. Desligue para escrever passos só para a página da conta."
        checked={!ownSteps}
        onChange={(shared) => onChange({ ...value, deliverySteps: shared ? null : structuredClone(content.howItWorks.steps) })}
      />
      {value.deliverySteps && (
        <FourCards
          path="accountPage.deliverySteps"
          itemLabel="Passo"
          cards={value.deliverySteps}
          errors={errors}
          onChange={(deliverySteps) => onChange({ ...value, deliverySteps })}
        />
      )}

      <GroupTitle>Fim da página</GroupTitle>
      {copy("faqTitle", "Título das dúvidas", 60, { hint: "As perguntas são as mesmas da seção Dúvidas." })}
      {copy("relatedTitle", "Título das contas parecidas", 60)}
      <p className="text-xs text-mist">A prévia mostra a primeira conta do estoque.</p>
    </>
  );
};

const PartnerPageForm: Form<"partnerPage"> = (props) => {
  const copy = copyFieldsFor("partnerPage", props);
  const { value, onChange, errors } = props;
  const updateStep = (index: number, patch: Partial<TextCard>) =>
    onChange({ ...value, steps: value.steps.map((step, position) => (position === index ? { ...step, ...patch } : step)) as typeof value.steps });
  return (
    <>
      {copy("eyebrow", "Chamada pequena", 40)}
      {copy("title", "Título", 90)}
      {copy("description", "Texto de apoio", 240, { multiline: true })}

      <GroupTitle>Como funciona</GroupTitle>
      {value.steps.map((step, index) => (
        <fieldset key={index} className="space-y-3 rounded-2xl border border-line-strong bg-ink/60 p-3.5">
          <legend className="sr-only">{`Passo ${index + 1}`}</legend>
          <p aria-hidden className="text-xs font-semibold text-mist">{`Passo ${index + 1}`}</p>
          <CopyField label="Título" path={`partnerPage.steps.${index}.title`} value={step.title} max={60} errors={errors} onChange={(title) => updateStep(index, { title })} />
          <CopyField label="Texto" path={`partnerPage.steps.${index}.text`} value={step.text} max={220} multiline errors={errors} onChange={(text) => updateStep(index, { text })} />
        </fieldset>
      ))}

      <GroupTitle>Vantagens</GroupTitle>
      {copy("perksTitle", "Título", 60)}
      <CopyListField
        label="Itens"
        path="partnerPage.perks"
        items={value.perks}
        itemMax={90}
        min={1}
        max={6}
        addLabel="Adicionar vantagem"
        errors={errors}
        onChange={(perks) => onChange({ ...value, perks })}
      />

      <GroupTitle>Chamada para o WhatsApp</GroupTitle>
      {copy("ctaTitle", "Título", 60)}
      {copy("ctaText", "Texto", 220, { multiline: true })}
      {copy("button", "Botão", 32)}
      {copy("whatsappMessage", "Mensagem que já vai escrita no WhatsApp", 300, {
        multiline: true,
        hint: "O número é o do WhatsApp do suporte (Contato e garantia). Sem número, o botão some.",
      })}
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
  path: "/" | typeof PREVIEW_ORDER_PATH | typeof PREVIEW_ACCOUNT_PATH | typeof PREVIEW_CHECKOUT_PATH | typeof PARTNER_PATH;
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
  define({
    key: "accountPage",
    title: "Página da conta",
    description: "Caixa de compra, o que está incluso e como você recebe",
    path: PREVIEW_ACCOUNT_PATH,
    anchor: "incluso-title",
    Form: AccountPageForm,
  }),
  define({
    key: "checkoutPage",
    title: "Checkout",
    description: "Como o cliente conta de onde veio",
    path: PREVIEW_CHECKOUT_PATH,
    anchor: "checkout-origem",
    Form: CheckoutPageForm,
  }),
  define({
    key: "orderPage",
    title: "Página do pedido",
    description: "Pedido recebido e pagamento confirmado",
    path: PREVIEW_ORDER_PATH,
    anchor: "pedido-title",
    Form: OrderPageForm,
  }),
  define({
    key: "partnerPage",
    title: "Seja parceiro",
    description: "Página que explica a parceria e leva ao WhatsApp",
    path: PARTNER_PATH,
    anchor: "parceiro-title",
    Form: PartnerPageForm,
  }),
  define({ key: "seo", title: "Google e aba do navegador", description: "Título e descrição da página inicial", path: "/", anchor: "hero-title", Form: SeoForm }),
];
