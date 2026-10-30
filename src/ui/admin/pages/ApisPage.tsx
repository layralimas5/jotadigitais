import { CreditCard, HelpCircle, Link2, MessageCircle, Sparkles, UserRoundCheck } from "lucide-react";
import type { ReactNode } from "react";
import { ButtonLink } from "@/ui/components/Button";
import { PageHeader } from "../components/AdminUi";
import { GoogleCalendarCard } from "../integrations/GoogleCalendarCard";
import { IntegrationShell, StatusChip, type ConnectionTone } from "../integrations/IntegrationUi";

interface StaticIntegration {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  tone: ConnectionTone;
  status: string;
  /** O que fazer agora, em uma frase. */
  next: string;
  action?: { to: string; label: string };
}

/** Integrações que não pedem conexão (já funcionam) ou que ainda vão chegar. */
const INTEGRATIONS: readonly StaticIntegration[] = [
  {
    id: "profile-link",
    icon: <Link2 className="size-6 text-electric-soft" />,
    title: "Dados das redes pelo link",
    description: "Seguidores, curtidas, publicações e foto de TikTok, Instagram e YouTube, direto do perfil público.",
    tone: "working",
    status: "Funcionando",
    next: "Não precisa conectar nada. Na ficha da conta, cole o link do perfil e clique em Puxar dados.",
    action: { to: "/admin/contas", label: "Ir para Contas" },
  },
  {
    id: "whatsapp",
    icon: <MessageCircle className="size-6 text-[#25d366]" />,
    title: "WhatsApp",
    description: "Mensagens de pedido, entrega, CRM e oferta de conta já escritas, abrindo no seu WhatsApp.",
    tone: "working",
    status: "Funcionando",
    next: "Os botões verdes do sistema abrem o WhatsApp do seu celular ou computador. O envio automático, sem abrir o app, chega depois.",
    action: { to: "/admin/automacao", label: "Editar mensagens" },
  },
  {
    id: "payments",
    icon: <CreditCard className="size-6 text-amber-300" />,
    title: "Pagamento (InfinitePay e Pix C6)",
    description:
      "Pix, cartão ou dividido em dois (dois cartões ou cartão + Pix). Cartão pela InfinitePay e Pix pelo C6 Bank, os dois confirmados sozinhos.",
    tone: "soon",
    status: "Falta ligar",
    next: "O Pix automático do C6 entra quando o certificado do C6 for instalado. Até lá, o Pix usa a chave de Site > Contato e você confirma em Pedidos.",
    action: { to: "/admin/site", label: "Cadastrar chave Pix" },
  },
  {
    id: "ai",
    icon: <Sparkles className="size-6 text-pink" />,
    title: "Inteligência artificial",
    description: "Escrever a descrição das contas, sugerir preço e responder leads.",
    tone: "soon",
    status: "Em breve",
    next: "Os créditos e o consumo aparecem aqui quando o plano de IA for ligado.",
  },
  {
    id: "network-login",
    icon: <UserRoundCheck className="size-6 text-fog" />,
    title: "Login das contas nas redes",
    description: "Métricas privadas (alcance, faturamento do TikTok Shop) de cada conta do estoque.",
    tone: "soon",
    status: "Em breve",
    next: "TikTok e Meta precisam aprovar o app antes. Os números públicos já chegam pelo link, sem isso.",
  },
];

function IntegrationCard({ integration }: { integration: StaticIntegration }) {
  return (
    <li>
      <IntegrationShell
        icon={integration.icon}
        title={integration.title}
        description={integration.description}
        status={<StatusChip tone={integration.tone}>{integration.status}</StatusChip>}
      >
        <p className="text-sm leading-relaxed text-fog">{integration.next}</p>
        {integration.action && (
          <ButtonLink to={integration.action.to} variant="secondary" className="mt-4">
            {integration.action.label}
          </ButtonLink>
        )}
      </IntegrationShell>
    </li>
  );
}

function HowItWorks() {
  return (
    <aside aria-labelledby="ajuda-title" className="flex gap-3 rounded-3xl border border-line bg-white/[0.02] p-5">
      <HelpCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-electric" />
      <div className="text-sm leading-relaxed text-mist">
        <h2 id="ajuda-title" className="font-medium text-white">
          O que é uma conexão?
        </h2>
        <p className="mt-1">
          É dar ao sistema uma chave para usar outra ferramenta por você, como a sua agenda do Google. Quem pede a permissão é a própria
          ferramenta, numa janela dela: o sistema nunca vê sua senha. E você desliga quando quiser, aqui mesmo.
        </p>
      </div>
    </aside>
  );
}

export default function ApisPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="APIs e conexões"
        description="Ligue o sistema às ferramentas que você já usa. Cada card mostra a situação e o próximo passo."
      />
      <HowItWorks />
      <section aria-labelledby="conectar-title" className="space-y-4">
        <h2 id="conectar-title" className="text-[0.7rem] font-semibold tracking-[0.16em] text-mist uppercase">
          Para conectar
        </h2>
        <GoogleCalendarCard />
      </section>
      <section aria-labelledby="outras-title" className="space-y-4">
        <h2 id="outras-title" className="text-[0.7rem] font-semibold tracking-[0.16em] text-mist uppercase">
          Funcionando e a caminho
        </h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {INTEGRATIONS.map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </ul>
      </section>
    </div>
  );
}
