import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { listAllTestimonials, moveTestimonial, saveTestimonial } from "@/application/admin-use-cases";
import type { Testimonial } from "@/domain/testimonial";
import { ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { Fab, LoadingBlock, PageHeader } from "../components/AdminUi";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";

const KIND_LABEL = { result: "Resultado", delivered: "Conta entregue" } as const;

const iconButtonClass =
  "grid size-10 place-items-center rounded-full border border-line-strong text-fog transition-[color,border-color,transform] hover:border-white/30 hover:text-white active:scale-90";

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

export default function TestimonialsListPage() {
  const testimonials = useAdminQuery(listAllTestimonials, "admin-testimonials");
  const toast = useToast();
  const reduceMotion = useReducedMotion();
  const move = useMutation(async (deps, items: Testimonial[], id: string, direction: -1 | 1) => {
    await moveTestimonial(deps, items, id, direction);
    return true;
  });
  const toggle = useMutation((deps, item: Testimonial) => saveTestimonial(deps, item.id, { ...item, published: !item.published }));
  const busy = move.pending || toggle.pending;

  const onMove = async (items: Testimonial[], id: string, direction: -1 | 1) => {
    const moved = await move.run(items, id, direction);
    if (!moved) toast.show("Não foi possível mudar a ordem.", "error");
    testimonials.reload();
  };

  const onToggle = async (item: Testimonial) => {
    const saved = await toggle.run(item);
    if (!saved) {
      toast.show("Não foi possível alterar o depoimento.", "error");
      return;
    }
    toast.show(saved.published ? "Depoimento publicado no site." : "Depoimento tirado do site.");
    testimonials.reload();
  };

  const published = testimonials.status === "success" ? testimonials.data.filter((item) => item.published).length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Depoimentos"
        description={
          testimonials.status === "success"
            ? `${published} no site. A ordem daqui é a ordem da faixa de resultados na página inicial.`
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
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.data.map((item, index, items) => (
            <motion.li
              key={item.id}
              layout={!reduceMotion}
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
              className={cn(
                "flex gap-4 rounded-2xl border border-line bg-surface/60 p-3 transition-opacity",
                !item.published && "opacity-60",
              )}
            >
              <Link to={`/admin/depoimentos/${item.id}`} className="shrink-0 rounded-xl" aria-label={`Editar ${item.title}`}>
                <img src={item.imageUrl} alt="" className="h-36 w-20 rounded-xl bg-white object-cover object-top" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-[0.7rem] font-semibold tracking-wide text-electric uppercase">
                  {index + 1}. {KIND_LABEL[item.kind]}
                  {!item.published && <span className="ml-2 text-mist normal-case">fora do site</span>}
                </p>
                <p className="mt-1 truncate font-display font-semibold text-white">{item.title}</p>
                <p className="truncate text-xs text-mist">{item.subtitle}</p>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                  <IconButton label="Subir na ordem" onClick={() => void onMove(items, item.id, -1)} disabled={busy || index === 0}>
                    <ArrowUp aria-hidden className="size-4" />
                  </IconButton>
                  <IconButton
                    label="Descer na ordem"
                    onClick={() => void onMove(items, item.id, 1)}
                    disabled={busy || index === items.length - 1}
                  >
                    <ArrowDown aria-hidden className="size-4" />
                  </IconButton>
                  <IconButton label={item.published ? "Tirar do site" : "Publicar no site"} onClick={() => void onToggle(item)} disabled={busy}>
                    {item.published ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
                  </IconButton>
                  <Link to={`/admin/depoimentos/${item.id}`} aria-label={`Editar ${item.title}`} title="Editar" className={iconButtonClass}>
                    <Pencil aria-hidden className="size-4" />
                  </Link>
                </div>
              </div>
            </motion.li>
          ))}
        </ol>
      )}
      <Fab to="/admin/depoimentos/novo" label="Novo depoimento" />
    </div>
  );
}
