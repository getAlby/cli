import { describe, test, expect, beforeAll } from "vitest";
import { createTestWallet, runCli, TestWallet } from "./helpers.js";
import type { MakeInvoiceResult } from "../tools/nwc/make_invoice.js";
import type { PayInvoiceResult } from "../tools/nwc/pay_invoice.js";
import type { PayKeysendResult } from "../tools/nwc/pay_keysend.js";
import type { GetInfoResult } from "../tools/nwc/get_info.js";

interface ErrorOutput {
  error: string;
}

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

  test("lightning address without --amount-sats is rejected before wallet load", () => {
    const result = runCli<ErrorOutput>(`pay alice@getalby.com`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--amount-sats");
  });

  test("keysend pubkey without --amount-sats is rejected before wallet load", () => {
    const pubkey = "02" + "a".repeat(64);
    const result = runCli<ErrorOutput>(`pay ${pubkey}`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--amount-sats");
  });

  test("EVM address without --amount is rejected before wallet load", () => {
    const result = runCli<ErrorOutput>(
      `pay 0x000000000000000000000000000000000000dead`,
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--amount");
  });

  // Bitcoin destinations must use --amount-sats, not --amount.
  test("lightning address with --amount (crypto flag) is rejected and points to --amount-sats", () => {
    const result = runCli<ErrorOutput>(`pay alice@getalby.com --amount 100`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--amount-sats");
  });

  test("keysend pubkey with --amount (crypto flag) is rejected and points to --amount-sats", () => {
    const pubkey = "02" + "a".repeat(64);
    const result = runCli<ErrorOutput>(`pay ${pubkey} --amount 100`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--amount-sats");
  });

  test("BOLT-11 invoice with --amount (crypto flag) is rejected and points to --amount-sats", () => {
    const result = runCli<ErrorOutput>(`pay lnbc1junk --amount 100`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--amount-sats");
  });

  // Crypto destinations must use --amount, not --amount-sats.
  test("EVM address with --amount-sats (bitcoin flag) is rejected and points to --amount", () => {
    const result = runCli<ErrorOutput>(
      `pay 0x000000000000000000000000000000000000dead --amount-sats 10 --currency USDC --network arbitrum`,
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--amount-sats is not valid");
    expect(result.output.error).toContain("--amount");
  });

  test("EVM address without --currency is rejected", () => {
    const result = runCli<ErrorOutput>(
      `pay 0x000000000000000000000000000000000000dead --amount 10 --network arbitrum`,
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--currency");
  });

  test("EVM address without --network is rejected", () => {
    const result = runCli<ErrorOutput>(
      `pay 0x000000000000000000000000000000000000dead --amount 10 --currency USDC`,
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--network");
  });

  test("--currency on a BOLT-11 invoice is rejected as not applicable", () => {
    const result = runCli<ErrorOutput>(`pay lnbc1junk --currency USDT`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("not applicable to invoice payment");
  });

  test("testnet/signet invoice prefixes (lntb...) are recognized as invoices", () => {
    // Same path as the lnbc test above — exercises that lntb is treated as
    // an invoice (not falling through to the unknown-destination error).
    const result = runCli<ErrorOutput>(`pay lntb1junk --currency USDT`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("not applicable to invoice payment");
  });

  test("--comment on a keysend pubkey is rejected as not applicable", () => {
    const pubkey = "02" + "a".repeat(64);
    const result = runCli<ErrorOutput>(
      `pay ${pubkey} --amount-sats 100 --comment hi`,
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("not applicable to keysend payment");
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
      `-c "${receiver.nwcUrl}" make-invoice --amount-sats 100`,
    );
    expect(invoiceResult.success).toBe(true);

    const paymentResult = runCli<PayInvoiceResult>(
      `-c "${sender.nwcUrl}" pay "${invoiceResult.output.invoice}"`,
    );
    expect(paymentResult.success).toBe(true);
    expect(paymentResult.output.preimage).toBeDefined();
  });

  test("pay <lightning-address> --amount-sats fetches an invoice and pays it", () => {
    const paymentResult = runCli<PayInvoiceResult>(
      `-c "${sender.nwcUrl}" pay ${receiver.lightningAddress} --amount-sats 100`,
    );
    expect(paymentResult.success).toBe(true);
    expect(paymentResult.output.preimage).toBeDefined();
  });

  test("pay <pubkey> --amount-sats sends a keysend payment", () => {
    const infoResult = runCli<GetInfoResult>(
      `-c "${receiver.nwcUrl}" get-info`,
    );
    expect(infoResult.success).toBe(true);

    const paymentResult = runCli<PayKeysendResult>(
      `-c "${sender.nwcUrl}" pay ${infoResult.output.pubkey} --amount-sats 100`,
    );
    expect(paymentResult.success).toBe(true);
    expect(paymentResult.output.preimage).toBeDefined();
  });
});
