import { fetch402 as fetch402Lib } from "@getalby/lightning-tools/402";
import { NWCClient } from "@getalby/sdk";

export interface Fetch402Params {
  url: string;
  method?: string;
  body?: string;
  headers?: Record<string, string>;
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

  const result = await fetch402Lib(params.url, requestOptions, {
    wallet: client,
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
