import { Eye, EyeOff, FlaskConical, LogOut, Settings, ShieldUser } from "lucide-react";
import { PanelUserMenu, type PanelMenuItem } from "@/ui/components/panel-shell/PanelUserMenu";
import { SETTINGS_PATH } from "../navigation";
import { JOTA_SUBJECT, useAdminView } from "../admin-view";
import { usePreviewToggle } from "../preview/PreviewControls";
import { useAdminSession } from "../session";
import { PersonAvatar } from "./PersonAvatar";
import { RoleBadge } from "./RoleBadge";

/** Ícone do usuário no canto superior direito: Configurações, Usuários (só o Jota) e Sair. */
export function UserMenu() {
  const { state, signOut } = useAdminSession();
  const { viewRole } = useAdminView();
  const preview = usePreviewToggle();

  if (state.status !== "signed-in") return null;
  const { email, name, role, avatarUrl } = state.session;

  const items: PanelMenuItem[] = [{ key: "settings", label: "Configurações", icon: Settings, to: SETTINGS_PATH }];
  if (role === "developer" && preview.asSomeone) {
    items.push({ key: "exit-preview", label: "Voltar ao meu painel", icon: EyeOff, onSelect: preview.exit });
  }
  if (role === "developer" && !preview.asSomeone) {
    items.push(
      { key: "preview", label: "Ver como o Jota", icon: Eye, onSelect: () => preview.enter(JOTA_SUBJECT) },
      { key: "sandbox", label: "Testar como o Jota", icon: FlaskConical, onSelect: () => preview.enterSandbox(JOTA_SUBJECT) },
    );
  }
  if (viewRole === "admin") items.push({ key: "users", label: "Usuários", icon: ShieldUser, to: "/admin/usuarios" });
  items.push({ key: "sign-out", label: "Sair", icon: LogOut, danger: true, onSelect: () => void signOut() });

  return (
    <PanelUserMenu
      name={name}
      email={email}
      avatar={avatarUrl ? <PersonAvatar name={name ?? email} src={avatarUrl} className="size-8 ring-1 ring-electric/40" /> : undefined}
      badge={<RoleBadge role={role} className="mt-2" />}
      items={items}
    />
  );
}
