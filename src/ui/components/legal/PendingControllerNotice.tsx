import { TriangleAlert } from "lucide-react";
import { LEGAL_CONTROLLER } from "@/application/legal-documents";
import { CONTROLLER_FIELD_LABEL, missingControllerFields } from "@/domain/legal/legal-document";

const MISSING = missingControllerFields(LEGAL_CONTROLLER);

/** Aviso para o controlador enquanto faltar algum dado em src/domain/legal/controller.json. */
export function PendingControllerNotice() {
  if (MISSING.length === 0) return null;
  return (
    <div role="note" className="flex gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/[0.06] p-4 text-sm text-amber-100">
      <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-amber-300" />
      <div>
        <p className="font-semibold text-amber-200">Rascunho: preencher antes de publicar</p>
        <p className="mt-1 leading-relaxed">
          O controlador precisa informar {MISSING.map((field) => CONTROLLER_FIELD_LABEL[field]).join(", ")}. Os campos
          aparecem destacados no texto. Este documento não substitui a revisão de um advogado especializado em proteção de
          dados.
        </p>
      </div>
    </div>
  );
}
