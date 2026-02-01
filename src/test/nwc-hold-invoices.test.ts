import { describe, test, expect, beforeAll } from "vitest";
import { spawn } from "child_process";
import {
  createTestWallet,
  runCli,
  TestWallet,
  generateHoldInvoiceParams,
} from "./helpers.js";
import type { MakeHoldInvoiceResult } from "../tools/nwc/make_hold_invoice.js";
import type { SettleHoldInvoiceResult } from "../tools/nwc/settle_hold_invoice.js";
import type { CancelHoldInvoiceResult } from "../tools/nwc/cancel_hold_invoice.js";

describe("NWC HOLD Invoice Commands", () => {
  let sender: TestWallet;
  let receiver: TestWallet;

  beforeAll(async () => {
    // Create wallets sequentially to avoid faucet rate limiting
    receiver = await createTestWallet();
    sender = await createTestWallet();
  }, 60000);

  test("make-hold-invoice creates hold invoice", () => {
    const { paymentHash } = generateHoldInvoiceParams();
    const result = runCli<MakeHoldInvoiceResult>(
      `-c "${receiver.nwcUrl}" make-hold-invoice -a 100 --payment-hash "${paymentHash}"`
    );
    expect(result.success).toBe(true);
    expect(result.output.invoice).toBeDefined();
    expect(result.output.payment_hash).toBe(paymentHash);
  });

  test("settle-hold-invoice settles with preimage", async () => {
    const { preimage, paymentHash } = generateHoldInvoiceParams();

    // Create a hold invoice
    const holdResult = runCli<MakeHoldInvoiceResult>(
      `-c "${receiver.nwcUrl}" make-hold-invoice -a 100 --payment-hash "${paymentHash}"`
    );
    expect(holdResult.success).toBe(true);

    // Start wait-for-payment in background
    const waitProcess = spawn(
      "node",
      [
        "build/index.js",
        "-c",
        receiver.nwcUrl,
        "wait-for-payment",
        "-p",
        paymentHash,
        "-t",
        "30",
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    // Give it time to start listening
    await new Promise((r) => setTimeout(r, 1000));

    // Pay the invoice from sender (this will be held)
    const payProcess = spawn(
      "node",
      [
        "build/index.js",
        "-c",
        sender.nwcUrl,
        "pay-invoice",
        "-i",
        holdResult.output.invoice,
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    // Wait for the hold invoice to be accepted
    await new Promise((r) => setTimeout(r, 2000));

    // Settle the hold invoice
    const settleResult = runCli<SettleHoldInvoiceResult>(
      `-c "${receiver.nwcUrl}" settle-hold-invoice --preimage "${preimage}"`
    );
    expect(settleResult.success).toBe(true);
    expect(settleResult.output.preimage).toBe(preimage);

    // Cleanup
    waitProcess.kill();
    payProcess.kill();
  }, 60000);

  test("cancel-hold-invoice cancels hold invoice", async () => {
    const { paymentHash } = generateHoldInvoiceParams();

    // Create a hold invoice
    const holdResult = runCli<MakeHoldInvoiceResult>(
      `-c "${receiver.nwcUrl}" make-hold-invoice -a 100 --payment-hash "${paymentHash}"`
    );
    expect(holdResult.success).toBe(true);

    // Pay the invoice from sender (this will put it in held state)
    const payProcess = spawn(
      "node",
      [
        "build/index.js",
        "-c",
        sender.nwcUrl,
        "pay-invoice",
        "-i",
        holdResult.output.invoice,
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    // Wait for the hold invoice to be in held state
    await new Promise((r) => setTimeout(r, 2000));

    // Cancel the hold invoice (while it's held)
    const cancelResult = runCli<CancelHoldInvoiceResult>(
      `-c "${receiver.nwcUrl}" cancel-hold-invoice --payment-hash "${paymentHash}"`
    );
    expect(cancelResult.success).toBe(true);
    expect(cancelResult.output.payment_hash).toBe(paymentHash);

    // Cleanup
    payProcess.kill();
  }, 60000);
});
