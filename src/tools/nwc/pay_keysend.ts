import { NWCClient } from "@getalby/sdk";

export interface TlvRecord {
  type: number;
  value: string;
}

export interface PayKeysendParams {
  pubkey: string;
  amount_in_sats: number;
  preimage?: string;
  tlv_records?: TlvRecord[];
}

export interface PayKeysendResult {
  preimage: string;
  fees_paid_in_sats?: number;
}

export async function payKeysend(
  client: NWCClient,
  params: PayKeysendParams
): Promise<PayKeysendResult> {
  const { fees_paid, ...result } = await client.payKeysend({
    pubkey: params.pubkey,
    amount: params.amount_in_sats * 1000,
    preimage: params.preimage,
    tlv_records: params.tlv_records,
  });

  return {
    ...result,
    fees_paid_in_sats:
      typeof fees_paid === "number" ? Math.ceil(fees_paid / 1000) : undefined,
  };
}
