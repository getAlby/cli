import { fetch402 as fetch402Lib } from "@getalby/lightning-tools/402";
import { NWCClient } from "@getalby/sdk";

const DEFAULT_MAX_AMOUNT_SATS = 5000;

// Non-lightning paid endpoints (e.g. USDC-only x402) can't be settled from a
// lightning wallet directly, so lightning-tools hands their 402 back unpaid.
// The l402.space bridge re-wraps any 402-gated upstream as an L402 (lightning)
// challenge and settles the upstream cost on our behalf - we transparently
// retry through it so callers only ever need a lightning balance. Native L402
// (and lightning-payable x402/MPP) is paid directly and never touches the
// bridge.
const L402_SPACE_BRIDGE = "https://l402.space/";

function bridgeUrl(url: string): string {
  return `${L402_SPACE_BRIDGE}${encodeURIComponent(url)}`;
}

export interface Fetch402Params {
  url: string;
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  maxAmountSats?: number;
}

export async function fetch402(client: NWCClient, params: Fetch402Params) {
  const method = params.method?.toUpperCase();

  // fetch402Lib mutates the RequestInit it's given (headers, cache, mode), so
  // build a fresh one per attempt to keep the bridge retry clean.
  const buildRequestOptions = (): RequestInit => {
    const requestOptions: RequestInit = { method };
    if (method && method !== "GET" && method !== "HEAD") {
      requestOptions.body = params.body;
      requestOptions.headers = {
        "Content-Type": "application/json",
        ...params.headers,
      };
    } else if (params.headers) {
      requestOptions.headers = params.headers;
    }
    return requestOptions;
  };

  const maxAmountSats = params.maxAmountSats ?? DEFAULT_MAX_AMOUNT_SATS;

  let result = await fetch402Lib(params.url, buildRequestOptions(), {
    wallet: client,
    maxAmount: maxAmountSats,
  });

  // A 402 here means lightning-tools couldn't satisfy the challenge over
  // lightning and handed the response back. Retry once through the l402.space
  // bridge, which converts it to an L402 lightning challenge we can pay.
  if (result.status === 402 && !params.url.startsWith(L402_SPACE_BRIDGE)) {
    result = await fetch402Lib(bridgeUrl(params.url), buildRequestOptions(), {
      wallet: client,
      maxAmount: maxAmountSats,
    });
  }

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
