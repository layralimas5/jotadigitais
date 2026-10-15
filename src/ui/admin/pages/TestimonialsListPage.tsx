import { Reorder, useDragControls, useReducedMotion } from "framer-motion";
import { Eye, EyeOff, GripVertical, Pencil, Plus } from "lucide-react";
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { listAllTestimonials, reorderTestimonials, saveTestimonial } from "@/application/admin-use-cases";
import type { Testimonial, TestimonialKind } from "@/domain/testimonial";
import { ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { Fab, LoadingBlock, PageHeader } from "../components/AdminUi";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";

/** Mesmas etiquetas da faixa de resultados do site. */
const KIND_TAG: Record<TestimonialKind, { label: string; className: string }> = {
  result: { label: "Resultado", className: "bg-pink/90 text-white" },
  delivered: { label: "Conta entregue", className: "bg-electric/90 text-ink" },
};

const iconButtonClass =
  "relative z-10 grid size-9 place-items-center rounded-full border border-line-strong text-fog transition-[color,border-color,transform] hover:border-white/30 hover:text-white active:scale-90";

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(iconButtonClass, "disabled:pointer-events-none disabled:opacity-30")}
    >
      {children}
    </button>
  );
}

const sameOrder = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, index) => id === b[index]);

function moveId(ids: readonly string[], id: string, direction: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  [next[from], next[to]] = [next[to] as string, next[from] as string];
  return next;
}

interface PrintItemProps {
  item: Testimonial;
  position: number;
  total: number;
  busy: boolean;
  onDragEnd: () => void;
  onKeyboardMove: (direction: -1 | 1) => void;
  onToggle: () => void;
}

/**
 * Card no mesmo formato do site. Com mouse, arrasta pelo card inteiro; no toque, pela alça (assim o dedo
 * ainda rola a fileira); no teclado, foco na alça e setas esquerda/direita.
 */
function PrintItem({ item, position, total, busy, onDragEnd, onKeyboardMove, onToggle }: PrintItemProps) {
  const controls = useDragControls();
  const reduceMotion = useReducedMotion();
  const tag = KIND_TAG[item.kind];

  const onHandleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") onKeyboardMove(-1);
    else if (event.key === "ArrowRight" || event.key === "ArrowDown") onKeyboardMove(1);
    else return;
    event.preventDefault();
  };

  return (
    <Reorder.Item
      value={item.id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
      whileDrag={{ scale: 1.03, zIndex: 20, boxShadow: "0 24px 60px -12px rgb(0 0 0 / 0.8)" }}
      className={cn("relative shrink-0 rounded-[1.5rem]", !item.published && "opacity-55")}
    >
      <figure
        onPointerDown={(event) => event.pointerType === "mouse" && !busy && controls.start(event)}
        className="h-full rounded-[1.5rem] md:cursor-grab md:active:cursor-grabbing border border-line bg-surface p-2 select-none"
      >
        <div className={cn("overflow-hidden", item.kind === "result" ? "rounded-[1.35rem]" : "rounded-[1.1rem] bg-white")}>
          <img src={item.imageUrl} alt="" draggable={false} className="h-[16rem] w-auto sm:h-[20rem]" />
        </div>
        <span className={cn("absolute top-4 left-4 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold shadow-lg backdrop-blur", tag.className)}>
          {tag.label}
        </span>
        <span className="absolute top-4 right-4 grid size-7 place-items-center rounded-full bg-black/70 font-display text-xs font-semibold text-white backdrop-blur tabular-nums">
          {position}
        </span>
        <figcaption className="max-w-[11rem] px-1.5 pt-2.5 sm:max-w-[13rem]">
          <p className="truncate font-display text-sm font-semibold text-white">{item.title}</p>
          <p className="mt-0.5 truncate text-xs text-mist">{item.published ? item.subtitle : "Fora do site"}</p>
        </figcaption>
        <div className="flex items-center gap-1.5 px-1 pt-2.5 pb-1">
          <button
            type="button"
            aria-label={`Mudar a posição de ${item.title}, hoje ${position} de ${total}. Use as setas para mover.`}
            title="Arraste para mudar a ordem"
            disabled={busy}
            onKeyDown={onHandleKeyDown}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (!busy) controls.start(event);
            }}
            className={cn(iconButtonClass, "cursor-grab touch-none active:cursor-grabbing disabled:opacity-30")}
          >
            <GripVertical aria-hidden className="size-4" />
          </button>
          <IconButton label={item.published ? "Tirar do site" : "Publicar no site"} onClick={onToggle} disabled={busy}>
            {item.published ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
          </IconButton>
          <Link
            to={`/admin/depoimentos/${item.id}`}
            aria-label={`Editar ${item.title}`}
            title="Editar"
            onPointerDown={(event) => event.stopPropagation()}
            className={iconButtonClass}
          >
            <Pencil aria-hidden className="size-4" />
          </Link>
        </div>
      </figure>
    </Reorder.Item>
  );
}

