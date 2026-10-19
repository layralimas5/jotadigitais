import { KeyRound } from "lucide-react";
import { FormSection, LoadingBlock, PageHeader } from "../components/AdminUi";
import { useAdminSession } from "../session";
import { BackupSection } from "../settings/BackupSection";
import { PasswordResetSection } from "../settings/PasswordResetSection";
import { PasswordSection } from "../settings/PasswordSection";
import { ProfileSection } from "../settings/ProfileSection";
import { HAS_REAL_AUTH } from "../settings/settings-links";

function DemoPasswordNotice() {
  return (
    <FormSection title="Senha" description="Troca de senha e link de redefinição por e-mail.">
      <p className="text-sm text-fog">
        No modo demonstração o painel não tem senha: ele abre direto neste navegador. Assim que o banco for conectado, trocar e
        redefinir a senha passam a funcionar aqui.
      </p>
    </FormSection>
  );
}

export default function SettingsPage() {
  const { state } = useAdminSession();
  if (state.status !== "signed-in") return <LoadingBlock />;
  const { session } = state;

  return (
    <>
      <PageHeader title="Configurações" description="Seu perfil, sua senha e o backup do sistema." />
      {session.recoveringPassword && (
        <p role="status" className="mt-6 flex gap-3 rounded-2xl border border-electric/30 bg-electric/[0.07] px-4 py-3 text-sm text-white">
          <KeyRound aria-hidden className="mt-0.5 size-5 shrink-0 text-electric" />
          Você entrou pelo link de redefinição. Crie a senha nova logo abaixo para concluir.
        </p>
      )}
      <div className="mt-6 space-y-5">
        {session.recoveringPassword && <PasswordSection session={session} />}
        <ProfileSection session={session} />
        {HAS_REAL_AUTH ? (
          <>
            {!session.recoveringPassword && <PasswordSection session={session} />}
            <PasswordResetSection session={session} />
          </>
        ) : (
          <DemoPasswordNotice />
        )}
        <BackupSection />
      </div>
    </>
  );
}
