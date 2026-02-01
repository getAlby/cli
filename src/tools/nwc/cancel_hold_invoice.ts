import { NWCClient } from "@getalby/sdk";

export interface CancelHoldInvoiceParams {
  payment_hash: string;
}

export interface CancelHoldInvoiceResult {
  payment_hash: string;
}

export async function cancelHoldInvoice(
  client: NWCClient,
  params: CancelHoldInvoiceParams
): Promise<CancelHoldInvoiceResult> {
  await client.cancelHoldInvoice({
    payment_hash: params.payment_hash,
  });

  return {
    payment_hash: params.payment_hash,
  };
}
