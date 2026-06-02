import { describe, test, expect, beforeAll } from "vitest";
import { createTestWallet, runCli, TestWallet } from "./helpers.js";
import type { FiatToSatsResult } from "../tools/lightning/fiat_to_sats.js";
import type { SatsToFiatResult } from "../tools/lightning/sats_to_fiat.js";
import type { ParseInvoiceResult } from "../tools/lightning/parse_invoice.js";
import type { VerifyPreimageResult } from "../tools/lightning/verify_preimage.js";
import type { RequestInvoiceFromLightningAddressResult } from "../tools/lightning/request_invoice_from_lightning_address.js";
import type { MakeInvoiceResult } from "../tools/nwc/make_invoice.js";

const exampleInvoice =
  "lnbc1u1p5hlrr8dqqnp4qwmtpr4p72ms7gnq3pkfk2876y2msvl33s3840dlp6xsv2w59dpscpp55utq6s8u5407namwt4jvhgsaf9fyszppjfwyxp7qsw6cyc8vxukqsp583usez9yhmkcavvvjz8cq56v3nglh2q37xkf4ufrgwxfrfjkm54s9qyysgqcqzp2xqyz5vqgtyysw64zt9sj6kfpqnekzwc37y2uyg0xdapgxqqth4uahff0x89sjfsvukjlllasg5dn05u2uha6qcvxz2y3ye5k7958qtes4pv4ggqtnjyky";

const exampleLightningAddress = "nwc1779952113427@getalby.com";

interface ErrorOutput {
  error: string;
}

describe("Lightning Tools (no wallet required)", () => {
  test("fiat-to-sats converts USD to sats", () => {
    const result = runCli<FiatToSatsResult>(
      "fiat-to-sats --amount 1 --currency USD",
    );
    expect(result.success).toBe(true);
    expect(result.output.amount_in_sats).toBeTypeOf("number");
    expect(result.output.amount_in_sats).toBeGreaterThan(0);
  });

  test("fiat-to-sats accepts a decimal --amount", () => {
    const result = runCli<FiatToSatsResult>(
      "fiat-to-sats --amount 10.5 --currency USD",
    );
    expect(result.success).toBe(true);
    expect(result.output.amount_in_sats).toBeGreaterThan(0);
  });

  // --amount is parsed by the shared strict parser (parseAmountNumber), so
  // partial/invalid input is rejected rather than silently truncated (e.g.
  // "10abc" → 10), as are non-positive values.
  test.each(["10abc", "abc", "0", "-5"])(
    "fiat-to-sats rejects invalid --amount %s",
    (value) => {
      const result = runCli<ErrorOutput>(
        `fiat-to-sats --amount ${value} --currency USD`,
      );
      expect(result.success).toBe(false);
      expect(result.output.error).toContain("Amount must be a positive number");
    },
  );

  test("sats-to-fiat converts sats to USD", () => {
    const result = runCli<SatsToFiatResult>(
      "sats-to-fiat --amount 1000 --unit sats --currency USD",
    );
    expect(result.success).toBe(true);
    expect(result.output.amount).toBeTypeOf("number");
    expect(result.output.amount).toBeGreaterThan(0);
  });

  test("parse-invoice parses a BOLT-11 invoice", () => {
    const result = runCli<ParseInvoiceResult>(
      `parse-invoice -i "${exampleInvoice}"`,
    );
    expect(result.success).toBe(true);
    expect(result.output.paymentHash).toBeDefined();
    expect(result.output.amount_in_sats).toBe(100);
  });

  test("verify-preimage returns false for invalid preimage", () => {
    // Use a fake preimage (32 bytes of zeros)
    const fakePreimage =
      "0000000000000000000000000000000000000000000000000000000000000000";
    const result = runCli<VerifyPreimageResult>(
      `verify-preimage -i "${exampleInvoice}" --preimage "${fakePreimage}"`,
    );
    expect(result.success).toBe(true);
    expect(result.output.valid).toBe(false);
  });

  test("request-invoice-from-lightning-address requests invoice from lightning address", async () => {
    const result = runCli<RequestInvoiceFromLightningAddressResult>(
      `request-invoice-from-lightning-address -a "${exampleLightningAddress}" --amount 100 --currency BTC --unit sats --network lightning`,
    );
    expect(result.success).toBe(true);
    expect(result.output.paymentRequest.toLowerCase()).toMatch(/^lnbc/);
  });
});
