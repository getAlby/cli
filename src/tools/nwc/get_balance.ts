import { NWCClient } from "@getalby/sdk";

export interface GetBalanceResult {
  amount_in_sats: number;
}

export async function getBalance(client: NWCClient): Promise<GetBalanceResult> {
  const balance = await client.getBalance();

  return {
    amount_in_sats: Math.floor(balance.balance / 1000),
  };
}
