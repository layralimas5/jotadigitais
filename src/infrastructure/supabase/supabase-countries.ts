import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { AdminCountryRepository } from "@/application/ports";
import { countryCodeFrom, type Country } from "@/domain/country";
import { CountryTakenError } from "@/domain/errors";
import { fail } from "./supabase-repositories";

const UNIQUE_VIOLATION = "23505";

const countrySchema = z.object({ code: z.string(), name: z.string() });

/** Tabela `countries`: a vitrine lê (filtro); o painel com acesso a Contas também cria. */
export class SupabaseCountryRepository implements AdminCountryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(): Promise<Country[]> {
    const { data, error } = await this.client.from("countries").select("code, name");
    if (error) fail(error);
    return z.array(countrySchema).parse(data);
  }

  async create(name: string): Promise<Country> {
    const { data, error } = await this.client
      .from("countries")
      .insert({ code: countryCodeFrom(name), name })
      .select("code, name")
      .single();
    if (error?.code === UNIQUE_VIOLATION) throw new CountryTakenError(name);
    if (error) fail(error);
    return countrySchema.parse(data);
  }
}
