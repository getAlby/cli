import { describe, test, expect, beforeAll } from "vitest";
import { createTestWallet, runCli, TestWallet } from "./helpers.js";
import type { GetBalanceResult } from "../tools/nwc/get_balance.js";
import type { GetBudgetResult } from "../tools/nwc/get_budget.js";
import type { GetInfoResult } from "../tools/nwc/get_info.js";
import type { GetWalletServiceInfoResult } from "../tools/nwc/get_wallet_service_info.js";
import type { ListTransactionsResult } from "../tools/nwc/list_transactions.js";

describe("NWC Read-only Commands", () => {
  let wallet: TestWallet;

  beforeAll(async () => {
    wallet = await createTestWallet();
  }, 60000);

  test("get-balance returns wallet balance", () => {
    const result = runCli<GetBalanceResult>(`-c "${wallet.nwcUrl}" get-balance`);
    expect(result.success).toBe(true);
    expect(result.output.amount_in_sats).toBeTypeOf("number");
  });

  test("get-budget returns budget info", () => {
    const result = runCli<GetBudgetResult>(`-c "${wallet.nwcUrl}" get-budget`);
    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
  });

  test("get-info returns wallet info", () => {
    const result = runCli<GetInfoResult>(`-c "${wallet.nwcUrl}" get-info`);
    expect(result.success).toBe(true);
    expect(result.output.alias).toBeDefined();
    expect(result.output.pubkey).toBeDefined();
  });

  test("get-wallet-service-info returns service capabilities", () => {
    const result = runCli<GetWalletServiceInfoResult>(
      `-c "${wallet.nwcUrl}" get-wallet-service-info`
    );
    expect(result.success).toBe(true);
    expect(Array.isArray(result.output.capabilities)).toBe(true);
  });

  test("list-transactions returns transaction list", () => {
    const result = runCli<ListTransactionsResult>(
      `-c "${wallet.nwcUrl}" list-transactions`
    );
    expect(result.success).toBe(true);
    expect(Array.isArray(result.output.transactions)).toBe(true);
  });

  // NOTE: Faucet wallets don't have sign_message scope
  test.skip("sign-message signs a message", () => {
    const testMessage = "Hello, World!";
    const result = runCli<{ signature: string }>(
      `-c "${wallet.nwcUrl}" sign-message -m "${testMessage}"`
    );
    expect(result.success).toBe(true);
    expect(result.output.signature).toBeTypeOf("string");
  });
});
