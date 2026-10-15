import { CalendarDays, CalendarPlus, ExternalLink, LogOut, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { container } from "@/app/container";
import {
  calendarCapabilities,
  connectCalendar,
  disconnectCalendar,
  getCalendarConnection,
  listUpcomingEvents,
  prepareCalendar,
  syncFollowUpsToCalendar,
} from "@/application/integration-use-cases";
import type { CalendarConnection, CalendarEvent } from "@/domain/calendar";
import { Button } from "@/ui/components/Button";
import { InlineError } from "../components/AdminUi";
import { useAdminQuery, useMutation } from "../hooks";
import { formatDate } from "../lib/dates";
import { useToast } from "../toast";
import { GoogleCalendarIcon } from "./GoogleCalendarIcon";
import { IntegrationShell, Steps, StatusChip, TechnicalSetup } from "./IntegrationUi";

const SITE_ORIGINS = [window.location.origin, "http://localhost:5210"].filter((origin, index, all) => all.indexOf(origin) === index);

const SETUP_STEPS = [
  <>
    Entre em <strong className="text-white">console.cloud.google.com</strong> com a conta Google do Jota e crie um projeto chamado
    “Jota Digitais”.
  </>,
  <>
    Em <strong className="text-white">APIs e serviços › Biblioteca</strong>, ative a <strong className="text-white">Google Calendar API</strong>.
  </>,
  <>
    Em <strong className="text-white">Tela de permissão OAuth</strong>, escolha “Externo”, preencha nome e e-mail e, em “Usuários de teste”,
    adicione o Gmail do Jota.
  </>,
  <>
    Em <strong className="text-white">Credenciais › Criar credenciais › ID do cliente OAuth</strong>, escolha “Aplicativo da Web” e, em
    “Origens JavaScript autorizadas”, coloque: <span className="font-mono text-fog">{SITE_ORIGINS.join(", ")}</span> e o endereço do site no ar.
  </>,
  <>
    Copie o <strong className="text-white">ID do cliente</strong> para a variável <span className="font-mono text-fog">VITE_GOOGLE_CLIENT_ID</span> no
    arquivo <span className="font-mono text-fog">.env</span> e na hospedagem, e publique de novo.
  </>,
];

const HOW_IT_WORKS = [
  "Clique em Conectar com Google.",
  "Na janela do Google, escolha sua conta e marque a permissão da agenda.",
  "Pronto: seus próximos compromissos aparecem aqui e os retornos do CRM vão para a agenda do seu celular.",
];

const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

function eventWhen(event: CalendarEvent): string {
  if (event.allDay) {
    const [year, month, day] = event.start.split("-").map(Number);
    return `${weekday.format(new Date(year ?? 0, (month ?? 1) - 1, day ?? 1))} · dia inteiro`;
  }
  const date = new Date(event.start);
  return `${weekday.format(date)} · ${time.format(date)}`;
}

function UpcomingEvents({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) {
    return <p className="rounded-2xl border border-dashed border-line-strong p-4 text-center text-sm text-mist">Nada na agenda nos próximos 7 dias.</p>;
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-ink/40">
      {events.map((event) => (
        <li key={event.id} className="flex items-center gap-3 px-4 py-2.5">
          <CalendarDays aria-hidden className="size-4 shrink-0 text-electric-soft" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-white">{event.title}</span>
            <span className="block text-xs text-mist first-letter:uppercase">{eventWhen(event)}</span>
          </span>
          {event.link && (
            <a href={event.link} target="_blank" rel="noreferrer" aria-label={`Abrir ${event.title} no Google Agenda`} className="grid size-8 place-items-center rounded-full text-mist hover:bg-white/[0.06] hover:text-white">
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function syncMessage(created: number, updated: number): string {
  const total = created + updated;
  if (total === 0) return "Nenhum retorno marcado no CRM de hoje em diante.";
  const parts = [created ? `${created} ${created === 1 ? "novo" : "novos"}` : null, updated ? `${updated} ${updated === 1 ? "atualizado" : "atualizados"}` : null];
  return `${total} ${total === 1 ? "retorno enviado" : "retornos enviados"} para a agenda (${parts.filter(Boolean).join(", ")}).`;
}

function ConnectedPanel({ connection, onDisconnected }: { connection: CalendarConnection; onDisconnected: () => void }) {
  const toast = useToast();
  const [hasAccess, setHasAccess] = useState(() => calendarCapabilities(container.admin).hasAccess);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const open = useMutation(async (deps) => {
    if (!calendarCapabilities(deps).hasAccess) await connectCalendar(deps);
    return listUpcomingEvents(deps);
  });
  const sync = useMutation(syncFollowUpsToCalendar);
  const disconnect = useMutation(async (deps) => {
    await disconnectCalendar(deps);
    return true;
  });

  const load = async () => {
    const loaded = await open.run();
    if (!loaded) return;
    setEvents(loaded);
    setHasAccess(true);
  };

  /** Se a agenda já foi aberta nesta visita, mostra os compromissos sem pedir outro clique. */
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const [openedBefore] = useState(hasAccess);
  useEffect(() => {
    if (openedBefore) void loadRef.current();
  }, [openedBefore]);

  const onSync = async () => {
    const summary = await sync.run();
    if (!summary) return;
    toast.show(syncMessage(summary.created, summary.updated));
    void load();
  };

  const onDisconnect = async () => {
    if (await disconnect.run()) {
      toast.show("Google Agenda desconectado.");
      onDisconnected();
    }
  };

  const error = open.error ?? sync.error ?? disconnect.error;

  return (
    <div className="space-y-4">
      <p className="text-sm text-fog">
        Conectado como <strong className="text-white">{connection.email}</strong>
        <span className="text-mist"> desde {formatDate(connection.connectedAt)}</span>
      </p>

      {hasAccess && events ? (
        <>
          <div>
            <p className="mb-2 text-xs font-medium text-mist">Próximos 7 dias</p>
            <UpcomingEvents events={events} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => void onSync()} disabled={sync.pending}>
              <CalendarPlus aria-hidden className="size-4" />
              {sync.pending ? "Enviando…" : "Mandar retornos do CRM para a agenda"}
            </Button>
            <Button variant="secondary" onClick={() => void load()} disabled={open.pending}>
              <RefreshCw aria-hidden className={open.pending ? "size-4 animate-spin motion-reduce:animate-none" : "size-4"} /> Atualizar
            </Button>
          </div>
          <p className="text-xs text-mist">Cada retorno com data marcada no CRM vira um compromisso de dia inteiro. Mandar de novo atualiza, não duplica.</p>
        </>
      ) : (
        <div className="rounded-2xl border border-line bg-ink/40 p-4">
          <p className="text-sm text-fog">Por segurança, o Google pede um clique a cada visita para mostrar sua agenda.</p>
          <Button className="mt-3" onClick={() => void load()} disabled={open.pending}>
            <CalendarDays aria-hidden className="size-4" /> {open.pending ? "Abrindo…" : "Abrir agenda"}
          </Button>
        </div>
      )}

      {error && <InlineError message={error.message} />}

      <button type="button" onClick={() => void onDisconnect()} disabled={disconnect.pending} className="inline-flex items-center gap-1.5 text-xs text-[#ff9a9a] hover:text-[#ffb3b3]">
        <LogOut aria-hidden className="size-3.5" /> Desconectar o Google Agenda
      </button>
    </div>
  );
}

function ConnectPanel({ onConnected }: { onConnected: (connection: CalendarConnection) => void }) {
  const toast = useToast();
  const connect = useMutation(connectCalendar);
  const onConnect = async () => {
    const connection = await connect.run();
    if (!connection) return;
    toast.show(`Google Agenda conectado: ${connection.email}.`);
    onConnected(connection);
  };
  return (
    <div className="space-y-4">
      <Steps title="Como conectar" steps={HOW_IT_WORKS} />
      <Button size="lg" onClick={() => void onConnect()} disabled={connect.pending} className="w-full sm:w-auto">
        <GoogleCalendarIcon className="size-5" /> {connect.pending ? "Esperando o Google…" : "Conectar com Google"}
      </Button>
      {connect.error && <InlineError message={connect.error.message} />}
      <p className="text-xs text-mist">O sistema não vê sua senha: quem pede a permissão é o próprio Google. Dá para desconectar quando quiser.</p>
    </div>
  );
}

/** Card do Google Agenda na aba de APIs: do “falta preparar” até a agenda aberta, sempre com o próximo passo à vista. */
export function GoogleCalendarCard() {
  const { configured } = calendarCapabilities(container.admin);
  const saved = useAdminQuery(getCalendarConnection, "calendar-connection");
  const [connection, setConnection] = useState<CalendarConnection | null | undefined>(undefined);
  const current = connection === undefined ? (saved.status === "success" ? saved.data : null) : connection;

  useEffect(() => {
    if (configured) prepareCalendar(container.admin).catch((error: unknown) => console.error("Login do Google não carregou", error));
  }, [configured]);

  const status = !configured ? (
    <StatusChip tone="setup">Falta preparar</StatusChip>
  ) : current ? (
    <StatusChip tone="connected">Conectado</StatusChip>
  ) : (
    <StatusChip tone="action">Pronto para conectar</StatusChip>
  );

  return (
    <IntegrationShell
      icon={<GoogleCalendarIcon className="size-7" />}
      title="Google Agenda"
      description="Veja seus compromissos aqui e mande os retornos do CRM para a agenda do celular, com lembrete."
      status={status}
      featured
    >
      {!configured ? (
        <div className="space-y-4">
          <p className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4 text-sm leading-relaxed text-fog">
            Falta um passo técnico, feito uma única vez por quem cuida do sistema. Mostre esta tela para essa pessoa: depois disso, é só
            clicar em <strong className="text-white">Conectar com Google</strong>.
          </p>
          <TechnicalSetup steps={SETUP_STEPS} />
        </div>
      ) : saved.status === "loading" && connection === undefined ? (
        <p className="text-sm text-mist">Carregando…</p>
      ) : current ? (
        <ConnectedPanel connection={current} onDisconnected={() => setConnection(null)} />
      ) : (
        <ConnectPanel onConnected={setConnection} />
      )}
    </IntegrationShell>
  );
}
