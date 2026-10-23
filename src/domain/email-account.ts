/** E-mail de uma conta que a loja está crescendo, com a senha e os dados de recuperação. */
export interface EmailAccountData {
  email: string;
  /** Nula quando ainda não foi anotada. O banco guarda só cifrada. */
  password: string | null;
  /** Onde o e-mail é usado. Ex.: "TikTok @achadinhos". */
  usedFor: string | null;
  recoveryEmail: string | null;
  /** Só dígitos, com DDD (o DDI 55 é opcional). */
  recoveryPhone: string | null;
  /** Conta do estoque ligada a este e-mail, quando já foi cadastrada. */
  accountId: string | null;
  notes: string | null;
}

export interface EmailAccount extends EmailAccountData {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/** Item da lista: a senha só é aberta na ficha de cada e-mail. */
export type EmailAccountListItem = Omit<EmailAccount, "password"> & { hasPassword: boolean };

export function matchesEmailAccount(item: EmailAccountListItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [item.email, item.usedFor, item.recoveryEmail, item.notes].some((field) => (field ?? "").toLowerCase().includes(needle));
}
