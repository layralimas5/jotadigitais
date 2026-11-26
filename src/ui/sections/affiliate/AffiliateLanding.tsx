import { Check, ChevronDown, ShoppingBag, Wallet } from "lucide-react";
import { affiliateText, type AffiliateProgram } from "@/domain/affiliate";
import { EXAMPLE_ACCOUNT_PRICE, earningExamples, incentiveEarning, monthlyEarning } from "@/domain/affiliate-rewards";
import { formatBRL } from "@/domain/money";
import { Reveal, RevealItem } from "@/ui/components/Reveal";

/** Seções da página "Seja afiliado": quanto ganha, o que recebe e as dúvidas de quem está decidindo. */

const MONTHLY_SALES = 10;
const MONTHLY_PRICE = EXAMPLE_ACCOUNT_PRICE;

/** Textos com os marcadores da página: vendas e valor do exemplo, e os dias de garantia. */
function landingTokens(program: AffiliateProgram, guaranteeDays: number) {
  return {
    vendas: program.incentiveSales,
    valor: formatBRL(incentiveEarning(program.commission, program.incentiveSales)),
    dias: guaranteeDays,
  };
}

/** "A cada 10 vendas você recebe R$ 450" e como cada venda é liberada (o Jota edita os textos na aba Programa). */
export function EarningIncentive({ program, guaranteeDays }: { program: AffiliateProgram; guaranteeDays: number }) {
  const tokens = landingTokens(program, guaranteeDays);
  return (
    <Reveal className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-5">
      <div className="rounded-3xl border border-electric/35 bg-gradient-to-br from-electric/15 via-surface to-ink p-5 sm:p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-electric-soft">
          <Wallet aria-hidden className="size-4" /> Ganho por venda
        </p>
        <p className="mt-2 font-display text-xl font-bold text-balance text-white sm:text-2xl">{affiliateText(program.texts, "incentive", tokens)}</p>
        <p className="mt-2 text-sm leading-relaxed text-fog">{affiliateText(program.texts, "earnRule", tokens)}</p>
      </div>
      <div className="rounded-3xl border border-line bg-surface/70 p-5 sm:p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-electric-soft">
          <ShoppingBag aria-hidden className="size-4" /> Seu saldo vira conta
        </p>
        <p className="mt-2 text-sm leading-relaxed text-fog">{affiliateText(program.texts, "balanceNotice", tokens)}</p>
      </div>
    </Reveal>
  );
}

export function EarningsShowcase({ program, guaranteeDays }: { program: AffiliateProgram; guaranteeDays: number }) {
  const examples = earningExamples(program.commission);
  return (
    <section aria-labelledby="ganhos-title" className="mt-14 sm:mt-20">
      <Reveal className="max-w-2xl">
        <h2 id="ganhos-title" className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Quanto você ganha
        </h2>
        <p className="mt-2 text-fog">Contas de valor alto rendem comissão alta. Veja exemplos com a comissão atual do programa.</p>
      </Reveal>
      <Reveal as="ul" stagger className="mt-6 grid gap-3 sm:grid-cols-3 sm:gap-5">
        {examples.map((example) => (
          <RevealItem as="li" key={example.price}>
            <div className="h-full rounded-3xl border border-line bg-surface/70 p-5 sm:p-6">
              <p className="text-sm text-mist">Conta de {formatBRL(example.price)}</p>
              <p className="mt-2 font-display text-3xl font-bold text-white tabular-nums">{formatBRL(example.commission)}</p>
              <p className="mt-1 text-sm text-electric-soft">para você em uma venda</p>
            </div>
          </RevealItem>
        ))}
      </Reveal>
      <Reveal className="mt-4 rounded-3xl border border-electric/35 bg-electric/[0.07] p-5 text-center sm:p-6">
        <p className="text-fog">
          Indicando {MONTHLY_SALES} contas de {formatBRL(MONTHLY_PRICE)} por mês, você ganha
        </p>
        <p className="mt-1 font-display text-4xl font-bold text-white tabular-nums">{formatBRL(monthlyEarning(program.commission, MONTHLY_PRICE, MONTHLY_SALES))}</p>
      </Reveal>
      <EarningIncentive program={program} guaranteeDays={guaranteeDays} />
    </section>
  );
}

export function AffiliatePerks({ guaranteeDays }: { guaranteeDays: number }) {
  const perks = [
    "Painel próprio com saldo, vendas e cliques em tempo real",
    "Link de cada conta, QR Code, cupom e link de WhatsApp",
    "Texto e imagens prontos para divulgar cada conta",
    `Comissão em cada venda, liberada ${guaranteeDays} dias depois da entrega, e pagamento por Pix quando você pedir`,
    "Saldo que também compra conta no site (você paga só a diferença)",
    "Brindes da loja para quem divulga",
    "Ranking dos afiliados que mais vendem",
  ];
  return (
    <Reveal className="mt-5 rounded-2xl border border-line bg-surface/70 p-5 sm:rounded-3xl sm:p-8">
      <h2 className="font-display text-lg font-semibold text-white sm:text-xl">O que você recebe</h2>
      <ul className="mt-4 grid gap-3 sm:mt-6 sm:grid-cols-2">
        {perks.map((perk) => (
          <li key={perk} className="flex gap-3 text-sm leading-relaxed text-fog sm:text-[0.95rem]">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-electric/15 text-electric">
              <Check aria-hidden className="size-3" />
            </span>
            {perk}
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

export function AffiliateFaq({ program, guaranteeDays }: { program: AffiliateProgram; guaranteeDays: number }) {
  const tokens = landingTokens(program, guaranteeDays);
  const questions = [
    { q: "Preciso pagar alguma coisa?", a: "Não. O cadastro é grátis, sem mensalidade e sem compra obrigatória." },
    { q: "Quando eu recebo?", a: affiliateText(program.texts, "earnRule", tokens) },
    { q: "Posso usar o saldo para comprar uma conta?", a: affiliateText(program.texts, "balanceNotice", tokens) },
    {
      q: "E se o cliente esquecer o cupom?",
      a: `Quem clica no seu link fica marcado por ${program.linkDays} dias. Quem chega pelo seu link de WhatsApp também conta para você. E se mesmo assim a venda escapar, a loja consegue atribuir o pedido a você.`,
    },
    { q: "Posso divulgar no WhatsApp e no Instagram?", a: "Pode. Você tem link para cada conta, QR Code, cupom e um link que abre o WhatsApp da loja já com o seu código." },
  ];
  return (
    <section aria-labelledby="duvidas-afiliado" className="mt-14 sm:mt-20">
      <h2 id="duvidas-afiliado" className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Dúvidas
      </h2>
      <div className="mt-6 divide-y divide-line rounded-3xl border border-line bg-surface/50">
        {questions.map(({ q, a }) => (
          <details key={q} className="group px-5 py-4 sm:px-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-electric [&::-webkit-details-marker]:hidden">
              {q}
              <ChevronDown aria-hidden className="size-5 shrink-0 text-mist transition-transform group-open:rotate-180 motion-reduce:transition-none" />
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-fog">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