function PrintsRow({ items, onChanged }: { items: Testimonial[]; onChanged: () => void }) {
  const toast = useToast();
  const savedOrder = items.map((item) => item.id);
  const [order, setOrder] = useState<string[]>(savedOrder);
  const save = useMutation(async (deps, ids: string[]) => {
    await reorderTestimonials(deps, ids);
    return true;
  });
  const toggle = useMutation((deps, item: Testimonial) => saveTestimonial(deps, item.id, { ...item, published: !item.published }));
  const busy = save.pending || toggle.pending;
  const byId = new Map(items.map((item) => [item.id, item]));
  const savedKey = savedOrder.join(",");

  useEffect(() => setOrder(savedKey ? savedKey.split(",") : []), [savedKey]);

  const persist = async (next: string[]) => {
    if (sameOrder(next, savedOrder)) return;
    const saved = await save.run(next);
    if (!saved) {
      toast.show("Não foi possível salvar a nova ordem.", "error");
      setOrder(savedOrder);
      return;
    }
    toast.show("Ordem salva. O site já mostra assim.");
    onChanged();
  };

  const onKeyboardMove = (id: string, direction: -1 | 1) => {
    const next = moveId(order, id, direction);
    setOrder(next);
    void persist(next);
  };

  const onToggle = async (item: Testimonial) => {
    const saved = await toggle.run(item);
    if (!saved) {
      toast.show("Não foi possível alterar o depoimento.", "error");
      return;
    }
    toast.show(saved.published ? "Depoimento publicado no site." : "Depoimento tirado do site.");
    onChanged();
  };

  return (
    <div className="-mx-4 overflow-x-auto px-4 pt-1 pb-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
      <Reorder.Group axis="x" values={order} onReorder={setOrder} className="flex w-max gap-3 sm:gap-4">
        {order.map((id, index) => {
          const item = byId.get(id);
          if (!item) return null;
          return (
            <PrintItem
              key={id}
              item={item}
              position={index + 1}
              total={order.length}
              busy={busy}
              onDragEnd={() => void persist(order)}
              onKeyboardMove={(direction) => onKeyboardMove(id, direction)}
              onToggle={() => void onToggle(item)}
            />
          );
        })}
      </Reorder.Group>
    </div>
  );
}

export default function TestimonialsListPage() {
  const testimonials = useAdminQuery(listAllTestimonials, "admin-testimonials");
  const published = testimonials.status === "success" ? testimonials.data.filter((item) => item.published).length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Depoimentos"
        description={
          testimonials.status === "success"
            ? `${published} no site. Arraste os cards para mudar a ordem da faixa de resultados da página inicial.`
            : "Prints de resultados e de contas entregues."
        }
        action={
          <ButtonLink to="/admin/depoimentos/novo" className="max-md:hidden">
            <Plus aria-hidden className="size-4" /> Novo depoimento
          </ButtonLink>
        }
      />

      {testimonials.status === "loading" && <LoadingBlock />}
      {testimonials.status === "error" && <ErrorState message={testimonials.error.message} onRetry={testimonials.reload} />}
      {testimonials.status === "success" && testimonials.data.length === 0 && (
        <EmptyState
          title="Nenhum depoimento ainda"
          description="Suba o primeiro print e ele entra na faixa de resultados do site."
          action={<ButtonLink to="/admin/depoimentos/novo">Adicionar depoimento</ButtonLink>}
        />
      )}
      {testimonials.status === "success" && testimonials.data.length > 0 && (
        <PrintsRow items={testimonials.data} onChanged={testimonials.reload} />
      )}
      <Fab to="/admin/depoimentos/novo" label="Novo depoimento" />
    </div>
  );
}
