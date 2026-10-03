export class AccountNotFoundError extends Error {
  constructor(slug: string) {
    super(`Conta "${slug}" não encontrada.`);
    this.name = "AccountNotFoundError";
  }
}

export class AccountUnavailableError extends Error {
  constructor(handle: string) {
    super(`A conta ${handle} não está mais disponível.`);
    this.name = "AccountUnavailableError";
  }
}

export class OrderNotFoundError extends Error {
  constructor(code: string) {
    super(`Pedido ${code} não encontrado.`);
    this.name = "OrderNotFoundError";
  }
}
