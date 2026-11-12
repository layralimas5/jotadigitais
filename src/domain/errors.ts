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

export class EmailAccountNotFoundError extends Error {
  constructor() {
    super("Este e-mail não existe mais. Ele pode ter sido apagado.");
    this.name = "EmailAccountNotFoundError";
  }
}

export class EmailAccountTakenError extends Error {
  constructor(email: string) {
    super(`O e-mail ${email} já está salvo. Abra o cadastro dele para editar.`);
    this.name = "EmailAccountTakenError";
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

const CHANGE_ACCESS_MESSAGE: Record<"self" | "developer" | "last", string> = {
  self: "Você não pode mudar o seu próprio acesso. Peça para outro admin fazer isso.",
  developer: "O acesso da desenvolvedora não muda por aqui.",
  last: "O sistema precisa de pelo menos um admin. Promova outra pessoa antes.",
};

export class CannotChangeAccessError extends Error {
  constructor(reason: "self" | "developer" | "last") {
    super(CHANGE_ACCESS_MESSAGE[reason]);
    this.name = "CannotChangeAccessError";
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

export class InvalidMfaCodeError extends Error {
  constructor() {
    super("Código incorreto ou vencido. Confira o app autenticador e digite o código atual.");
    this.name = "InvalidMfaCodeError";
  }
}

/** Limite de tentativas do checkout ou da página do pedido (o servidor barra quem repete demais). */
export class TooManyAttemptsError extends Error {
  constructor() {
    super("Muitas tentativas seguidas. Espere alguns minutos e tente de novo.");
    this.name = "TooManyAttemptsError";
  }
}

export class WrongCurrentPasswordError extends Error {
  constructor() {
    super("A senha atual não confere.");
    this.name = "WrongCurrentPasswordError";
  }
}

export class OutdatedLegalDocumentsError extends Error {
  constructor() {
    super("Os Termos de Uso ou a Política de Privacidade foram atualizados. Recarregue a página, leia a versão nova e tente de novo.");
    this.name = "OutdatedLegalDocumentsError";
  }
}

export class TooManyPrivacyAttemptsError extends Error {
  constructor() {
    super("Muitas tentativas seguidas. Por segurança, espere uma hora ou escreva para o e-mail de privacidade.");
    this.name = "TooManyPrivacyAttemptsError";
  }
}

export class TooManyOpenDataRequestsError extends Error {
  constructor() {
    super("Você já tem cinco solicitações em aberto. Aguarde a resposta delas antes de abrir outra.");
    this.name = "TooManyOpenDataRequestsError";
  }
}

export class DataSubjectNotFoundError extends Error {
  constructor() {
    super("Não encontramos um pedido com esse e-mail e esse código. Confira os dois e tente de novo.");
    this.name = "DataSubjectNotFoundError";
  }
}

export class SupportTicketNotFoundError extends Error {
  constructor() {
    super("Este chamado não existe mais.");
    this.name = "SupportTicketNotFoundError";
  }
}

export class SupportPriorityForbiddenError extends Error {
  constructor() {
    super("A prioridade de um chamado finalizado não muda mais.");
    this.name = "SupportPriorityForbiddenError";
  }
}

export class SupportStatusForbiddenError extends Error {
  constructor() {
    super("Só a desenvolvedora muda a situação do chamado.");
    this.name = "SupportStatusForbiddenError";
  }
}

export class SupportVisibilityForbiddenError extends Error {
  constructor() {
    super("Só a desenvolvedora decide quem vê o chamado.");
    this.name = "SupportVisibilityForbiddenError";
  }
}

export class SupportApprovalError extends Error {
  constructor(message = "Só dá para aprovar chamado que está aguardando o Jota.") {
    super(message);
    this.name = "SupportApprovalError";
  }
}

export class PreviewReadOnlyError extends Error {
  constructor() {
    super("Modo visualização: aqui você vê o painel como o Jota, mas nada é salvo. Volte para o seu painel para mexer.");
    this.name = "PreviewReadOnlyError";
  }
}

export class SupportAttachmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupportAttachmentError";
  }
}

export class SupportLabelForbiddenError extends Error {
  constructor() {
    super("Só a desenvolvedora cria e escolhe as etiquetas do suporte.");
    this.name = "SupportLabelForbiddenError";
  }
}

export class SupportLabelNameTakenError extends Error {
  constructor(name: string) {
    super(`Já existe uma etiqueta "${name}".`);
    this.name = "SupportLabelNameTakenError";
  }
}

export class AccessForbiddenError extends Error {
  constructor() {
    super("Você não pode mudar o acesso deste usuário.");
    this.name = "AccessForbiddenError";
  }
}

export class SupportMergeForbiddenError extends Error {
  constructor() {
    super("Só a desenvolvedora junta e separa chamados.");
    this.name = "SupportMergeForbiddenError";
  }
}

export class SupportMergeError extends Error {
  constructor(message = "Não deu para juntar esses chamados. Atualize a página e tente de novo.") {
    super(message);
    this.name = "SupportMergeError";
  }
}

export class SupportDeleteForbiddenError extends Error {
  constructor() {
    super("Só a desenvolvedora apaga chamados.");
    this.name = "SupportDeleteForbiddenError";
  }
}

/** Cupom recusado no checkout (não existe, venceu, esgotou...). A mensagem é a que o cliente vê. */
export class CouponRejectedError extends Error {
  constructor(
    readonly reason: string,
    message: string,
  ) {
    super(message);
    this.name = "CouponRejectedError";
  }
}

export class CouponNotFoundError extends Error {
  constructor() {
    super("Este cupom não existe mais. Ele pode ter sido apagado.");
    this.name = "CouponNotFoundError";
  }
}

export class CountryTakenError extends Error {
  constructor(name: string) {
    super(`O país ${name} já está na lista. Escolha ele na lista.`);
    this.name = "CountryTakenError";
  }
}

export class CouponCodeTakenError extends Error {
  constructor(code: string) {
    super(`Já existe um cupom com o código ${code}. Escolha outro.`);
    this.name = "CouponCodeTakenError";
  }
}

export class StorageForbiddenError extends Error {
  constructor() {
    super("Só o admin e a desenvolvedora veem o armazenamento.");
    this.name = "StorageForbiddenError";
  }
}

export class TooManyDeliveryMessagesError extends Error {
  constructor(limit: number) {
    super(`Dá para guardar até ${limit} mensagens. Apague uma que não usa mais para salvar outra.`);
    this.name = "TooManyDeliveryMessagesError";
  }
}

export class DeliveryMessageNotFoundError extends Error {
  constructor() {
    super("Essa mensagem não existe mais. Pode ter sido apagada em outra aba.");
    this.name = "DeliveryMessageNotFoundError";
  }
}
