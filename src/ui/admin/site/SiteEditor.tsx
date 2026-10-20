import { AlertCircle, ChevronDown, ExternalLink, Monitor, RotateCcw, Smartphone, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useBlocker } from "react-router-dom";
import type { SiteContent, SiteSectionKey } from "@/domain/site-content";
import { Button } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";
import { MobileActionBar } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FilterChips } from "../components/FilterChips";
import { useToast } from "../toast";
import { SITE_SECTIONS, type SiteSectionDefinition } from "./section-forms";
import { SitePreview, type PreviewDevice } from "./SitePreview";
import { useSiteDraft, type SiteDraft } from "./useSiteDraft";

interface SectionPanelProps {
  section: SiteSectionDefinition;
  open: boolean;
  onToggle: () => void;
  draft: SiteDraft;
}

function SectionPanel({ section, open, onToggle, draft }: SectionPanelProps) {
  const { Form, key } = section;
  const hasErrors = draft.sectionHasErrors(key);
  const panelId = `secao-${key}`;
  return (
    <li className={cn("rounded-2xl border bg-surface/60", hasErrors ? "border-alert/50" : open ? "border-electric/40" : "border-line")}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 font-semibold text-white">
              {section.title}
              {hasErrors && <AlertCircle aria-label="Tem campos para corrigir" className="size-4 text-[#ff7a7a]" />}
            </span>
            <span className="block truncate text-xs text-mist">{section.description}</span>
          </span>
          <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-mist transition-transform", open && "rotate-180")} />
        </button>
      </h3>
      {open && (
        <div id={panelId} className="space-y-4 border-t border-line px-4 pt-4 pb-5">
          <Form value={draft.draft[key]} onChange={(value: SiteContent[SiteSectionKey]) => draft.setSection(key, value)} errors={draft.errors} />
          <button
            type="button"
            onClick={() => draft.resetSection(key)}
            className="inline-flex items-center gap-2 text-xs text-mist underline-offset-4 hover:text-white hover:underline"
          >
            <RotateCcw aria-hidden className="size-3.5" /> Voltar ao texto original desta seção
          </button>
        </div>
      )}
    </li>
  );
}

function PreviewPane({ draft, section, device, onDevice }: { draft: SiteDraft; section: SiteSectionDefinition | null; device: PreviewDevice; onDevice: (device: PreviewDevice) => void }) {
  const path = section?.path ?? "/";
  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[28rem] flex-col rounded-3xl border border-line bg-surface/60 p-2.5 lg:h-[calc(100dvh-7.5rem)]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1.5 pb-2.5">
        <p className="text-xs text-mist">
          Prévia ao vivo · <span className="text-fog">{path === "/" ? "Página inicial" : "Termos de compra"}</span>
        </p>
        <div className="flex items-center gap-1.5">
          <div role="group" aria-label="Tamanho da prévia" className="flex rounded-full border border-line-strong p-0.5">
            {(["desktop", "mobile"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={device === option}
                aria-label={option === "desktop" ? "Ver como no computador" : "Ver como no celular"}
                onClick={() => onDevice(option)}
                className={cn("grid size-8 place-items-center rounded-full transition-colors", device === option ? "bg-electric/20 text-white" : "text-mist hover:text-white")}
              >
                {option === "desktop" ? <Monitor aria-hidden className="size-4" /> : <Smartphone aria-hidden className="size-4" />}
              </button>
            ))}
          </div>
          <a
            href={path}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir o site publicado em outra aba"
            className="grid size-9 place-items-center rounded-full text-mist hover:bg-white/[0.06] hover:text-white"
          >
            <ExternalLink aria-hidden className="size-4" />
          </a>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <SitePreview content={draft.draft} path={path} scrollTarget={section?.anchor ?? null} device={device} />
      </div>
    </div>
  );
}

