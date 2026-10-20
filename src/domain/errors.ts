export class AccountNotFoundError extends Error {
  constructor(slug: string) {
    super(`Conta "${slug}" não encontrada.`);
    this.name = "AccountNotFoundError";
  }
}

export class AccountUnavailableError extends Error {
  constructor(handle?: string) {
    super(handle ? `A conta ${handle} não está mais disponível.` : "Esta conta não está mais disponível.");
    this.name = "AccountUnavailableError";
  }
}

export class OrderNotFoundError extends Error {
  constructor(code: string) {
    super(`Pedido ${code} não encontrado.`);
    this.name = "OrderNotFoundError";
  }
}

export class TooManyOpenOrdersError extends Error {
  constructor() {
    super("Você já tem pedidos aguardando pagamento. Conclua um deles ou fale com o suporte.");
    this.name = "TooManyOpenOrdersError";
  }
}

export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`Já existe uma conta com o endereço "${slug}". Escolha outro.`);
    this.name = "SlugTakenError";
  }
}

export class InvalidTransitionError extends Error {
  constructor() {
    super("Essa mudança de status não é permitida para o pedido.");
    this.name = "InvalidTransitionError";
  }
}

export class LeadNotFoundError extends Error {
  constructor() {
    super("Este contato não existe mais. Ele pode ter sido apagado.");
    this.name = "LeadNotFoundError";
  }
}

export class CustomerNotFoundError extends Error {
  constructor() {
    super("Este cadastro não existe mais. Ele pode ter sido apagado.");
    this.name = "CustomerNotFoundError";
  }
}

export class CustomerEmailTakenError extends Error {
  constructor(email: string) {
    super(`Já existe um cliente cadastrado com o e-mail ${email}.`);
    this.name = "CustomerEmailTakenError";
  }
}

export class RevenueNotFoundError extends Error {
  constructor() {
    super("Esta receita não existe mais. Ela pode ter sido apagada.");
    this.name = "RevenueNotFoundError";
  }
}

export class ExpenseNotFoundError extends Error {
  constructor() {
    super("Esta despesa não existe mais. Ela pode ter sido apagada.");
    this.name = "ExpenseNotFoundError";
  }
}

export class PartnerNotFoundError extends Error {
  constructor() {
    super("Este parceiro não existe mais. Ele pode ter sido apagado.");
    this.name = "PartnerNotFoundError";
  }
}

export class AdminUserEmailTakenError extends Error {
  constructor(email: string) {
    super(`Já existe um usuário com o e-mail ${email}.`);
    this.name = "AdminUserEmailTakenError";
  }
}

export class CannotRemoveAdminUserError extends Error {
  constructor(reason: "self" | "last") {
    super(
      reason === "self"
        ? "Você não pode tirar o seu próprio acesso. Peça para outro usuário fazer isso."
        : "O sistema precisa de pelo menos um usuário com acesso.",
    );
    this.name = "CannotRemoveAdminUserError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("E-mail ou senha incorretos.");
    this.name = "InvalidCredentialsError";
  }
}

export class NotAdminError extends Error {
  constructor() {
    super("Este usuário não tem acesso ao painel.");
    this.name = "NotAdminError";
  }
}

export class WrongCurrentPasswordError extends Error {
  constructor() {
    super("A senha atual não confere.");
    this.name = "WrongCurrentPasswordError";
  }
}
