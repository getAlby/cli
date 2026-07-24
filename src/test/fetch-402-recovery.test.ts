import { describe, test, expect, vi, afterEach } from "vitest";
import { getPaymentHash } from "@getalby/lightning-tools/402";
import { NWCClient } from "@getalby/sdk";
import { fetch402 } from "../tools/lightning/fetch.js";
import { DetailedError } from "../utils.js";

// Real, decodable invoice + macaroon (from the js-lightning-tools test suite)
// so the library can derive the payment hash surfaced for reconciliation.
const MACAROON =
  "AgEEbHNhdAJCAAAClGOZrh7C569Yc7UMk8merfnMdIviyXr1qscW7VgpChNl21LkZ8Jex5QiPp+E1VaabeJDuWmlrh/j583axFpNAAIXc2VydmljZXM9cmFuZG9tbnVtYmVyOjAAAiZyYW5kb21udW1iZXJfY2FwYWJpbGl0aZVzPWFkZCxzdWJ0cmFjdAAABiAvFpzXGyc+8d/I9nMKKvAYP8w7kUlhuxS0eFN2sqmqHQ==";
const INVOICE =
  "lnbc4020n1p5m6028dq80q6rqvsnp4qt5w34u6kntf5lc50jj27rvs89sgrpcpj7s6vfts042gkhxx2j6swpp5g6tquvmswkv5xf0ru7ju2qvdrf83l2ewha3qzzt0a7vurs5q30rssp54kt5hfzjngjersx8fgt60feuu8e7vnat67f3ksr98twdj7z0m0ls9qyysgqcqzp2xqyz5vqrzjqdc22wfv6lyplagj37n9dmndkrzdz8rh3lxkewvvk6arkjpefats2rf47yqqwysqqcqqqqlgqqqqqqgqfqrzjq26922n6s5n5undqrf78rjjhgpcczafws45tx8237y7pzx3fg8ww8apyqqqqqqqqjyqqqqlgqqqqr4gq2q3z5pu33awfm98ac3ysdhy046xmen4zqval67tccu35x9mxgvl6w3wmq6y03ae7pme6qr20mp5gvuqntnu8yy7nlf6gyt9zshanj2zhgqe4xde3";
const PREIMAGE =
  "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
const PAYMENT_HASH = getPaymentHash(INVOICE);

const URL = "https://example.com/protected";

function l402Response() {
  return new Response("Payment Required", {
    status: 402,
    headers: {
      "www-authenticate": `L402 macaroon="${MACAROON}", invoice="${INVOICE}"`,
    },
  });
}

function makeClient(overrides: Record<string, unknown> = {}): NWCClient {
  return {
    payInvoice: vi
      .fn()
      .mockResolvedValue({ preimage: PREIMAGE, fees_paid: 3000 }),
    ...overrides,
  } as unknown as NWCClient;
}

