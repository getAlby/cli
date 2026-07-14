import {
  fetch402 as fetch402Lib,
  type PaymentCredentials,
} from "@getalby/lightning-tools/402";
import { Invoice } from "@getalby/lightning-tools";
import { NWCClient } from "@getalby/sdk";

const DEFAULT_MAX_AMOUNT_SATS = 5000;

export interface Fetch402Params {
  url: string;
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  maxAmountSats?: number;
  /**
   * A reusable credential returned by a previous fetch. When provided the
   * request is authorized with it and NEVER pays again - use it to authorize
   * follow-up requests (e.g. polling a long-running job) without re-paying.
   */
  credentials?: PaymentCredentials;
}

function buildRequestOptions(params: Fetch402Params): RequestInit {
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

  return requestOptions;
}

export async function fetch402(client: NWCClient, params: Fetch402Params) {
  const requestOptions = buildRequestOptions(params);
  const maxAmountSats = params.maxAmountSats ?? DEFAULT_MAX_AMOUNT_SATS;

  const result = await fetch402Lib(params.url, requestOptions, {
    wallet: client,
    maxAmount: maxAmountSats,
    credentials: params.credentials,
  });

  const responseContent = await result.text();
  if (!result.ok) {
    throw new Error(
      `fetch returned non-OK status: ${result.status} ${responseContent}`,
    );
  }

  return {
    content: responseContent,
    // Payment metadata attached by the 402 helper: whether a payment was made,
    // the amount, routing fees (feesPaid, in millisatoshis), and the reusable
    // credential. Pass `credentials` back via --credentials on a follow-up
    // request to authorize it without paying again. Absent when no 402 payment
    // was involved (e.g. an already-open resource).
    payment: result.payment,
  };
}

export interface DryRun402Result {
  url: string;
  status: number;
  payment_required: boolean;
  /** Present when the 402 challenge offers a lightning invoice. */
  amount_in_sats?: number;
  description?: string | null;
  /** The raw challenge, for protocols/rails we can't price in sats. */
  challenge?: string;
}

const BOLT11_PATTERN = /ln(?:bc|tb|bcrt|tbs)[0-9a-z]+/i;

// Find the lightning invoice a 402 challenge offers, wherever the protocol
// puts it: L402 and MPP carry it in WWW-Authenticate (invoice="lnbc...");
// lightning-native x402 embeds it in the base64 Payment-Required header (or
// the JSON body) as extra.invoice.
function extractLightningInvoice(
  response: Response,
  bodyText: string,
): string | null {
  const wwwAuthenticate = response.headers.get("www-authenticate") ?? "";
  const headerMatch = wwwAuthenticate.match(
    new RegExp(`invoice="(${BOLT11_PATTERN.source})"`, "i"),
  );
  if (headerMatch) return headerMatch[1];

  const paymentRequired = response.headers.get("payment-required");
  if (paymentRequired) {
    try {
      const decoded = Buffer.from(paymentRequired, "base64").toString("utf-8");
      const match = decoded.match(BOLT11_PATTERN);
      if (match) return match[0];
    } catch {
      // Not base64 - fall through to the body.
    }
  }

  return bodyText.match(BOLT11_PATTERN)?.[0] ?? null;
}

/**
 * Preview what a paid endpoint costs without paying: send the request unpaid
 * and report the 402 challenge. Prices on 402index.io can be missing, stale,
 * or dynamic - the challenge is the authoritative price at request time. Needs
 * no wallet.
 */
export async function dryRun402(params: Fetch402Params) {
  const response = await fetch(params.url, buildRequestOptions(params));
  const bodyText = await response.text();

  if (response.status !== 402) {
    return {
      url: params.url,
      status: response.status,
      payment_required: false,
    } satisfies DryRun402Result;
  }

  const invoice = extractLightningInvoice(response, bodyText);
  if (invoice) {
    const { satoshi, description } = new Invoice({ pr: invoice });
    return {
      url: params.url,
      status: response.status,
      payment_required: true,
      amount_in_sats: satoshi,
      description,
    } satisfies DryRun402Result;
  }

  // No lightning invoice offered (e.g. USDC-only x402 hit directly instead of
  // through the l402.space bridge) - surface the raw challenge so the caller
  // can still see the terms.
  return {
    url: params.url,
    status: response.status,
    payment_required: true,
    challenge:
      response.headers.get("www-authenticate") ??
      response.headers.get("payment-required") ??
      bodyText.slice(0, 2000),
  } satisfies DryRun402Result;
}
