import { ButtonLink } from "@/ui/components/Button";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";

export default function NotFoundPage() {
  useDocumentMeta("Página não encontrada");
  return (
    <div className="grid min-h-[80vh] place-items-center px-4 pt-24 text-center">
      <div>
        <p className="font-logo text-8xl text-transparent [-webkit-text-stroke:2px_var(--color-electric)]">404</p>
        <h1 className="mt-6 font-display text-2xl font-semibold text-white">Essa página não existe</h1>
        <p className="mt-2 text-mist">Mas as contas da vitrine existem, e estão esperando por você.</p>
        <ButtonLink to="/contas" className="mt-8">
          Ver contas
        </ButtonLink>
      </div>
    </div>
  );
}
