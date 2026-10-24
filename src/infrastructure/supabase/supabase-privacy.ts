import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { AdminPrivacyRepository, PrivacyService } from "@/application/ports";
import { BRAZIL_STATES } from "@/domain/customer";
import { LEAD_SOURCES } from "@/domain/lead";
import { LEGAL_DOCUMENT_SLUGS } from "@/domain/legal/legal-document";
import { PLATFORMS } from "@/domain/platform";
import {
  DATA_REQUEST_KINDS,
  type AnonymizationResult,
  type DataRequest,
  type DataRequestAnswer,
  type DataRequestKind,
  type OpenedDataRequest,
  type RetentionResult,
  type SubjectData,
} from "@/domain/privacy";
import { toOrder } from "./rows";
import { fail, failFromRpc } from "./supabase-repositories";

const timestamp = z.string().transform((value) => new Date(value).toISOString());
const optionalTimestamp = z.string().nullable().transform((value) => (value ? new Date(value).toISOString() : null));
const status = z.enum(["open", "done", "rejected"]);

const ownRequestSchema = z.object({
  protocol: z.string(),
  kind: z.enum(DATA_REQUEST_KINDS),
  status,
  details: z.string().nullable(),
  response: z.string().nullable(),
  created_at: timestamp,
  due_at: timestamp,
  resolved_at: optionalTimestamp,
});

const subjectSchema = z.object({
  email: z.string(),
  generated_at: timestamp,
  orders: z.array(z.unknown()),
  customers: z.array(
    z.object({
      name: z.string(),
      document: z.string().nullable(),
      birth_date: z.string().nullable(),
      email: z.string().nullable(),
      whatsapp: z.string().nullable(),
      instagram: z.string().nullable(),
      city: z.string().nullable(),
      state: z.enum(BRAZIL_STATES).nullable(),
      source: z.enum(LEAD_SOURCES).nullable(),
      // Meus dados ainda não devolve quem indicou: o nome é de outra pessoa, não do titular.
      referred_by: z.string().nullish(),
      interest: z.enum(PLATFORMS).nullable(),
      notes: z.string().nullable(),
      created_at: timestamp,
    }),
  ),
  consents: z.array(
    z.object({
      order_code: z.string(),
      document_slug: z.enum(LEGAL_DOCUMENT_SLUGS),
      document_version: z.string(),
      document_sha256: z.string(),
      accepted_at: timestamp,
      ip_address: z.string().nullable(),
      user_agent: z.string().nullable(),
    }),
  ),
  requests: z.array(ownRequestSchema),
});

function toSubjectData(raw: unknown): SubjectData {
  const row = subjectSchema.parse(raw);
  return {
    email: row.email,
    generatedAt: row.generated_at,
    orders: row.orders.map(toOrder),
    customers: row.customers.map((customer) => ({
      name: customer.name,
      document: customer.document,
      birthDate: customer.birth_date,
      email: customer.email,
      whatsapp: customer.whatsapp,
      instagram: customer.instagram,
      city: customer.city,
      state: customer.state,
      source: customer.source,
      referredBy: customer.referred_by ?? null,
      interest: customer.interest,
      notes: customer.notes,
      createdAt: customer.created_at,
    })),
    consents: row.consents.map((consent) => ({
      orderCode: consent.order_code,
      slug: consent.document_slug,
      version: consent.document_version,
      sha256: consent.document_sha256,
      acceptedAt: consent.accepted_at,
      ipAddress: consent.ip_address,
      userAgent: consent.user_agent,
    })),
    requests: row.requests.map((request) => ({
      protocol: request.protocol,
      kind: request.kind,
      status: request.status,
      details: request.details,
      response: request.response,
      createdAt: request.created_at,
      dueAt: request.due_at,
      resolvedAt: request.resolved_at,
    })),
  };
}

const openedSchema = z.object({ protocol: z.string(), due_at: timestamp });

/** Meus dados pelas funções `privacy_lookup` e `privacy_request`, que conferem e-mail e código no banco. */
export class SupabasePrivacyService implements PrivacyService {
  constructor(private readonly client: SupabaseClient) {}

  async lookup(email: string, orderCode: string): Promise<SubjectData | null> {
    const { data, error } = await this.client.rpc("privacy_lookup", { p_email: email, p_code: orderCode });
    if (error) failFromRpc(error);
    return data ? toSubjectData(data) : null;
  }

  async request(email: string, orderCode: string, kind: DataRequestKind, details: string | null): Promise<OpenedDataRequest | null> {
    const { data, error } = await this.client.rpc("privacy_request", {
      p_email: email,
      p_code: orderCode,
      p_kind: kind,
      p_details: details,
    });
    if (error) failFromRpc(error);
    if (!data) return null;
    const opened = openedSchema.parse(data);
    return { protocol: opened.protocol, dueAt: opened.due_at };
  }
}

const REQUEST_COLUMNS = "id, protocol, kind, email, order_code, details, status, response, created_at, due_at, resolved_at";

const requestRowSchema = ownRequestSchema.extend({ id: z.string(), email: z.string(), order_code: z.string().nullable() });

function toDataRequest(raw: unknown): DataRequest {
  const row = requestRowSchema.parse(raw);
  return {
    id: row.id,
    protocol: row.protocol,
    kind: row.kind,
    email: row.email,
    orderCode: row.order_code,
    details: row.details,
    status: row.status,
    response: row.response,
    createdAt: row.created_at,
    dueAt: row.due_at,
    resolvedAt: row.resolved_at,
  };
}

const anonymizationSchema = z.object({ anonymized_orders: z.number(), kept_orders: z.number(), deleted_customers: z.number() });

const retentionSchema = z.object({
  anonymized_orders: z.number(),
  deleted_leads: z.number(),
  deleted_notifications: z.number(),
  deleted_requests: z.number(),
  deleted_attempts: z.number(),
});

export class SupabasePrivacyRepository implements AdminPrivacyRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listRequests(): Promise<DataRequest[]> {
    const { data, error } = await this.client.from("data_requests").select(REQUEST_COLUMNS).order("created_at", { ascending: false });
    if (error) fail(error);
    return data.map(toDataRequest);
  }

  async answer(id: string, answer: DataRequestAnswer): Promise<void> {
    const { error } = await this.client.from("data_requests").update({ status: answer.status, response: answer.response }).eq("id", id);
    if (error) fail(error);
  }

  async anonymizeSubject(email: string): Promise<AnonymizationResult> {
    const { data, error } = await this.client.rpc("anonymize_data_subject", { p_email: email });
    if (error) fail(error);
    const result = anonymizationSchema.parse(data);
    return { anonymizedOrders: result.anonymized_orders, keptOrders: result.kept_orders, deletedCustomers: result.deleted_customers };
  }

  async applyRetention(): Promise<RetentionResult> {
    const { data, error } = await this.client.rpc("apply_retention_policy");
    if (error) fail(error);
    const result = retentionSchema.parse(data);
    return {
      anonymizedOrders: result.anonymized_orders,
      deletedLeads: result.deleted_leads,
      deletedNotifications: result.deleted_notifications,
      deletedRequests: result.deleted_requests,
      deletedAttempts: result.deleted_attempts,
    };
  }
}
