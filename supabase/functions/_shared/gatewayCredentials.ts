import { encrypt, decrypt, isEncrypted } from "./crypto.ts";

const ENCRYPTED_FIELDS = [
  "test_api_key",
  "test_api_secret",
  "production_api_key",
  "production_api_secret",
  "secret_key",
  "test_payout_client_id",
  "production_payout_client_id",
  "test_payout_client_secret",
  "production_payout_client_secret",
] as const;

const SECRET_MASK = "••••••••";

export { SECRET_MASK, ENCRYPTED_FIELDS };

export async function getGatewayEncryptionKey(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from("master_settings")
    .select("gateway_encryption_key")
    .limit(1)
    .maybeSingle();
  return data?.gateway_encryption_key || null;
}

export async function decryptGateway(gateway: any, encryptionKey: string | null): Promise<any> {
  if (!gateway || !encryptionKey) return gateway;
  const result = { ...gateway };
  for (const field of ENCRYPTED_FIELDS) {
    if (result[field] && isEncrypted(result[field])) {
      try {
        result[field] = await decrypt(result[field], encryptionKey);
      } catch (e) {
        console.error(`decryptGateway: failed for field ${field}:`, e);
      }
    }
  }
  return result;
}

export async function decryptGateways(gateways: any[], encryptionKey: string | null): Promise<any[]> {
  if (!encryptionKey) return gateways;
  return Promise.all(gateways.map((g) => decryptGateway(g, encryptionKey)));
}

export async function encryptGatewayFields(
  fields: Record<string, any>,
  encryptionKey: string | null,
): Promise<Record<string, any>> {
  if (!encryptionKey) return fields;
  const result = { ...fields };
  for (const field of ENCRYPTED_FIELDS) {
    const val = result[field];
    if (val && typeof val === "string" && !isEncrypted(val)) {
      result[field] = await encrypt(val, encryptionKey);
    }
  }
  return result;
}

export async function getDecryptedGatewayById(
  supabase: any,
  gatewayId: string,
  encryptionKey?: string | null,
): Promise<any | null> {
  const { data: gateway, error } = await supabase
    .from("payment_gateway_settings")
    .select("*")
    .eq("id", gatewayId)
    .maybeSingle();
  if (error || !gateway) return null;
  const key = encryptionKey !== undefined ? encryptionKey : await getGatewayEncryptionKey(supabase);
  return decryptGateway(gateway, key);
}

// ─── Payout Settings encryption helpers ───────────────────────────────────────
const PAYOUT_SECRET_FIELDS = [
  "cashfree_test_client_secret",
  "cashfree_production_client_secret",
  "razorpay_test_key_secret",
  "razorpay_production_key_secret",
  "axis_test_client_secret",
  "axis_production_client_secret",
] as const;

export { PAYOUT_SECRET_FIELDS };

export async function decryptPayoutSettings(
  settings: any,
  encryptionKey: string | null,
): Promise<any> {
  if (!settings || !encryptionKey) return settings;
  const result = { ...settings };
  for (const field of PAYOUT_SECRET_FIELDS) {
    if (result[field] && isEncrypted(result[field])) {
      try {
        result[field] = await decrypt(result[field], encryptionKey);
      } catch (e) {
        console.error(`decryptPayoutSettings: failed for field ${field}:`, e);
      }
    }
  }
  return result;
}

export async function maskPayoutSettings(
  settings: any,
  encryptionKey: string | null,
): Promise<any> {
  const decrypted = await decryptPayoutSettings(settings, encryptionKey);
  const result = { ...decrypted };
  for (const field of PAYOUT_SECRET_FIELDS) {
    if (result[field]) {
      result[field] = SECRET_MASK;
    }
  }
  return result;
}

export async function encryptPayoutSettings(
  incoming: Record<string, any>,
  existing: Record<string, any> | null,
  encryptionKey: string | null,
): Promise<Record<string, any>> {
  if (!encryptionKey) return incoming;
  const result = { ...incoming };
  for (const field of PAYOUT_SECRET_FIELDS) {
    const val = result[field];
    if (val && typeof val === "string" && val !== SECRET_MASK && !isEncrypted(val)) {
      result[field] = await encrypt(val, encryptionKey);
    } else if ((!val || val === SECRET_MASK) && existing?.[field]) {
      result[field] = existing[field];
    }
  }
  return result;
}

export async function reEncryptAllCredentials(
  supabase: any,
  oldKey: string,
  newKey: string,
): Promise<{ gateways: number; payouts: number }> {
  let gatewayCount = 0;
  let payoutCount = 0;

  const { data: gateways } = await supabase
    .from("payment_gateway_settings")
    .select("*");

  for (const gateway of gateways || []) {
    const update: Record<string, string> = {};
    let hasChanges = false;
    for (const field of ENCRYPTED_FIELDS) {
      const val = gateway[field];
      if (val && typeof val === "string") {
        if (isEncrypted(val)) {
          try {
            const decrypted = await decrypt(val, oldKey);
            update[field] = await encrypt(decrypted, newKey);
            hasChanges = true;
          } catch (e) {
            console.error(`reEncrypt gateway ${gateway.id} field ${field}:`, e);
          }
        } else {
          update[field] = await encrypt(val, newKey);
          hasChanges = true;
        }
      }
    }
    if (hasChanges) {
      const { error } = await supabase
        .from("payment_gateway_settings")
        .update(update)
        .eq("id", gateway.id);
      if (!error) gatewayCount++;
    }
  }

  const { data: payoutSettings } = await supabase
    .from("payout_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (payoutSettings) {
    const payoutUpdate: Record<string, string> = {};
    let payoutHasChanges = false;
    for (const field of PAYOUT_SECRET_FIELDS) {
      const val = payoutSettings[field];
      if (val && typeof val === "string") {
        if (isEncrypted(val)) {
          try {
            const decrypted = await decrypt(val, oldKey);
            payoutUpdate[field] = await encrypt(decrypted, newKey);
            payoutHasChanges = true;
          } catch (e) {
            console.error(`reEncrypt payout field ${field}:`, e);
          }
        } else {
          payoutUpdate[field] = await encrypt(val, newKey);
          payoutHasChanges = true;
        }
      }
    }
    if (payoutHasChanges) {
      const { error } = await supabase
        .from("payout_settings")
        .update(payoutUpdate)
        .eq("id", payoutSettings.id);
      if (!error) payoutCount = 1;
    }
  }

  return { gateways: gatewayCount, payouts: payoutCount };
}
