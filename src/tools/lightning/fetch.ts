import {
  Fetch402InterruptedError,
  fetch402 as fetch402Lib,
  type PaymentInfo,
  type PaymentCredentials,
  type PendingPayment,
} from "@getalby/lightning-tools/402";
import { Invoice } from "@getalby/lightning-tools";
import { NWCClient } from "@getalby/sdk";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DetailedError } from "../../utils.js";

const DEFAULT_MAX_AMOUNT_SATS = 5000;

export interface Fetch402Resume {
  pendingPayment: PendingPayment;
  preimage: string;
}

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
  /**
   * Resume a payment that was interrupted before its preimage was known (the
   * `pendingPayment` from a previous fetch error, plus the preimage recovered
   * via lookup-invoice). The request is authorized with the rebuilt credential
   * and NEVER pays again.
   */
  resume?: Fetch402Resume;
  /**
   * File path to save the response body to instead of returning it inline.
   * Binary responses are saved to a temp file even without it; setting it
   * forces a file (and chooses its location) for any response, so a large body
   * never has to round-trip through the JSON output.
   */
  outputPath?: string;
}

export interface Fetch402Result {
  /** The response body, when it is text and no --output path was given. */
  content?: string;
  /** Path the body was saved to (binary responses, or --output). */
  outputPath?: string;
  /** The response Content-Type, reported alongside `outputPath`. */
  contentType?: string | null;
  /** Size of the saved body in bytes, reported alongside `outputPath`. */
  sizeBytes?: number;
  payment?: PaymentInfo;
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

export async function fetch402(
  client: NWCClient,
  params: Fetch402Params,
): Promise<Fetch402Result> {
  const requestOptions = buildRequestOptions(params);
  const maxAmountSats = params.maxAmountSats ?? DEFAULT_MAX_AMOUNT_SATS;

  let result;
  try {
    result = await fetch402Lib(params.url, requestOptions, {
      wallet: client,
      maxAmount: maxAmountSats,
      credentials: params.credentials,
      resume: params.resume,
    });
  } catch (error) {
    if (isFetch402InterruptedError(error)) {
      throw toRecoveryError(error);
    }
    throw error;
  }

  if (!result.ok) {
    // A non-OK response after a payment must not lose the payment metadata -
    // with the credential the request can be retried without paying the same
    // invoice again.
    throw new DetailedError(
      `fetch returned non-OK status: ${result.status} ${await result.text()}`,
      result.payment?.credentials
        ? paidRecoveryDetails(result.payment)
        : undefined,
    );
  }

  const bytes = new Uint8Array(await result.arrayBuffer());
  const contentType = result.headers.get("content-type");
  // Payment metadata attached by the 402 helper: whether a payment was made,
  // the amount (amountSat), routing fees (feesPaidMsat, in millisatoshis),
  // and the reusable credential. Pass `credentials` back via --credentials
  // on a follow-up request to authorize it without paying again. Absent when
  // no 402 payment was involved (e.g. an already-open resource).
  const payment = result.payment;

  if (!params.outputPath) {
    const text = decodeText(contentType, bytes);
    if (text !== null) {
      return { content: text, payment };
    }
  }

  // Reading a binary body as text destroys it (every invalid UTF-8 sequence
  // becomes U+FFFD), so it goes to a file and the output carries the path.
  const outputPath =
    params.outputPath ??
    join(tmpdir(), `alby-cli-fetch-${randomUUID()}${extensionFor(contentType)}`);
  writeFileSync(outputPath, bytes);
  return { outputPath, contentType, sizeBytes: bytes.length, payment };
}

/**
 * Decode the body for inline `content`, or return null when it is binary:
 * a declared text content type is decoded as such, and without one the bytes
 * qualify only when they are strictly valid UTF-8 (e.g. JSON from an API that
 * mislabels or omits the content type).
 */
function decodeText(
  contentType: string | null,
  bytes: Uint8Array,
): string | null {
  const type = contentType?.split(";")[0].trim().toLowerCase() ?? "";
  if (
    type.startsWith("text/") ||
    /[/+](json|xml)$/.test(type) ||
    type === "application/x-www-form-urlencoded"
  ) {
    return new TextDecoder().decode(bytes);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

// Filename extension for a saved binary, from the content type's subtype
// (audio/wav -> .wav, application/epub+zip -> .epub). Unknown types get .bin.
function extensionFor(contentType: string | null): string {
  const subtype = contentType?.split(";")[0].split("/")[1]?.trim().toLowerCase();
  return subtype ? `.${subtype.split("+")[0]}` : ".bin";
}

export interface DryRun402Result {
  url: string;
  status: number;
  payment_required: boolean;
  /** Present when the 402 challenge offers a lightning invoice. */
  amount_in_sats?: number;
  description?: string | null;
  /** Present when the challenge offers no lightning invoice. */
  message?: string;
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
    // The pattern can match invoice-looking garbage; a challenge whose
    // "invoice" doesn't decode offers no usable invoice - fall through.
    try {
      const { satoshi, description } = new Invoice({ pr: invoice });
      return {
        url: params.url,
        status: response.status,
        payment_required: true,
        amount_in_sats: satoshi,
        description,
      } satisfies DryRun402Result;
    } catch {}
  }

  // No lightning invoice offered (e.g. USDC-only x402) - this CLI pays
  // lightning only, so point at the l402.space bridge, which settles the
  // upstream and charges over lightning.
  return {
    url: params.url,
    status: response.status,
    payment_required: true,
    message:
      "no lightning invoice found in the 402 challenge - try fetching " +
      "through the l402.space bridge instead: " +
      `https://l402.space/${encodeURIComponent(params.url)}`,
  } satisfies DryRun402Result;
}

/**
 * Convert the library's Fetch402InterruptedError into a structured CLI error.
 *
 * A payment was attempted but the flow failed before a response was obtained.
 * The CLI deliberately does NOT recover on its own (no wallet polling, no
 * automatic retries) - whether and when to reconcile is the caller's call, and
 * a CLI silently waiting on an in-flight payment would just look hung. Instead
 * the error output carries everything the caller needs to recover without ever
 * paying the same invoice twice.
 */
function toRecoveryError(error: Fetch402InterruptedError): DetailedError {
  if (error.paid && error.credentials) {
    // The invoice was paid but the request after it failed (e.g. a network
    // error). The credential is already built - a retry must reuse it. The
    // error doesn't carry the library's PaymentInfo, so rebuild the same shape
    // from what it does carry.
    return new DetailedError(
      `payment succeeded but the request failed: ${errorMessage(error.cause ?? error)}`,
      paidRecoveryDetails(
        {
          paid: true,
          amountSat: error.amountSat,
          feesPaidMsat: error.feesPaidMsat,
          preimage: error.preimage,
          credentials: error.credentials,
        },
        error.paymentHash,
      ),
    );
  }

  // payInvoice itself failed (e.g. an NWC reply timeout). The payment may
  // still settle after we exit, so retrying now could pay the same invoice
  // twice - surface everything needed to check and resume without re-paying.
  return new DetailedError(
    `payment did not complete: ${errorMessage(error.cause ?? error)}. ` +
      "The payment may still settle - do NOT retry this fetch yet.",
    {
      paymentRecovery: {
        status: "unknown",
        paymentHash: error.paymentHash,
        pendingPayment: error.pendingPayment,
        instructions:
          "The payment may still be in flight; retrying this fetch now could " +
          "pay twice. First run: lookup-invoice --payment-hash " +
          `${error.paymentHash} - if it returns a preimage, the payment ` +
          "settled: re-run the same fetch adding: --resume " +
          `'{"pendingPayment":<pendingPayment from this error>,"preimage":"<preimage from lookup-invoice>"}' ` +
          "to get the content without paying again. If it shows state " +
          '"failed", no funds moved and it is safe to re-run the fetch ' +
          "normally. If it is still pending or not found, wait and check again.",
      },
    },
  );
}

function paidRecoveryDetails(payment: PaymentInfo, paymentHash?: string) {
  return {
    paymentRecovery: {
      status: "paid",
      ...(paymentHash ? { paymentHash } : {}),
      payment,
      instructions:
        "The payment already succeeded - do NOT re-run this fetch without " +
        "--credentials, or you will pay again. If the failure looks " +
        "temporary, re-run the same fetch adding: --credentials " +
        `'${JSON.stringify(payment.credentials)}'`,
    },
  };
}

// The error normally arrives via instanceof, but match on `name` too so a
// serialized/re-thrown copy (the class documents this) is still recognized.
function isFetch402InterruptedError(
  error: unknown,
): error is Fetch402InterruptedError {
  return (
    error instanceof Fetch402InterruptedError ||
    (error instanceof Error && error.name === "Fetch402InterruptedError")
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
