import { describe, test, expect, beforeAll } from "vitest";
import { createTestWallet, runCli, TestWallet } from "./helpers.js";
import type { MakeInvoiceResult } from "../tools/nwc/make_invoice.js";

interface ErrorOutput {
  error: string;
}

interface LightningAddressResult {
  lightning_address: string;
}

interface InvoiceWithFiat extends MakeInvoiceResult {
  fiat?: { amount: number; currency: string };
}

describe("receive command — validation", () => {
  test("--description without --amount is rejected", () => {
    const result = runCli<ErrorOutput>(`receive --description "hi"`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--description requires --amount");
  });

  test("--currency without --amount is rejected", () => {
    const result = runCli<ErrorOutput>(`receive --currency USD`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--currency requires --amount");
  });

  test("--amount 0 is rejected at parse time", () => {
    const result = runCli<ErrorOutput>(`receive --amount 0`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("Amount must be a positive number");
  });

  test("--amount abc (NaN) is rejected at parse time", () => {
    const result = runCli<ErrorOutput>(`receive --amount abc`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("Amount must be a positive number");
  });

  test("--amount without --currency is rejected", () => {
    const result = runCli<ErrorOutput>(
      `receive --amount 100 --network lightning`,
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--currency");
  });

  test("--amount --currency BTC without --unit is rejected", () => {
    const result = runCli<ErrorOutput>(
      `receive --amount 100 --currency BTC --network lightning`,
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--unit");
  });

  test("--unit on a fiat currency is rejected", () => {
    const result = runCli<ErrorOutput>(
      `receive --amount 5 --currency USD --unit sats --network lightning`,
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--unit is not valid");
  });

  test("a chain network is rejected (invoices are lightning-only)", () => {
    const result = runCli<ErrorOutput>(
      `receive --amount 10 --currency USDC --network arbitrum`,
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("lightning");
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

  test("receive --amount --currency BTC --unit sats returns a BOLT-11 invoice", () => {
    const result = runCli<MakeInvoiceResult>(
      `-c "${wallet.nwcUrl}" receive --amount 100 --currency BTC --unit sats --network lightning`,
    );
    expect(result.success).toBe(true);
    expect(result.output.invoice).toMatch(/^lnbc/i);
    expect(result.output.amount_in_sats).toBe(100);
  });

  test("receive --unit BTC converts to sats", () => {
    const result = runCli<MakeInvoiceResult>(
      `-c "${wallet.nwcUrl}" receive --amount 0.000001 --currency BTC --unit BTC --network lightning`,
    );
    expect(result.success).toBe(true);
    expect(result.output.amount_in_sats).toBe(100);
  });

  test("receive --amount --currency USD resolves fiat to sats", () => {
    const result = runCli<InvoiceWithFiat>(
      `-c "${wallet.nwcUrl}" receive --amount 5 --currency USD --network lightning`,
    );
    expect(result.success).toBe(true);
    expect(result.output.invoice).toMatch(/^lnbc/i);
    expect(result.output.amount_in_sats).toBeGreaterThan(0);
    expect(result.output.fiat).toEqual({ amount: 5, currency: "USD" });
  });

  test("receive --amount --description produces an invoice", () => {
    const result = runCli<MakeInvoiceResult>(
      `-c "${wallet.nwcUrl}" receive --amount 100 --currency BTC --unit sats --network lightning --description "test"`,
    );
    expect(result.success).toBe(true);
    expect(result.output.invoice).toMatch(/^lnbc/i);
    expect(result.output.amount_in_sats).toBe(100);
  });
});
