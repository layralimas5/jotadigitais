import { ShieldCheck, UserCog } from "lucide-react";
import type { ReactNode } from "react";
import {
  STAFF_PERMISSION_HINT,
  STAFF_PERMISSION_LABEL,
  STAFF_PERMISSIONS,
  type AdminUserAccess,
  type AssignableRole,
  type StaffPermission,
} from "@/domain/admin-user";
import { FormSection } from "../components/AdminUi";
import { SegmentedField, ToggleField } from "../components/FormControls";

const ROLE_OPTIONS: { value: AssignableRole; label: string; icon: ReactNode }[] = [
  { value: "helper", label: "Ajudante", icon: <UserCog aria-hidden className="size-4" /> },
  { value: "admin", label: "Admin", icon: <ShieldCheck aria-hidden className="size-4" /> },
];

const ROLE_HINT: Record<AssignableRole, string> = {
  helper: "Vê só as áreas que você ligar abaixo. Usuários, privacidade, APIs, suporte e o CPF dos clientes ficam sempre fechados.",
  admin: "Acesso completo à loja, igual ao seu, inclusive cadastrar e tirar usuários.",
};

interface AccessFieldsProps {
  value: AdminUserAccess;
  onChange: (value: AdminUserAccess) => void;
  error?: string;
}

/** Papel (admin ou ajudante) e, no ajudante, as áreas liberadas uma a uma. */
export function AccessFields({ value, onChange, error }: AccessFieldsProps) {
  const toggle = (permission: StaffPermission, on: boolean) =>
    onChange({
      ...value,
      permissions: on ? [...value.permissions, permission] : value.permissions.filter((item) => item !== permission),
    });

  return (
    <FormSection title="O que a pessoa pode fazer" description={ROLE_HINT[value.role]}>
      <SegmentedField legend="Tipo de acesso" name="role" value={value.role} options={ROLE_OPTIONS} onChange={(role) => onChange({ ...value, role })} />
      {value.role === "helper" && (
        <fieldset aria-describedby={error ? "permissions-error" : undefined} className="space-y-2">
          <legend className="text-sm font-medium text-fog">Áreas liberadas</legend>
          {error && (
            <p id="permissions-error" className="text-xs font-medium text-[#ff7a7a]">
              {error}
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {STAFF_PERMISSIONS.map((permission) => (
              <ToggleField
                key={permission}
                name={`permission-${permission}`}
                label={STAFF_PERMISSION_LABEL[permission]}
                description={STAFF_PERMISSION_HINT[permission]}
                checked={value.permissions.includes(permission)}
                onChange={(on) => toggle(permission, on)}
              />
            ))}
          </div>
        </fieldset>
      )}
    </FormSection>
  );
}