function authorizationHeader(fetchMock: ReturnType<typeof vi.fn>, call: number) {
  const init = fetchMock.mock.calls[call][1] as RequestInit;
  return (init.headers as Headers).get("Authorization");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetch 402 payment recovery", () => {
  test("surfaces recovery info when payInvoice fails (e.g. a reply timeout)", async () => {
    // The payment may still settle after the timeout, so the CLI must not
    // retry, poll, or guess - it exits with everything needed to reconcile.
    const client = makeClient({
      payInvoice: vi.fn().mockRejectedValue(new Error("reply timeout")),
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(l402Response());
    vi.stubGlobal("fetch", fetchMock);

    const error = await fetch402(client, { url: URL }).catch((e) => e);

    expect(error).toBeInstanceOf(DetailedError);
    expect(error.message).toContain("reply timeout");
    expect(error.message).toContain("do NOT retry");
    expect(error.details?.paymentRecovery).toMatchObject({
      status: "unknown",
      paymentHash: PAYMENT_HASH,
      pendingPayment: {
        scheme: "l402",
        header: "Authorization",
        token: MACAROON,
        authScheme: "L402",
      },
    });
    expect(error.details?.paymentRecovery.instructions).toContain(
      `lookup-invoice --payment-hash ${PAYMENT_HASH}`,
    );
    expect(error.details?.paymentRecovery.instructions).toContain("--resume");
    // No retry happened: one payment attempt, one request.
    expect(client.payInvoice).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("surfaces the credential when the request after payment fails", async () => {
    const client = makeClient();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(l402Response())
      .mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const error = await fetch402(client, { url: URL }).catch((e) => e);

    expect(error).toBeInstanceOf(DetailedError);
    expect(error.message).toContain("payment succeeded");
    expect(error.message).toContain("network down");
    expect(error.details?.paymentRecovery).toMatchObject({
      status: "paid",
      paymentHash: PAYMENT_HASH,
      payment: {
        paid: true,
        amountSat: 402,
        feesPaidMsat: 3000,
        preimage: PREIMAGE,
        credentials: {
          header: "Authorization",
          value: `L402 ${MACAROON}:${PREIMAGE}`,
        },
      },
    });
    expect(error.details?.paymentRecovery.instructions).toContain(
      "--credentials",
    );
    // The CLI itself does not retry - that is the caller's decision.
    expect(client.payInvoice).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("surfaces the credential when the response after payment is non-OK", async () => {
    const client = makeClient();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(l402Response())
      .mockResolvedValueOnce(new Response("temporary outage", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const error = await fetch402(client, { url: URL }).catch((e) => e);

    expect(error).toBeInstanceOf(DetailedError);
    expect(error.message).toContain("non-OK status: 503");
    // The library's full payment metadata is surfaced, not just the credential.
    expect(error.details?.paymentRecovery).toMatchObject({
      status: "paid",
      payment: {
        paid: true,
        amountSat: 402,
        feesPaidMsat: 3000,
        preimage: PREIMAGE,
        credentials: {
          header: "Authorization",
          value: `L402 ${MACAROON}:${PREIMAGE}`,
        },
      },
    });
  });

  test("non-OK response without a payment carries no recovery details", async () => {
    const client = makeClient();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const error = await fetch402(client, { url: URL }).catch((e) => e);

    expect(error.message).toContain("non-OK status: 404");
    // The error body is surfaced (it is often the only diagnostic), but there
    // is no payment to recover.
    expect(error.details).toEqual({ content: "not found" });
    expect(client.payInvoice).not.toHaveBeenCalled();
  });

  test("resume sends the rebuilt credential without paying", async () => {
    const client = makeClient({
      payInvoice: vi.fn().mockRejectedValue(new Error("should not be called")),
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("paid content", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetch402(client, {
      url: URL,
      resume: {
        pendingPayment: {
          scheme: "l402",
          header: "Authorization",
          token: MACAROON,
          authScheme: "L402",
        },
        preimage: PREIMAGE,
      },
    });

    expect(result.content).toBe("paid content");
    expect(client.payInvoice).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(authorizationHeader(fetchMock, 0)).toBe(
      `L402 ${MACAROON}:${PREIMAGE}`,
    );
    // This request itself did not pay; the payment happened earlier.
    expect(result.payment?.paid).toBe(false);
    expect(result.payment?.preimage).toBe(PREIMAGE);
  });

  test("credentials send the stored credential without paying", async () => {
    const client = makeClient({
      payInvoice: vi.fn().mockRejectedValue(new Error("should not be called")),
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("paid content", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetch402(client, {
      url: URL,
      credentials: {
        header: "Authorization",
        value: `L402 ${MACAROON}:${PREIMAGE}`,
      },
    });

    expect(result.content).toBe("paid content");
    expect(client.payInvoice).not.toHaveBeenCalled();
    expect(authorizationHeader(fetchMock, 0)).toBe(
      `L402 ${MACAROON}:${PREIMAGE}`,
    );
    expect(result.payment?.paid).toBe(false);
  });
});
