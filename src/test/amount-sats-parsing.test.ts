import { describe, test, expect } from "vitest";
import { runCli } from "./helpers.js";

interface ErrorOutput {
  error: string;
}

// These exercise the shared strict sats parser (parseSatsOption). Parsing
// happens at commander parse time — before any wallet or network I/O — so the
// rejection assertions are deterministic and need no wallet. Valid-value
// acceptance is already covered by the live tests in nwc-payments /
// lightning-tools (make-invoice 100, sats-to-fiat 1000).

const hex64 = "a".repeat(64);

// Every command that exposes --amount-sats, each invoked with all *other*
// required args satisfied so the only error is the bad --amount-sats value.
const COMMANDS_WITH_AMOUNT_SATS: Array<[string, string]> = [
  ["make-invoice", "make-invoice --amount-sats 1abc"],
  [
    "make-hold-invoice",
    `make-hold-invoice --amount-sats 1abc --payment-hash ${hex64}`,
  ],
  ["pay-keysend", `pay-keysend -p 02${hex64} --amount-sats 1abc`],
  ["pay-invoice", "pay-invoice lnbc1junk --amount-sats 1abc"],
  ["sats-to-fiat", "sats-to-fiat --amount-sats 1abc --currency USD"],
  ["receive", "receive --amount-sats 1abc"],
  [
    "request-invoice-from-lightning-address",
    "request-invoice-from-lightning-address -a a@b.com --amount-sats 1abc",
  ],
  ["pay (lightning-address)", "pay a@b.com --amount-sats 1abc"],
];

describe("--amount-sats strict parsing", () => {
  test.each(COMMANDS_WITH_AMOUNT_SATS)(
    "%s rejects a non-integer --amount-sats before any I/O",
    (_name, command) => {
      const result = runCli<ErrorOutput>(command);
      expect(result.success).toBe(false);
      expect(result.output.error).toContain("Sats must be a whole number");
    },
  );

  // parseInt would silently truncate these to a *different* number ("1e3" → 1,
  // "1.5" → 1, "1abc" → 1); the strict parser rejects them instead.
  test.each(["1abc", "1e3", "1.5", "abc", "-5"])(
    "make-invoice rejects non-integer --amount-sats %s",
    (value) => {
      const result = runCli<ErrorOutput>(`make-invoice --amount-sats ${value}`);
      expect(result.success).toBe(false);
      expect(result.output.error).toContain("Sats must be a whole number");
    },
  );

  test("make-invoice rejects 0 --amount-sats", () => {
    const result = runCli<ErrorOutput>("make-invoice --amount-sats 0");
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("greater than 0");
  });

  // Previously pay parsed --amount-sats with Number (1e3 → 1000) while the
  // dedicated commands used parseInt (1e3 → 1) — the same input resolved to
  // different sat amounts. Both must now reject it identically.
  test("pay and make-invoice reject 1e3 --amount-sats consistently", () => {
    const payResult = runCli<ErrorOutput>(
      "pay alice@getalby.com --amount-sats 1e3",
    );
    const makeResult = runCli<ErrorOutput>("make-invoice --amount-sats 1e3");
    expect(payResult.success).toBe(false);
    expect(payResult.output.error).toContain("Sats must be a whole number");
    expect(makeResult.success).toBe(false);
    expect(makeResult.output.error).toContain("Sats must be a whole number");
  });
});

describe("fetch --max-amount-sats strict parsing", () => {
  // Malformed values must be rejected, not coerced to 0/NaN — the fetch tool
  // treats maxAmountSats 0 as "no limit", so a silent coercion would disable
  // the spend cap (parseInt("abc") → NaN, parseInt("0.5") → 0).
  test.each(["0.5", "abc", "-1", "1e3"])(
    "rejects malformed --max-amount-sats %s (no silent cap bypass)",
    (value) => {
      const result = runCli<ErrorOutput>(
        `fetch http://example.invalid --max-amount-sats ${value}`,
      );
      expect(result.success).toBe(false);
      expect(result.output.error).toContain("Sats must be");
    },
  );

  test("accepts 0 as the documented no-limit sentinel (passes parsing)", () => {
    const result = runCli<ErrorOutput>(
      "fetch http://example.invalid --max-amount-sats 0",
    );
    // 0 is a valid sentinel, so the parser must not reject it; the command
    // fails later (network), never at parse time.
    expect(result.output.error ?? "").not.toContain("Sats must be");
  });
});
