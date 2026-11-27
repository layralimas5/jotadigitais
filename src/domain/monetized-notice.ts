import { shopTierOf, type Account } from "./account";

/**
 * Contas de TikTok monetizadas e sem TikTok Shop: o cliente confunde com conta de Shop,
 * então o checkout pede uma confirmação antes de registrar o pedido.
 */
export function monetizedWithoutShop(accounts: readonly Account[]): Account[] {
  return accounts.filter(
    (account) => account.platform === "tiktok" && account.stats.monetized && shopTierOf(account) === "none",
  );
}
