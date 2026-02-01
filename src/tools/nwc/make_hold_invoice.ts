import { NWCClient } from "@getalby/sdk";

export interface MakeHoldInvoiceParams {
  amount_in_sats: number;
  payment_hash: string;
  description?: string;
  expiry?: number;
}

export interface MakeHoldInvoiceResult {
  invoice: string;
  payment_hash: string;
  amount_in_sats: number;
  created_at: number;
  expires_at?: number;
}

export async function makeHoldInvoice(
  client: NWCClient,
  params: MakeHoldInvoiceParams
): Promise<MakeHoldInvoiceResult> {
  const { amount, ...result } = await client.makeHoldInvoice({
    amount: params.amount_in_sats * 1000,
    payment_hash: params.payment_hash,
    description: params.description,
    expiry: params.expiry,
  });

  return {
    ...result,
    amount_in_sats: Math.floor(amount / 1000),
  };
}
