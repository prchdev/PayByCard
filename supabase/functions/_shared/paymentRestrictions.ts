import { createClient } from "npm:@supabase/supabase-js@2.57.4";

export interface PaymentRestrictions {
  allow_self_transfer: boolean;
  allow_credit_card_payment: boolean;
  enable_credit_card_verification: boolean;
  enable_third_party_card_usage: boolean;
}

/**
 * Reads the payment-restriction toggles from master_settings.
 * Returns safe defaults (all false) if the row or columns are absent.
 */
export async function getPaymentRestrictions(
  supabase: ReturnType<typeof createClient>
): Promise<PaymentRestrictions> {
  const { data } = await supabase
    .from("master_settings")
    .select("allow_self_transfer, allow_credit_card_payment, enable_credit_card_verification, enable_third_party_card_usage")
    .limit(1)
    .maybeSingle();

  return {
    allow_self_transfer: data?.allow_self_transfer ?? false,
    allow_credit_card_payment: data?.allow_credit_card_payment ?? false,
    enable_credit_card_verification: data?.enable_credit_card_verification ?? false,
    enable_third_party_card_usage: data?.enable_third_party_card_usage ?? false,
  };
}
