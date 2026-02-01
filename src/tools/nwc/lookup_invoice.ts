import { NWCClient } from "@getalby/sdk";

export interface LookupInvoiceParams {
  payment_hash?: string;
  invoice?: string;
}

export interface LookupInvoiceResult {
  invoice?: string;
  description?: string;
  description_hash?: string;
  preimage?: string;
  payment_hash: string;
  amount_in_sats: number;
  fees_paid_in_sats?: number;
  created_at: number;
  expires_at?: number;
  settled_at?: number;
  type: string;
  metadata?: Record<string, unknown>;
}

export async function lookupInvoice(
  client: NWCClient,
  params: LookupInvoiceParams
): Promise<LookupInvoiceResult> {
  const { amount, fees_paid, ...result } = await client.lookupInvoice({
    invoice: params.invoice,
    payment_hash: params.payment_hash,
  });

  return {
    ...result,
    amount_in_sats: Math.floor(amount / 1000),
    fees_paid_in_sats:
      typeof fees_paid === "number" ? Math.ceil(fees_paid / 1000) : undefined,
  };
}
