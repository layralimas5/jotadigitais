import { siteConfig } from "@/app/config";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";

const SECTIONS = [
  {
    title: "1. O que você está comprando",
    body: "Uma conta de TikTok já criada, com seguidores e com acesso à Central de Criadores do TikTok Shop liberado no momento da entrega. As informações de seguidores, curtidas e status do Shop são as exibidas na página da conta na data da compra.",
  },
  {
    title: "2. Entrega",
    body: "Depois da confirmação do pagamento, enviamos login, senha e instruções para o e-mail informado no pedido. Recomendamos trocar a senha e o e-mail da conta assim que receber o acesso.",
  },
  {
    title: "3. Garantia",
    body: `Você tem ${siteConfig.guaranteeDays} dias a partir da entrega para relatar qualquer problema de acesso ou de status do Shop. Se a conta não corresponder ao anunciado, oferecemos outra conta equivalente ou o reembolso integral.`,
  },
  {
    title: "4. Uso da conta",
    body: "Depois da entrega, o uso da conta é de responsabilidade de quem comprou, incluindo o conteúdo publicado e o cumprimento das regras da plataforma. A Jota Digitais não é afiliada, patrocinada ou endossada pelo TikTok.",
  },
  {
    title: "5. Resultados",
    body: "Os resultados de clientes divulgados são individuais. O faturamento com o TikTok Shop depende do nicho, dos produtos e da dedicação de cada pessoa, e não é garantido.",
  },
  {
    title: "6. Contato",
    body: `Dúvidas ou suporte pelo Instagram ${siteConfig.instagramHandle}.`,
  },
] as const;

export default function TermsPage() {
  useDocumentMeta("Termos de compra e garantia");
  return (
    <div className="pt-28 pb-24 md:pt-36">
      <article className="mx-auto max-w-3xl px-4 sm:px-6">
        <p className="font-display text-xs font-semibold tracking-[0.2em] text-electric uppercase">Termos</p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-white md:text-5xl">
          Termos de compra e garantia
        </h1>
        <div className="mt-12 space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="font-display text-xl font-semibold text-white">{section.title}</h2>
              <p className="mt-3 leading-relaxed text-mist">{section.body}</p>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
