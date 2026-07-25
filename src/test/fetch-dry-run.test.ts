import { describe, test, expect, vi, afterEach } from "vitest";
import { dryRun402 } from "../tools/lightning/fetch.js";

// A real 100-sat BOLT-11 invoice (shared with lightning-tools.test.ts) so the
// price extraction exercises actual invoice decoding, not a mock.
const exampleInvoice =
  "lnbc1u1p5hlrr8dqqnp4qwmtpr4p72ms7gnq3pkfk2876y2msvl33s3840dlp6xsv2w59dpscpp55utq6s8u5407namwt4jvhgsaf9fyszppjfwyxp7qsw6cyc8vxukqsp583usez9yhmkcavvvjz8cq56v3nglh2q37xkf4ufrgwxfrfjkm54s9qyysgqcqzp2xqyz5vqgtyysw64zt9sj6kfpqnekzwc37y2uyg0xdapgxqqth4uahff0x89sjfsvukjlllasg5dn05u2uha6qcvxz2y3ye5k7958qtes4pv4ggqtnjyky";

function stub402(headers: Record<string, string>, body = "payment required") {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(body, { status: 402, headers })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetch --dry-run price preview", () => {
  test("reports the sats price from an L402 challenge without paying", async () => {
    stub402({
      "www-authenticate": `L402 token="abc", invoice="${exampleInvoice}"`,
    });

    const result = await dryRun402({ url: "https://l402.example/api" });

    expect(result.payment_required).toBe(true);
    expect(result.amount_in_sats).toBe(100);
  });

  test("reports the sats price from an MPP Payment challenge", async () => {
    stub402({
      "www-authenticate": `Payment realm="svc", method="lightning", intent="charge", invoice="${exampleInvoice}", amount="100", currency="sat"`,
    });

    const result = await dryRun402({ url: "https://mpp.example/api" });

    expect(result.payment_required).toBe(true);
    expect(result.amount_in_sats).toBe(100);
  });

  test("finds the invoice inside a base64 x402 Payment-Required header", async () => {
    const x402Challenge = Buffer.from(
      JSON.stringify({
        x402Version: 2,
        accepts: [
          {
            network: "bip122:000000000019d6689c085ae165831e93",
            asset: "BTC",
            extra: { paymentMethod: "lightning", invoice: exampleInvoice },
          },
        ],
      }),
    ).toString("base64");
    stub402({ "payment-required": x402Challenge });

    const result = await dryRun402({ url: "https://x402ln.example/api" });

    expect(result.payment_required).toBe(true);
    expect(result.amount_in_sats).toBe(100);
  });

  test("suggests the l402.space bridge when no lightning invoice is offered", async () => {
    stub402({
      "www-authenticate": 'Payment realm="svc", method="tempo", intent="charge"',
    });

    const result = await dryRun402({ url: "https://tempo.example/api" });

    expect(result.payment_required).toBe(true);
    expect(result.amount_in_sats).toBeUndefined();
    expect(result.message).toContain("no lightning invoice found");
    expect(result.message).toContain(
      "https://l402.space/https%3A%2F%2Ftempo.example%2Fapi",
    );
  });

  test("falls back to the bridge suggestion when the invoice doesn't decode", async () => {
    stub402({
      "www-authenticate": 'L402 token="abc", invoice="lnbc1notarealinvoice00"',
    });

    const result = await dryRun402({ url: "https://broken.example/api" });

    expect(result.payment_required).toBe(true);
    expect(result.amount_in_sats).toBeUndefined();
    expect(result.message).toContain("no lightning invoice found");
  });

  test("reports payment_required false for a non-402 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("free content", { status: 200 })),
    );

    const result = await dryRun402({ url: "https://free.example/api" });

    expect(result.payment_required).toBe(false);
    expect(result.status).toBe(200);
    // A 2xx dry run is about the price, not the content.
    expect(result.content).toBeUndefined();
  });

  test("surfaces the error body of a non-2xx response", async () => {
    const body = JSON.stringify({
      error: "No payable option",
      reason: "upstream price exceeds this gateway's per-request cap",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 502 })),
    );

    const result = await dryRun402({ url: "https://bridge.example/api" });

    expect(result.payment_required).toBe(false);
    expect(result.status).toBe(502);
    expect(result.content).toBe(body);
    expect(result.content_truncated).toBeUndefined();
  });

  test("truncates an oversized error body and says so", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("x".repeat(5000), { status: 500 })),
    );

    const result = await dryRun402({ url: "https://big.example/api" });

    expect(result.content).toHaveLength(4096);
    expect(result.content_truncated).toBe(true);
  });

  test("omits content for an empty error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );

    const result = await dryRun402({ url: "https://empty.example/api" });

    expect(result.status).toBe(404);
    expect(result.content).toBeUndefined();
  });
});
