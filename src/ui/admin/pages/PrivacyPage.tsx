import { useState } from "react";
import { listDataRequests } from "@/application/privacy-use-cases";
import { isOverdue } from "@/domain/privacy";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { Kpi } from "../components/Kpi";
import { useAdminQuery } from "../hooks";
import { PrivacyTools } from "../privacy/PrivacyTools";
import { RequestCard } from "../privacy/RequestCard";

export default function PrivacyPage() {
  const requests = useAdminQuery(listDataRequests, "data-requests");
  const [subjectEmail, setSubjectEmail] = useState("");

  const prepareAnonymization = (email: string) => {
    setSubjectEmail(email);
    document.getElementById("anonimizar")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const open = requests.status === "success" ? requests.data.filter((request) => request.status === "open") : [];
  const overdue = open.filter((request) => isOverdue(request));

  return (
    <div className="space-y-8">
      <PageHeader title="Privacidade" description="Solicitações da LGPD feitas em Meus dados. O prazo de resposta é de 15 dias." />

      {requests.status === "loading" && <LoadingBlock />}
      {requests.status === "error" && <ErrorState message={requests.error.message} onRetry={requests.reload} />}
      {requests.status === "success" && (
        <>
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            <Kpi label="Abertas" value={String(open.length)} />
            <Kpi label="Prazo vencido" value={String(overdue.length)} tone={overdue.length > 0 ? "negative" : undefined} />
            <Kpi label="Total" value={String(requests.data.length)} />
          </div>
          {requests.data.length === 0 ? (
            <EmptyState title="Nenhuma solicitação" description="Quando alguém pedir algo em Meus dados, a solicitação aparece aqui e no sininho." />
          ) : (
            <div className="space-y-3">
              {requests.data.map((request) => (
                <RequestCard key={request.id} request={request} onChanged={requests.reload} onAnonymize={prepareAnonymization} />
              ))}
            </div>
          )}
        </>
      )}

      <section aria-labelledby="ferramentas" className="space-y-4">
        <h2 id="ferramentas" className="font-display text-lg font-semibold text-white">
          Ferramentas
        </h2>
        <PrivacyTools email={subjectEmail} onEmailChange={setSubjectEmail} onDone={requests.reload} />
      </section>
    </div>
  );
}