function SaveBar({ draft, onPublish }: { draft: SiteDraft; onPublish: () => void }) {
  const status = draft.pending ? "Publicando…" : draft.dirty ? "Alterações ainda não publicadas" : "Tudo publicado";
  return (
    <>
      <div className="sticky bottom-4 z-20 max-md:hidden">
        <div className="flex items-center gap-4 rounded-2xl border border-line-strong bg-surface-2/90 px-4 py-3 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.9)] backdrop-blur-xl">
          <p role="status" className={cn("min-w-0 flex-1 truncate text-sm", draft.dirty ? "text-white" : "text-mist")}>
            {draft.dirty && <span aria-hidden className="mr-2 inline-block size-2 rounded-full bg-pink" />}
            {draft.saveError ? <span className="text-[#ff9a9a]">{draft.saveError.message}</span> : status}
          </p>
          <Button variant="secondary" disabled={!draft.dirty || draft.pending} onClick={draft.discard}>
            Descartar
          </Button>
          <Button disabled={!draft.dirty || draft.pending} onClick={onPublish}>
            <Upload aria-hidden className="size-4" /> {draft.pending ? "Publicando…" : "Salvar e publicar"}
          </Button>
        </div>
      </div>
      <MobileActionBar>
        <Button variant="secondary" size="lg" className="shrink-0" disabled={!draft.dirty || draft.pending} onClick={draft.discard}>
          Descartar
        </Button>
        <Button size="lg" className="flex-1" disabled={!draft.dirty || draft.pending} onClick={onPublish}>
          {draft.pending ? "Publicando…" : draft.dirty ? "Salvar e publicar" : "Tudo publicado"}
        </Button>
      </MobileActionBar>
    </>
  );
}

/** Pergunta antes de sair da tela (ou fechar a aba) com alteração não publicada. */
function useLeaveGuard(dirty: boolean) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
  return blocker;
}

type MobileView = "edit" | "preview";

/** Mesmo ponto do `lg:` do Tailwind, onde editor e prévia ficam lado a lado. */
const WIDE_SCREEN = "(min-width: 64rem)";

/** Textos e imagens do site, com a prévia do site real ao lado. Nada vai para o ar antes de "Salvar e publicar". */
export function SiteEditor({ initial }: { initial: SiteContent }) {
  const toast = useToast();
  const draft = useSiteDraft(initial);
  const [openKey, setOpenKey] = useState<SiteSectionKey | null>("hero");
  const [device, setDevice] = useState<PreviewDevice>(() => (window.matchMedia(WIDE_SCREEN).matches ? "desktop" : "mobile"));
  const [mobileView, setMobileView] = useState<MobileView>("edit");
  const blocker = useLeaveGuard(draft.dirty);
  const openSection = SITE_SECTIONS.find((section) => section.key === openKey) ?? null;

  const onPublish = async () => {
    const result = await draft.publish();
    if (result.ok) {
      toast.show("Site publicado. Quem abrir agora já vê os textos novos.");
      return;
    }
    if (result.section) {
      setOpenKey(result.section);
      setMobileView("edit");
      toast.show("Tem campo para corrigir. A seção com problema ficou aberta.", "error");
      return;
    }
    toast.show("Não foi possível publicar. Tente de novo.", "error");
  };

  return (
    <>
      <div className="mb-4 lg:hidden">
        <FilterChips<MobileView>
          label="Ver"
          value={mobileView}
          onChange={setMobileView}
          options={[
            { value: "edit", label: "Editar textos" },
            { value: "preview", label: "Ver prévia" },
          ]}
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(21rem,27rem)_minmax(0,1fr)] lg:items-start">
        <ul className={cn("space-y-2.5", mobileView === "preview" && "max-lg:hidden")} aria-label="Seções do site">
          {SITE_SECTIONS.map((section) => (
            <SectionPanel
              key={section.key}
              section={section}
              draft={draft}
              open={openKey === section.key}
              onToggle={() => setOpenKey((current) => (current === section.key ? null : section.key))}
            />
          ))}
        </ul>
        <div className={cn("lg:sticky lg:top-20", mobileView === "edit" && "max-lg:hidden")}>
          <PreviewPane draft={draft} section={openSection} device={device} onDevice={setDevice} />
        </div>
      </div>
      <div className="mt-5">
        <SaveBar draft={draft} onPublish={() => void onPublish()} />
      </div>

      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="Sair sem publicar?"
        description="As alterações nos textos do site ainda não foram publicadas e vão se perder."
        confirmLabel="Sair sem publicar"
        onConfirm={() => blocker.proceed?.()}
        // O <dialog> também avisa quando fecha depois de confirmar: aí não há mais o que desfazer.
        onClose={() => blocker.state === "blocked" && blocker.reset()}
      />
    </>
  );
}
