import { fetchWithMpp } from "@getalby/lightning-tools";
import { NWCClient } from "@getalby/sdk";

export interface FetchMPPParams {
  url: string;
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

export async function fetchMpp(client: NWCClient, params: FetchMPPParams) {
  const requestOptions: RequestInit = {
    method: params.method,
  };

  if (params.method && params.method !== "GET" && params.method !== "HEAD") {
    requestOptions.body = params.body;
    requestOptions.headers = {
      "Content-Type": "application/json",
      ...params.headers,
    };
  } else if (params.headers) {
    requestOptions.headers = params.headers;
  }

  const result = await fetchWithMpp(params.url, requestOptions, { wallet: client });

  const responseContent = await result.text();
  if (!result.ok) {
    throw new Error(
      `fetch returned non-OK status: ${result.status} ${responseContent}`,
    );
  }

  return {
    content: responseContent,
  };
}
