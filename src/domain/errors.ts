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
