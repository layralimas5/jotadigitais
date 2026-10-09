import type { Account } from "@/domain/account";
import { InvalidTransitionError } from "@/domain/errors";
import { canTransition, type Order, type OrderStatus } from "@/domain/order";
import type { Testimonial } from "@/domain/testimonial";
import type {
  AdminAccountRepository,
  AdminOrderRepository,
  AdminSession,
  AdminTestimonialRepository,
  AuthService,
  ImageStorage,
  MediaFolder,
  PreparedImage,
  UploadedImage,
} from "./ports";
import { accountDataSchema, parseOrThrow, signInSchema, testimonialDataSchema } from "./schemas";

export interface AdminDeps {
  auth: AuthService;
  accounts: AdminAccountRepository;
  testimonials: AdminTestimonialRepository;
  orders: AdminOrderRepository;
  images: ImageStorage;
}

export function signIn(deps: AdminDeps, raw: unknown): Promise<AdminSession> {
  const { email, password } = parseOrThrow(signInSchema, raw);
  return deps.auth.signIn(email, password);
}

export function listAllAccounts(deps: AdminDeps): Promise<Account[]> {
  return deps.accounts.listAll();
}

export function findAccount(deps: AdminDeps, id: string): Promise<Account | null> {
  return deps.accounts.findById(id);
}

/** Cria quando `id` é nulo, atualiza quando existe. Revalida tudo aqui, independente do formulário. */
export function saveAccount(deps: AdminDeps, id: string | null, raw: unknown): Promise<Account> {
  const data = parseOrThrow(accountDataSchema, raw);
  return id ? deps.accounts.update(id, data) : deps.accounts.create(data);
}

export function deleteAccount(deps: AdminDeps, id: string): Promise<void> {
  return deps.accounts.remove(id);
}

export function listAllTestimonials(deps: AdminDeps): Promise<Testimonial[]> {
  return deps.testimonials.listAll();
}

export function findTestimonial(deps: AdminDeps, id: string): Promise<Testimonial | null> {
  return deps.testimonials.findById(id);
}

export function saveTestimonial(deps: AdminDeps, id: string | null, raw: unknown): Promise<Testimonial> {
  const data = parseOrThrow(testimonialDataSchema, raw);
  return id ? deps.testimonials.update(id, data) : deps.testimonials.create(data);
}

export function deleteTestimonial(deps: AdminDeps, id: string): Promise<void> {
  return deps.testimonials.remove(id);
}

export async function moveTestimonial(
  deps: AdminDeps,
  current: readonly Testimonial[],
  id: string,
  direction: -1 | 1,
): Promise<void> {
  const ids = current.map((item) => item.id);
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= ids.length) return;
  [ids[from], ids[to]] = [ids[to] as string, ids[from] as string];
  await deps.testimonials.reorder(ids);
}

export function listOrders(deps: AdminDeps): Promise<Order[]> {
  return deps.orders.listAll();
}

export async function changeOrderStatus(deps: AdminDeps, order: Order, status: OrderStatus): Promise<void> {
  if (!canTransition(order.status, status)) throw new InvalidTransitionError();
  await deps.orders.updateStatus(order.code, status);
}

export function uploadImage(deps: AdminDeps, image: PreparedImage, folder: MediaFolder): Promise<UploadedImage> {
  return deps.images.upload(image, folder);
}
