import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { PushNotificationService } from "@/application/ports";
import { PUSH_KIND_OPTIONS, type PushDeviceStatus, type PushKind } from "@/domain/push";
import { askPermission, currentSubscription, describeDevice, localPushStatus, PushSetupError, subscribeDevice } from "../browser-push";
import { fail } from "./supabase-repositories";

const PUSH_FUNCTION = "push-send";
const PUSH_KINDS = PUSH_KIND_OPTIONS.map((option) => option.kind) as [PushKind, ...PushKind[]];
const preferencesSchema = z.object({ kinds: z.array(z.enum(PUSH_KINDS)) });
const functionErrorSchema = z.object({ error: z.string() });

/** Aparelhos em push_subscriptions; o envio sai da Edge Function push-send, chamada pelo banco a cada aviso novo. */
export class SupabasePushService implements PushNotificationService {
  constructor(
    private readonly client: SupabaseClient,
    private readonly vapidPublicKey: string,
  ) {}

  async status(): Promise<PushDeviceStatus> {
    const local = localPushStatus();
    if (local !== "maybe-on") return local;
    const subscription = await currentSubscription();
    if (!subscription) return "off";
    // O aparelho pode estar inscrito para outra pessoa que logou nele antes.
    const { data, error } = await this.client.from("push_subscriptions").select("id").eq("endpoint", subscription.endpoint).maybeSingle();
    if (error) fail(error);
    return data ? "on" : "off";
  }

  async enable(): Promise<void> {
    await askPermission();
    const device = await subscribeDevice(this.vapidPublicKey);
    const { error } = await this.client.rpc("save_push_subscription", {
      p_endpoint: device.endpoint,
      p_p256dh: device.p256dh,
      p_auth: device.auth,
      p_device: describeDevice(),
    });
    if (error) fail(error);
  }

  async disable(): Promise<void> {
    const subscription = await currentSubscription();
    if (!subscription) return;
    const { error } = await this.client.rpc("delete_push_subscription", { p_endpoint: subscription.endpoint });
    if (error) fail(error);
    await subscription.unsubscribe();
  }

  async sendTest(): Promise<void> {
    const { error } = await this.client.functions.invoke(PUSH_FUNCTION, { body: { test: true } });
    if (!error) return;
    console.error("Falha no aviso de teste", error);
    if (error instanceof FunctionsHttpError) {
      const parsed = functionErrorSchema.safeParse(await error.context.json().catch(() => null));
      if (parsed.success && parsed.data.error === "no_devices") {
        throw new PushSetupError("Nenhum aparelho seu está com o aviso ligado. Ligue neste aparelho primeiro.");
      }
    }
    throw new PushSetupError("Não foi possível enviar o teste agora. Tente de novo em instantes.");
  }

  async loadPreferences(): Promise<PushKind[] | null> {
    const { data, error } = await this.client.from("push_preferences").select("kinds").maybeSingle();
    if (error) fail(error);
    return data ? preferencesSchema.parse(data).kinds : null;
  }

  async savePreferences(kinds: readonly PushKind[]): Promise<void> {
    const { data: auth } = await this.client.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) throw new PushSetupError("Sua sessão expirou. Entre de novo para salvar.");
    const { error } = await this.client
      .from("push_preferences")
      .upsert({ user_id: userId, kinds: [...kinds], updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) fail(error);
  }
}
