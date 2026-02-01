import { LightningAddress } from "@getalby/lightning-tools";

export interface RequestInvoiceFromLightningAddressParams {
  lightning_address: string;
  amount_in_sats: number;
  comment?: string;
  payer_data?: Record<string, unknown>;
}

export interface RequestInvoiceFromLightningAddressResult {
  paymentRequest: string;
  paymentHash: string;
  amount_in_sats: number;
}

export async function requestInvoiceFromLightningAddress(
  params: RequestInvoiceFromLightningAddressParams
): Promise<RequestInvoiceFromLightningAddressResult> {
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
