/** E-mail de uma conta que a loja está crescendo, com a senha e os dados de recuperação. */
export interface EmailAccountData {
  email: string;
  /** Nula quando ainda não foi anotada. O banco guarda só cifrada. */
  password: string | null;
  /** Onde o e-mail é usado. Ex.: "TikTok @achadinhos". */
  usedFor: string | null;
  /** Aparelho em que o e-mail está logado (iPhone, PC, POCO...): onde chega o código de verificação. */
  device: string | null;
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
  return [item.email, item.usedFor, item.device, item.recoveryEmail, item.notes].some((field) => (field ?? "").toLowerCase().includes(needle));
}

/** Mesmo aparelho escrito de jeitos diferentes ("iphone", "iPhone ") conta como um só. */
export const deviceKeyOf = (device: string) => device.trim().toLocaleLowerCase("pt-BR");

/** Aparelhos já usados, cada um uma vez (na grafia mais recente da lista), em ordem alfabética. */
export function devicesOf(items: readonly Pick<EmailAccountData, "device">[]): string[] {
  const byKey = new Map<string, string>();
  for (const { device } of items) {
    const name = device?.trim();
    if (name && !byKey.has(deviceKeyOf(name))) byKey.set(deviceKeyOf(name), name);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Login que vai para quem comprou a conta: o e-mail ligado a ela na aba E-mails. */
export interface AccountAccess {
  email: string;
  /** Nula quando ainda não foi anotada ou quando quem vê não tem acesso às senhas. */
  password: string | null;
  device: string | null;
}

export const accessOf = (item: EmailAccount | null): AccountAccess | null =>
  item ? { email: item.email, password: item.password, device: item.device } : null;
