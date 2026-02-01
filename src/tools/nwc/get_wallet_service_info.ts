import { NWCClient, Nip47Capability } from "@getalby/sdk";

export interface GetWalletServiceInfoResult {
  capabilities: Nip47Capability[];
  notifications?: string[];
}

export async function getWalletServiceInfo(
  client: NWCClient
): Promise<GetWalletServiceInfoResult> {
  return await client.getWalletServiceInfo();
}
