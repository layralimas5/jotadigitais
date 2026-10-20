import { Download, ShieldAlert } from "lucide-react";
import { createBackup } from "@/application/backup-use-cases";
import { backupCounts, backupFileName } from "@/domain/backup";
import { Button } from "@/ui/components/Button";
import { FormSection, InlineError } from "../components/AdminUi";
import { useMutation } from "../hooks";
import { downloadJson } from "../lib/download";
import { useToast } from "../toast";

function summaryOf(counts: ReturnType<typeof backupCounts>): string {
  const filled = counts.filter((item) => item.count > 0).map((item) => item.label);
  return filled.length > 0 ? `Backup baixado: ${filled.join(", ")}.` : "Backup baixado.";
}

export function BackupSection() {
  const toast = useToast();
  const backup = useMutation((deps) => createBackup(deps));

  const onDownload = async () => {
    const result = await backup.run();
    if (!result) return;
    downloadJson(backupFileName(new Date(result.createdAt)), result);
    toast.show(summaryOf(backupCounts(result.data)));
  };

  return (
    <FormSection
      title="Backup do sistema"
      description="Baixa um arquivo com contas, pedidos, clientes, leads, parceiros, receitas, despesas, depoimentos, mensagens da automação e dados do site. As fotos entram como link."
    >
      <p className="flex gap-3 rounded-2xl border border-line-strong bg-ink px-4 py-3 text-sm text-fog">
        <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-electric" />
        O arquivo tem nome, e-mail e WhatsApp de clientes. Guarde num lugar só seu, como um drive com senha, e não mande por grupo.
      </p>
      {backup.error && <InlineError message={backup.error.message} />}
      <Button onClick={() => void onDownload()} disabled={backup.pending} className="max-sm:w-full">
        <Download aria-hidden className="size-4" />
        {backup.pending ? "Gerando…" : "Baixar backup"}
      </Button>
    </FormSection>
  );
}
