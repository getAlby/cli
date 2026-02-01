import { NWCClient } from "@getalby/sdk";

export interface PayInvoiceParams {
  invoice: string;
  amount_in_sats?: number;
  metadata?: Record<string, unknown>;
}

export interface PayInvoiceResult {
  preimage: string;
  fees_paid_in_sats?: number;
}

export async function payInvoice(
  client: NWCClient,
  params: PayInvoiceParams
): Promise<PayInvoiceResult> {
  const { fees_paid, preimage, ...result } = await client.payInvoice({
    invoice: params.invoice,
    amount: params.amount_in_sats ? params.amount_in_sats * 1000 : undefined,
    metadata: params.metadata,
  });

  return {
    ...result,
    preimage: preimage || "",
    fees_paid_in_sats:
      typeof fees_paid === "number" ? Math.ceil(fees_paid / 1000) : undefined,
  };
}
