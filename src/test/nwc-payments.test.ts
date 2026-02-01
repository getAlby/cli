import { describe, test, expect, beforeAll } from "vitest";
import { createTestWallet, runCli, TestWallet } from "./helpers.js";
import type { MakeInvoiceResult } from "../tools/nwc/make_invoice.js";
import type { PayInvoiceResult } from "../tools/nwc/pay_invoice.js";
import type { LookupInvoiceResult } from "../tools/nwc/lookup_invoice.js";
import type { PayKeysendResult } from "../tools/nwc/pay_keysend.js";
import type { GetInfoResult } from "../tools/nwc/get_info.js";

describe("NWC Payment Commands", () => {
  let sender: TestWallet;
  let receiver: TestWallet;

  beforeAll(async () => {
    // Create wallets sequentially to avoid faucet rate limiting
    sender = await createTestWallet();
    receiver = await createTestWallet();
  }, 60000);

  test("make-invoice and pay-invoice", () => {
    // Create invoice with receiver wallet
    const invoiceResult = runCli<MakeInvoiceResult>(
      `-c "${receiver.nwcUrl}" make-invoice -a 100`
    );
    expect(invoiceResult.success).toBe(true);
    expect(invoiceResult.output.invoice).toBeDefined();

    // Pay with sender wallet
    const paymentResult = runCli<PayInvoiceResult>(
      `-c "${sender.nwcUrl}" pay-invoice -i "${invoiceResult.output.invoice}"`
    );
    expect(paymentResult.success).toBe(true);
    expect(paymentResult.output.preimage).toBeDefined();
  });

  test("lookup-invoice finds paid invoice", () => {
    // Create an invoice
    const invoiceResult = runCli<MakeInvoiceResult>(
      `-c "${receiver.nwcUrl}" make-invoice -a 50`
    );
    expect(invoiceResult.success).toBe(true);

    // Pay the invoice first (unpaid invoices may not be found)
    const payResult = runCli<PayInvoiceResult>(
      `-c "${sender.nwcUrl}" pay-invoice -i "${invoiceResult.output.invoice}"`
    );
    expect(payResult.success).toBe(true);

    // Lookup the paid invoice using the invoice string
    const lookupResult = runCli<LookupInvoiceResult>(
      `-c "${receiver.nwcUrl}" lookup-invoice -i "${invoiceResult.output.invoice}"`
    );
    expect(lookupResult.success).toBe(true);
    expect(lookupResult.output.payment_hash).toBeDefined();
  });

  test("pay-keysend sends keysend payment", () => {
    // Get receiver's pubkey
    const infoResult = runCli<GetInfoResult>(`-c "${receiver.nwcUrl}" get-info`);
    expect(infoResult.success).toBe(true);

    // Send keysend payment
    const keysendResult = runCli<PayKeysendResult>(
      `-c "${sender.nwcUrl}" pay-keysend -p "${infoResult.output.pubkey}" -a 100`
    );
    expect(keysendResult.success).toBe(true);
    expect(keysendResult.output.preimage).toBeDefined();
  });
});
