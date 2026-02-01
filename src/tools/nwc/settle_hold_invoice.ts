import { NWCClient } from "@getalby/sdk";

export interface SettleHoldInvoiceParams {
  preimage: string;
}

export interface SettleHoldInvoiceResult {
  preimage: string;
}

export async function settleHoldInvoice(
  client: NWCClient,
  params: SettleHoldInvoiceParams
): Promise<SettleHoldInvoiceResult> {
  await client.settleHoldInvoice({
    preimage: params.preimage,
  });

  return {
    preimage: params.preimage,
  };
}
