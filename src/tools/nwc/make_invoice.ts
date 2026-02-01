import { NWCClient } from "@getalby/sdk";

export interface MakeInvoiceParams {
  amount_in_sats: number;
  description?: string;
  description_hash?: string;
  expiry?: number;
  metadata?: Record<string, unknown>;
}

export interface MakeInvoiceResult {
  invoice: string;
  payment_hash: string;
  amount_in_sats: number;
  fees_paid_in_sats?: number;
  created_at: number;
  expires_at?: number;
  metadata?: Record<string, unknown>;
}

export async function makeInvoice(
  client: NWCClient,
  params: MakeInvoiceParams
): Promise<MakeInvoiceResult> {
  const { amount, fees_paid, ...result } = await client.makeInvoice({
    amount: params.amount_in_sats * 1000,
    description: params.description,
    description_hash: params.description_hash,
    expiry: params.expiry,
    metadata: params.metadata,
  });

  return {
    ...result,
    amount_in_sats: Math.floor(amount / 1000),
    fees_paid_in_sats:
      typeof fees_paid === "number" ? Math.ceil(fees_paid / 1000) : undefined,
  };
}
