import { describe, test, expect, beforeAll } from "vitest";
import { createTestWallet, runCli, TestWallet } from "./helpers.js";
import type { MakeInvoiceResult } from "../tools/nwc/make_invoice.js";
import type { PayInvoiceResult } from "../tools/nwc/pay_invoice.js";
import type { PayKeysendResult } from "../tools/nwc/pay_keysend.js";
import type { GetInfoResult } from "../tools/nwc/get_info.js";

interface ErrorOutput {
  error: string;
}

interface PaymentWithFiat extends PayInvoiceResult {
  amount_in_sats?: number;
  fiat?: { amount: number; currency: string };
}

const pubkey = "02" + "a".repeat(64);
const evm = "0x000000000000000000000000000000000000dead";

describe("pay command — destination detection", () => {
  test("unknown destination format lists all 4 accepted shapes", () => {
    const result = runCli<ErrorOutput>(`pay notavaliddestination`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("Could not detect destination type");
    expect(result.output.error).toContain("BOLT-11 invoice");
    expect(result.output.error).toContain("Lightning address");
    expect(result.output.error).toContain("Node pubkey");
    expect(result.output.error).toContain("EVM address");
  });

  test("lightning address without --amount is rejected before wallet load", () => {
    const result = runCli<ErrorOutput>(`pay alice@getalby.com`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--amount");
  });

  test("keysend pubkey without --amount is rejected before wallet load", () => {
    const result = runCli<ErrorOutput>(`pay ${pubkey}`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--amount");
  });

  test("EVM address without --amount is rejected before wallet load", () => {
    const result = runCli<ErrorOutput>(`pay ${evm}`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--amount");
  });
});

describe("pay command — unified amount model validation", () => {
  test("lightning address with --amount but no --currency is rejected", () => {
    const result = runCli<ErrorOutput>(
      `pay alice@getalby.com --amount 100 --network lightning`,
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--currency");
  });

  test("lightning address with --amount but no --network is rejected", () => {
    const result = runCli<ErrorOutput>(
      `pay alice@getalby.com --amount 100 --currency BTC`,
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--network");
  });

  test("--currency BTC without --unit is rejected (sats/BTC ambiguity)", () => {
    const result = runCli<ErrorOutput>(
      `pay alice@getalby.com --amount 100 --currency BTC --network lightning`,
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--unit");
  });

  test("--unit on a fiat currency is rejected", () => {
    const result = runCli<ErrorOutput>(
      `pay alice@getalby.com --amount 5 --currency USD --unit sats --network lightning`,
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--unit is not valid");
  });

  test("a lightning address on a chain network is rejected (lightning-only)", () => {
    const result = runCli<ErrorOutput>(
      `pay alice@getalby.com --amount 10 --currency USDC --network arbitrum`,
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("lightning");
  });

  test("a non-numeric --amount is rejected at parse time", () => {
    const result = runCli<ErrorOutput>(
      `pay alice@getalby.com --amount 123usd --currency BTC --unit sats --network lightning`,
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("Amount must be a positive number");
  });

  test("EVM address with --currency BTC --network lightning is rejected", () => {
    const result = runCli<ErrorOutput>(
      `pay ${evm} --amount 10 --currency BTC --network lightning`,
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("EVM address");
  });

  test("EVM address without --currency is rejected", () => {
    const result = runCli<ErrorOutput>(`pay ${evm} --amount 10 --network arbitrum`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--currency");
  });

  test("EVM address without --network is rejected", () => {
    const result = runCli<ErrorOutput>(`pay ${evm} --amount 10 --currency USDC`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--network");
  });

  test("amount flags on a BOLT-11 invoice without --amount are rejected", () => {
    const result = runCli<ErrorOutput>(`pay lnbc1junk --currency USDT`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("zero-amount invoice");
  });

  test("testnet/signet invoice prefixes (lntb...) are recognized as invoices", () => {
    const result = runCli<ErrorOutput>(`pay lntb1junk --currency USDT`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("zero-amount invoice");
  });

  test("--comment on a keysend pubkey is rejected as not applicable", () => {
    const result = runCli<ErrorOutput>(
      `pay ${pubkey} --amount 100 --currency BTC --unit sats --network lightning --comment hi`,
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("not applicable to keysend payment");
  });

  test("--unit on an EVM (crypto) destination is rejected", () => {
    const result = runCli<ErrorOutput>(
      `pay ${evm} --amount 10 --currency USDC --unit sats --network arbitrum`,
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--unit");
  });
});

describe("pay command — live integration", () => {
  let sender: TestWallet;
  let receiver: TestWallet;

  beforeAll(async () => {
    sender = await createTestWallet();
    receiver = await createTestWallet();
  }, 60000);

  test("pay <bolt11> pays an invoice end-to-end", () => {
    const invoiceResult = runCli<MakeInvoiceResult>(
      `-c "${receiver.nwcUrl}" make-invoice --amount 100 --currency BTC --unit sats --network lightning`,
    );
    expect(invoiceResult.success).toBe(true);

    const paymentResult = runCli<PayInvoiceResult>(
      `-c "${sender.nwcUrl}" pay "${invoiceResult.output.invoice}"`,
    );
    expect(paymentResult.success).toBe(true);
    expect(paymentResult.output.preimage).toBeDefined();
  });

  test("pay <lightning-address> --currency BTC --unit sats pays it", () => {
    const paymentResult = runCli<PayInvoiceResult>(
      `-c "${sender.nwcUrl}" pay ${receiver.lightningAddress} --amount 100 --currency BTC --unit sats --network lightning`,
    );
    expect(paymentResult.success).toBe(true);
    expect(paymentResult.output.preimage).toBeDefined();
  });

  test("pay <lightning-address> --currency USD resolves fiat to sats and pays", () => {
    const paymentResult = runCli<PaymentWithFiat>(
      `-c "${sender.nwcUrl}" pay ${receiver.lightningAddress} --amount 1 --currency USD --network lightning`,
    );
    expect(paymentResult.success).toBe(true);
    expect(paymentResult.output.preimage).toBeDefined();
    expect(paymentResult.output.amount_in_sats).toBeGreaterThan(0);
    expect(paymentResult.output.fiat).toEqual({ amount: 1, currency: "USD" });
  });

  test("pay <pubkey> --currency BTC --unit sats sends a keysend payment", () => {
    const infoResult = runCli<GetInfoResult>(
      `-c "${receiver.nwcUrl}" get-info`,
    );
    expect(infoResult.success).toBe(true);

    const paymentResult = runCli<PayKeysendResult>(
      `-c "${sender.nwcUrl}" pay ${infoResult.output.pubkey} --amount 100 --currency BTC --unit sats --network lightning`,
    );
    expect(paymentResult.success).toBe(true);
    expect(paymentResult.output.preimage).toBeDefined();
  });
});
