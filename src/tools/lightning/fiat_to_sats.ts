import { getSatoshiValue } from "@getalby/lightning-tools";

export interface FiatToSatsParams {
  currency: string;
  amount: number;
}

export interface FiatToSatsResult {
  amount_in_sats: number;
}

export async function fiatToSats(
  params: FiatToSatsParams
): Promise<FiatToSatsResult> {
  const satoshi = await getSatoshiValue({
    amount: params.amount,
    currency: params.currency,
  });

  return {
    amount_in_sats: satoshi,
  };
}
