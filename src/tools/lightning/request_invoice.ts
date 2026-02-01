import { LightningAddress } from "@getalby/lightning-tools";

export interface RequestInvoiceParams {
  lightning_address: string;
  amount_in_sats: number;
  comment?: string;
  payer_data?: Record<string, unknown>;
}

export interface RequestInvoiceResult {
  paymentRequest: string;
  paymentHash: string;
  amount_in_sats: number;
}

export async function requestInvoice(
  params: RequestInvoiceParams
): Promise<RequestInvoiceResult> {
  const ln = new LightningAddress(params.lightning_address);

  await ln.fetch();

  const { satoshi, ...invoice } = await ln.requestInvoice({
    satoshi: params.amount_in_sats,
    comment: params.comment,
    payerdata: params.payer_data,
  });

  return {
    ...invoice,
    amount_in_sats: satoshi,
  };
}
