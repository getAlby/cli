import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { createTestWallet, runCli, TestWallet } from "./helpers.js";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("Connection Secret Handling", () => {
  let wallet: TestWallet;
  let secretFilePath: string;
  let badSecretFilePath: string;

  beforeAll(async () => {
    wallet = await createTestWallet();

    // Create temp file with valid connection secret
    secretFilePath = join(tmpdir(), `nwc-test-secret-${Date.now()}.txt`);
    writeFileSync(secretFilePath, wallet.nwcUrl);

    // Create temp file with invalid/truncated content
    badSecretFilePath = join(tmpdir(), `nwc-test-bad-secret-${Date.now()}.txt`);
    writeFileSync(badSecretFilePath, "nostr+wallet");
  }, 60000);

  afterAll(() => {
    try {
      unlinkSync(secretFilePath);
    } catch {}
    try {
      unlinkSync(badSecretFilePath);
    } catch {}
  });

  test("accepts connection string directly", () => {
    const result = runCli(`-c "${wallet.nwcUrl}" get-balance`);
    expect(result.success).toBe(true);
  });

  test("reads connection secret from file", () => {
    const result = runCli(`-c "${secretFilePath}" get-balance`);
    expect(result.success).toBe(true);
  });

  test("errors when file does not exist", () => {
    const result = runCli<{ error: string }>(`-c "/tmp/nonexistent-file-${Date.now()}" get-balance`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("Failed to read connection secret file");
  });

  test("errors when file contains invalid connection string", () => {
    const result = runCli<{ error: string }>(`-c "${badSecretFilePath}" get-balance`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("Invalid connection secret");
  });

  test("errors when no connection secret provided", () => {
    const result = runCli<{ error: string }>("get-balance");
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--connection-secret is required");
  });

  test("errors when connection string is malformed", () => {
    const result = runCli<{ error: string }>(`-c "nostr+walletconnect://asdf" get-balance`);
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("Invalid connection secret");
  });
});
