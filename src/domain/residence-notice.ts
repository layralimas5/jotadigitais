import { DEFAULT_COUNTRY } from "./country";

interface AccountCountry {
  country: string;
  countryName: string;
}

export interface ResidenceNotices {
  /** Quem mora fora e leva conta do Brasil precisa de proxy com IP do Brasil. */
  abroad: boolean;
  /** Países das contas criadas fora do Brasil: valem para qualquer cliente, inclusive quem mora no Brasil. */
  foreignCountries: string[];
}

/**
 * Cruza onde o cliente mora com o país de cada conta do pedido.
 * Mora no Brasil + conta do Brasil: nenhum aviso. Conta de outro país: sempre o aviso do país dela.
 */
export function residenceNoticesFor(abroad: boolean, accounts: readonly AccountCountry[]): ResidenceNotices {
  const foreignCountries = [...new Set(accounts.filter((account) => account.country !== DEFAULT_COUNTRY).map((account) => account.countryName))];
  const hasBrazilian = accounts.some((account) => account.country === DEFAULT_COUNTRY);
  return { abroad: abroad && hasBrazilian, foreignCountries };
}

/** "Estados Unidos", "Estados Unidos e Portugal", "Chile, Peru e México". */
export function joinCountryNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

export const fillCountry = (text: string, country: string) => text.replaceAll("{pais}", country);
