import { COMMISSION_CANCEL_REASON_LABEL, COMMISSION_VIA_LABEL, commissionStateOf, type AffiliateCommission } from "@/domain/affiliate";
import { formatBRL } from "@/domain/money";
import { CommissionStateBadge } from "./AffiliateBadges";

const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

/** "Libera em 12 de dez." enquanto a garantia corre; "Espera a entrega" antes disso. */
function releaseNote(commission: AffiliateCommission): string | null {
  const state = commissionStateOf(commission);
  if (state === "canceled") return commission.canceledReason ? COMMISSION_CANCEL_REASON_LABEL[commission.canceledReason] : null;
  if (state !== "pending") return null;
  return commission.releaseAt ? `Libera em ${day.format(new Date(commission.releaseAt))}` : "Espera a entrega da conta";
}

interface CommissionListProps {
  commissions: readonly AffiliateCommission[];
  /** No painel do Jota: o nome do afiliado de cada linha. */
  affiliateName?: (affiliateId: string) => string;
  onCancel?: (commission: AffiliateCommission) => void;
}

/** Extrato de comissões: tabela no computador, cartões no celular. */
export function CommissionList({ commissions, affiliateName, onCancel }: CommissionListProps) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-3xl border border-line lg:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs text-mist">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">Venda</th>
              {affiliateName && <th scope="col" className="px-4 py-3 font-medium">Afiliado</th>}
              <th scope="col" className="px-4 py-3 font-medium">Conta</th>
              <th scope="col" className="px-4 py-3 font-medium">Origem</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Venda</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Comissão</th>
              <th scope="col" className="px-4 py-3 font-medium">Situação</th>
              {onCancel && <th scope="col" className="px-4 py-3"><span className="sr-only">Ações</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {commissions.map((commission) => {
              const note = releaseNote(commission);
              return (
                <tr key={commission.id}>
                  <td className="px-5 py-3">
                    <p className="font-mono text-xs text-white">{commission.orderCode}</p>
                    <p className="text-xs text-mist">{day.format(new Date(commission.createdAt))}</p>
                  </td>
                  {affiliateName && <td className="px-4 py-3 text-fog">{affiliateName(commission.affiliateId)}</td>}
                  <td className="px-4 py-3 text-fog">{commission.accountHandle ?? "Conta removida"}</td>
                  <td className="px-4 py-3 text-fog">{COMMISSION_VIA_LABEL[commission.via]}</td>
                  <td className="px-4 py-3 text-right text-fog tabular-nums">{formatBRL(commission.base)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">{formatBRL(commission.amount)}</td>
                  <td className="px-4 py-3">
                    <CommissionStateBadge commission={commission} />
                    {note && <p className="mt-1 text-xs text-mist">{note}</p>}
                  </td>
                  {onCancel && (
                    <td className="px-4 py-3 text-right">
                      {commissionStateOf(commission) === "pending" || commissionStateOf(commission) === "released" ? (
                        <button
                          type="button"
                          onClick={() => onCancel(commission)}
                          className="rounded-md text-xs font-medium text-mist transition-colors hover:text-[#ff9a9a] focus-visible:outline-2 focus-visible:outline-electric"
                        >
                          Cancelar
                        </button>
                      ) : null}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-2.5 lg:hidden">
        {commissions.map((commission) => {
          const note = releaseNote(commission);
          const cancelable = onCancel && (commissionStateOf(commission) === "pending" || commissionStateOf(commission) === "released");
          return (
            <li key={commission.id} className="rounded-2xl border border-line bg-surface/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{commission.accountHandle ?? "Conta removida"}</p>
                  <p className="mt-0.5 text-xs text-mist">
                    <span className="font-mono">{commission.orderCode}</span> · {day.format(new Date(commission.createdAt))} ·{" "}
                    {COMMISSION_VIA_LABEL[commission.via]}
                  </p>
                  {affiliateName && <p className="mt-0.5 text-xs text-fog">{affiliateName(commission.affiliateId)}</p>}
                </div>
                <p className="shrink-0 font-display text-lg font-bold text-white tabular-nums">{formatBRL(commission.amount)}</p>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                <div className="min-w-0">
                  <CommissionStateBadge commission={commission} />
                  {note && <p className="mt-1 text-xs text-mist">{note}</p>}
                </div>
                {cancelable && (
                  <button type="button" onClick={() => onCancel(commission)} className="text-xs font-medium text-mist hover:text-[#ff9a9a]">
                    Cancelar
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
