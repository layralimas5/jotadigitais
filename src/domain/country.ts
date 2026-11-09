/** País em que a conta foi criada. A lista fica no banco (tabela `countries`) e o painel pode criar novos. */
export interface Country {
  /** ISO nos países que vieram de fábrica (BR, US...); nos criados no painel, o nome sem acento (NOVA-ZELANDIA). */
  code: string;
  name: string;
}

/** Mesma regra da checagem `countries_code` no banco. */
export const COUNTRY_CODE_PATTERN = /^[A-Z0-9-]{2,40}$/;

export const DEFAULT_COUNTRY = "BR";

/** Países que a loja já trazia; o modo demonstração e a migration `account_countries` começam com eles. */
export const SEED_COUNTRIES: readonly Country[] = [
  { code: "BR", name: "Brasil" },
  { code: "US", name: "Estados Unidos" },
  { code: "PT", name: "Portugal" },
  { code: "AR", name: "Argentina" },
  { code: "MX", name: "México" },
  { code: "CO", name: "Colômbia" },
  { code: "CL", name: "Chile" },
  { code: "PE", name: "Peru" },
  { code: "PY", name: "Paraguai" },
  { code: "UY", name: "Uruguai" },
  { code: "ES", name: "Espanha" },
  { code: "GB", name: "Reino Unido" },
  { code: "CA", name: "Canadá" },
  { code: "DE", name: "Alemanha" },
  { code: "FR", name: "França" },
  { code: "IT", name: "Itália" },
  { code: "AU", name: "Austrália" },
  { code: "JP", name: "Japão" },
  { code: "AO", name: "Angola" },
  { code: "MZ", name: "Moçambique" },
];

/** Código do país criado no painel: o nome em maiúsculas, sem acento, com hífen no lugar de espaço. */
export function countryCodeFrom(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const collator = new Intl.Collator("pt-BR");

/** Brasil primeiro (é de onde vem quase todo o estoque); o resto em ordem alfabética. */
export function sortCountries(countries: readonly Country[]): Country[] {
  return [...countries].sort(
    (a, b) => Number(b.code === DEFAULT_COUNTRY) - Number(a.code === DEFAULT_COUNTRY) || collator.compare(a.name, b.name),
  );
}

/** Nome para mostrar quando só se tem o código (conta antiga, país apagado): o da lista de fábrica ou o próprio código. */
export const fallbackCountryName = (code: string): string =>
  SEED_COUNTRIES.find((country) => country.code === code)?.name ?? code;
