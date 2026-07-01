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
    // A body is always passed as JSON, so default the Content-Type. The agent
    // isn't required to set the header itself but might do so anyway, so only
    // add our default when it's absent to avoid a duplicate Content-Type.
    const headers = { ...params.headers };
    const hasContentType = Object.keys(headers).some(
      (key) => key.toLowerCase() === "content-type",
    );
    if (!hasContentType) {
      headers["Content-Type"] = "application/json";
    }
    requestOptions.headers = headers;
  } else if (params.headers) {
    requestOptions.headers = params.headers;
  }

  const maxAmountSats = params.maxAmountSats ?? DEFAULT_MAX_AMOUNT_SATS;

  const result = await fetch402Lib(params.url, requestOptions, {
    wallet: client,
    maxAmount: maxAmountSats,
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
