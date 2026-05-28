import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { runCli } from "./helpers.js";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface WalletInfo {
  name: string | null;
  isDefault: boolean;
  status: "connected" | "pending";
}

interface ListWalletsOutput {
  directory: string;
  wallets: WalletInfo[];
}

describe("list-wallets command", () => {
  let testHome: string;
  let albyDir: string;

  beforeEach(() => {
    testHome = mkdtempSync(join(tmpdir(), "alby-cli-test-"));
    albyDir = join(testHome, ".alby-cli");
  });

  afterEach(() => {
    rmSync(testHome, { recursive: true, force: true });
  });

  function writeWallet(filename: string) {
    mkdirSync(albyDir, { recursive: true });
    writeFileSync(join(albyDir, filename), "nostr+walletconnect://test");
  }

  test("returns empty list when no .alby-cli directory exists", () => {
    const result = runCli<ListWalletsOutput>("list-wallets", { HOME: testHome });
    expect(result.success).toBe(true);
    expect(result.output.wallets).toEqual([]);
  });

  test("lists the default (unnamed) wallet", () => {
    writeWallet("connection-secret.key");
    const result = runCli<ListWalletsOutput>("list-wallets", { HOME: testHome });
    expect(result.success).toBe(true);
    expect(result.output.wallets).toEqual([
      { name: null, isDefault: true, status: "connected" },
    ]);
  });

  test("lists named wallets sorted with default first", () => {
    writeWallet("connection-secret.key");
    writeWallet("connection-secret-work.key");
    writeWallet("connection-secret-personal.key");
    const result = runCli<ListWalletsOutput>("list-wallets", { HOME: testHome });
    expect(result.success).toBe(true);
    expect(result.output.wallets).toEqual([
      { name: null, isDefault: true, status: "connected" },
      { name: "personal", isDefault: false, status: "connected" },
      { name: "work", isDefault: false, status: "connected" },
    ]);
  });

  test("reports pending connections", () => {
    writeWallet("pending-connection-secret-test.key");
    const result = runCli<ListWalletsOutput>("list-wallets", { HOME: testHome });
    expect(result.success).toBe(true);
    expect(result.output.wallets).toEqual([
      { name: "test", isDefault: false, status: "pending" },
    ]);
  });

  test("connected status takes precedence over pending for the same wallet", () => {
    writeWallet("connection-secret-dual.key");
    writeWallet("pending-connection-secret-dual.key");
    const result = runCli<ListWalletsOutput>("list-wallets", { HOME: testHome });
    expect(result.success).toBe(true);
    expect(result.output.wallets).toEqual([
      { name: "dual", isDefault: false, status: "connected" },
    ]);
  });

  test("does not reveal secret contents", () => {
    writeWallet("connection-secret.key");
    const result = runCli<ListWalletsOutput>("list-wallets", { HOME: testHome });
    expect(JSON.stringify(result.output)).not.toContain("nostr+walletconnect://");
  });

  test("ignores unrelated files", () => {
    mkdirSync(albyDir, { recursive: true });
    writeFileSync(join(albyDir, "pending-connection-relay-test.txt"), "wss://relay");
    writeFileSync(join(albyDir, "notes.txt"), "hello");
    const result = runCli<ListWalletsOutput>("list-wallets", { HOME: testHome });
    expect(result.success).toBe(true);
    expect(result.output.wallets).toEqual([]);
  });
});
