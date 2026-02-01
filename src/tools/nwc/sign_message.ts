import { NWCClient } from "@getalby/sdk";

export interface SignMessageParams {
  message: string;
}

export async function signMessage(
  client: NWCClient,
  params: SignMessageParams
) {
  const result = await client.signMessage({
    message: params.message,
  });

  return result;
}
