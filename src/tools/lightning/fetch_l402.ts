import { fetchWithL402 } from "@getalby/lightning-tools";
import { NWCClient } from "@getalby/sdk";

export interface FetchL402Params {
  url: string;
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

export async function fetchL402(
  client: NWCClient,
  params: FetchL402Params
) {
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

  const webln = {
    sendPayment: async (invoice: string) => {
      const result = await client.payInvoice({ invoice });
      return { preimage: result.preimage };
    },
  };

  const result = await fetchWithL402(params.url, requestOptions, {
    webln: webln as Parameters<typeof fetchWithL402>[2]["webln"],
  });

  const responseContent = await result.text();
  if (!result.ok) {
    throw new Error(
      `fetch returned non-OK status: ${result.status} ${responseContent}`
    );
  }

  return {
    content: responseContent,
  };
}
