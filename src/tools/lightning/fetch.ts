import { fetch402 as fetch402Lib } from "@getalby/lightning-tools/402";
import { NWCClient } from "@getalby/sdk";

const DEFAULT_MAX_AMOUNT_SATS = 5000;

export interface Fetch402Params {
  url: string;
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  maxAmountSats?: number;
}

export async function fetch402(client: NWCClient, params: Fetch402Params) {
  const method = params.method?.toUpperCase();
  const requestOptions: RequestInit = {
    method,
  };

  if (method && method !== "GET" && method !== "HEAD") {
    requestOptions.body = params.body;
    requestOptions.headers = {
      "Content-Type": "application/json",
      ...params.headers,
    };
  } else if (params.headers) {
    requestOptions.headers = params.headers;
  }

  const maxAmountSats = params.maxAmountSats ?? DEFAULT_MAX_AMOUNT_SATS;

  const result = await fetch402Lib(params.url, requestOptions, {
    wallet: client,
    maxAmount: maxAmountSats || undefined,
  });

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
