import { useMemo } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { container } from "@/app/container";
import { PreviewAffiliatePortalService } from "@/application/affiliate-preview";
import { canUseStoreArea } from "@/domain/admin-user";
import { AffiliateProtected, AffiliateSpinner } from "@/ui/affiliate/AffiliateLayout";
import { AffiliateSessionProvider } from "@/ui/affiliate/session";
import { HOME_PATH } from "../navigation";
import { useAdminSession } from "../session";

export const DEVELOPER_AFFILIATES_PATH = "/admin/acessos";
export const affiliatePreviewPath = (id: string) => `/admin/ver-afiliado/${id}`;

/**
 * "Ver como" de um afiliado: as telas do painel dele, na mesma aparência, lidas pelo acesso de quem está no painel
 * da loja. Só leitura e com dados pessoais mascarados. Abre para a desenvolvedora e para quem cuida de Parceiros.
 */
export default function AffiliatePreviewRoot() {
  const { id = "" } = useParams();
  const { state } = useAdminSession();
  const location = useLocation();
  const portal = useMemo(() => new PreviewAffiliatePortalService(container.admin.affiliates, container.store.accounts, id), [id]);

  if (state.status === "loading") return <AffiliateSpinner label="Verificando acesso" />;
  if (state.status !== "signed-in") return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  const { role, permissions } = state.session;
  const allowed = role === "developer" || canUseStoreArea({ role, permissions }, "partners");
  if (!allowed) return <Navigate to={HOME_PATH} replace />;

  const backPath = role === "developer" ? DEVELOPER_AFFILIATES_PATH : `/admin/parceiros/afiliados/${id}`;
  return (
    <AffiliateSessionProvider portal={portal} basePath={affiliatePreviewPath(id)} preview={{ backPath }}>
      <AffiliateProtected />
    </AffiliateSessionProvider>
  );
}
