import { fetch402 } from "@getalby/lightning-tools/402";
import { NWCClient } from "@getalby/sdk";

export interface Fetch402Params {
  url: string;
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

export async function fetch402(client: NWCClient, params: Fetch402Params) {
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

  const result = await fetch402(params.url, requestOptions, { wallet: client });

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
