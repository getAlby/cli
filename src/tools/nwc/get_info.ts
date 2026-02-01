import { NWCClient, Nip47GetInfoResponse } from "@getalby/sdk";

export type GetInfoResult = Nip47GetInfoResponse;

export async function getInfo(client: NWCClient): Promise<GetInfoResult> {
  return await client.getInfo();
}
