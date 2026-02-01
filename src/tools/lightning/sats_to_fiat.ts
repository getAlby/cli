import { getFiatValue } from "@getalby/lightning-tools";

export interface SatsToFiatParams {
  amount_in_sats: number;
  currency: string;
}

export interface SatsToFiatResult {
  amount: number;
  currency: string;
}

export async function satsToFiat(
  params: SatsToFiatParams
): Promise<SatsToFiatResult> {
  const fiat = await getFiatValue({
    satoshi: params.amount_in_sats,
    currency: params.currency,
  });

  return {
    amount: fiat,
    currency: params.currency,
  };
}
