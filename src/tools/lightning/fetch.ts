import {
  Fetch402PaymentError,
  fetch402 as fetch402Lib,
  getInvoiceAmount,
  type PaymentInfo,
  type PaymentCredentials,
  type PendingPayment,
} from "@getalby/lightning-tools/402";
import { NWCClient } from "@getalby/sdk";
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

  let result;
  try {
    result = await fetch402Lib(params.url, requestOptions, {
      wallet: client,
      maxAmount: maxAmountSats,
      credentials: params.credentials,
      resume: params.resume,
    });
  } catch (error) {
    if (isFetch402PaymentError(error)) {
      throw toRecoveryError(error);
    }
    throw error;
  }

  const responseContent = await result.text();
  if (!result.ok) {
    // A non-OK response after a payment must not lose the payment metadata -
    // with the credential the request can be retried without paying the same
    // invoice again.
    throw new DetailedError(
      `fetch returned non-OK status: ${result.status} ${responseContent}`,
      result.payment?.credentials
        ? paidRecoveryDetails(result.payment)
        : undefined,
    );
  }

  return {
    content: responseContent,
    // Payment metadata attached by the 402 helper: whether a payment was made,
    // the amount (amountSat), routing fees (feesPaidMsat, in millisatoshis),
    // and the reusable credential. Pass `credentials` back via --credentials
    // on a follow-up request to authorize it without paying again. Absent when
    // no 402 payment was involved (e.g. an already-open resource).
    payment: result.payment,
  };
}

/**
 * Convert the library's Fetch402PaymentError into a structured CLI error.
 *
 * A payment was attempted but the flow failed before a response was obtained.
 * The CLI deliberately does NOT recover on its own (no wallet polling, no
 * automatic retries) - whether and when to reconcile is the caller's call, and
 * a CLI silently waiting on an in-flight payment would just look hung. Instead
 * the error output carries everything the caller needs to recover without ever
 * paying the same invoice twice.
 */
function toRecoveryError(error: Fetch402PaymentError): DetailedError {
  if (error.paid && error.credentials) {
    // The invoice was paid but the request after it failed (e.g. a network
    // error). The credential is already built - a retry must reuse it. The
    // error doesn't carry the library's PaymentInfo, so rebuild the same shape
    // from what it does carry (routing fees were lost with the response).
    return new DetailedError(
      `payment succeeded but the request failed: ${errorMessage(error.cause ?? error)}`,
      paidRecoveryDetails(
        {
          paid: true,
          amountSat: getInvoiceAmount(error.invoice),
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
function isFetch402PaymentError(
  error: unknown,
): error is Fetch402PaymentError {
  return (
    error instanceof Fetch402PaymentError ||
    (error instanceof Error && error.name === "Fetch402PaymentError")
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
