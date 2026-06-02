import { describe, test, expect, beforeAll } from "vitest";
import { createTestWallet, runCli, TestWallet } from "./helpers.js";
import type { MakeInvoiceResult } from "../tools/nwc/make_invoice.js";

interface ErrorOutput {
  error: string;
}

interface LightningAddressResult {
  lightning_address: string;
}

describe("receive command — validation", () => {
  test("--description without --amount-sats is rejected", () => {
    const result = runCli<ErrorOutput>(`receive --description "hi"`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain(
      "--description requires --amount-sats",
    );
  });

  test("--amount-sats 0 is rejected", () => {
    const result = runCli<ErrorOutput>(`receive --amount-sats 0`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("Invalid --amount-sats");
  });

  test("--amount-sats abc (NaN) is rejected", () => {
    const result = runCli<ErrorOutput>(`receive --amount-sats abc`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("Invalid --amount-sats");
  });
});

describe("receive command — live integration", () => {
  let wallet: TestWallet;

  beforeAll(async () => {
    wallet = await createTestWallet();
  }, 60000);

  test("receive (no amount) returns the wallet's lightning address", () => {
    const result = runCli<LightningAddressResult>(
      `-c "${wallet.nwcUrl}" receive`,
    );
    expect(result.success).toBe(true);
    expect(result.output.lightning_address).toBe(wallet.lightningAddress);
  });

  test("receive --amount-sats returns a BOLT-11 invoice", () => {
    const result = runCli<MakeInvoiceResult>(
      `-c "${wallet.nwcUrl}" receive --amount-sats 100`,
    );
    expect(result.success).toBe(true);
    expect(result.output.invoice).toMatch(/^lnbc/i);
    expect(result.output.amount_in_sats).toBe(100);
  });

  test("receive --amount-sats --description produces an invoice", () => {
    const result = runCli<MakeInvoiceResult>(
      `-c "${wallet.nwcUrl}" receive --amount-sats 100 --description "test"`,
    );
    expect(result.success).toBe(true);
    expect(result.output.invoice).toMatch(/^lnbc/i);
    expect(result.output.amount_in_sats).toBe(100);
  });
});
