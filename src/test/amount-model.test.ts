import { describe, test, expect } from "vitest";
import { runCli } from "./helpers.js";

interface ErrorOutput {
  error: string;
}

// Exercises the shared amount model (src/amount.ts) wired into every
// amount-bearing command. Every check here resolves *before* network I/O or
// wallet load: structural validation (currency/network/unit rules) and the
// BTC sats/BTC arithmetic are all synchronous. We sanitize the environment so
// that, when an input is fully valid, the command fails only at wallet load
// ("No wallet connection found") — proving the input cleared every gate.
//
// The two cross-rail *currency* mismatches that need a downstream resolver to
// surface (a token on the lightning rail → rate lookup; a fiat code's live
// rate) are intentionally covered by the live suites, not here, since the
// model is network-first (the rail is chosen by --network alone, with no
// hardcoded currency/token catalog).
const SANITIZED_ENV = {
  HOME: "/tmp/nonexistent-alby-cli-test-home",
  NWC_URL: "",
};

function run(command: string) {
  return runCli<ErrorOutput>(command, SANITIZED_ENV);
}

describe("amount model — currency and network are always required", () => {
  test("amount without --currency is rejected", () => {
    const result = run("pay alice@getalby.com --amount 100 --network lightning");
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--currency");
  });

  test("amount without --network is rejected", () => {
    const result = run("pay alice@getalby.com --amount 100 --currency BTC --unit sats");
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--network");
  });
});

describe("amount model — --unit is required for BTC, rejected otherwise", () => {
  test("BTC without --unit is rejected (sats vs BTC must be explicit)", () => {
    const result = run(
      "pay alice@getalby.com --amount 1 --currency BTC --network lightning",
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--unit");
  });

  test("--unit on a fiat currency is rejected", () => {
    const result = run(
      "pay alice@getalby.com --amount 5 --currency USD --unit sats --network lightning",
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--unit is not valid");
  });

  test('an invalid --unit value is rejected', () => {
    const result = run(
      "pay alice@getalby.com --amount 1 --currency BTC --unit bits --network lightning",
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain('--unit must be "sats" or "BTC"');
  });
});

describe("amount model — BTC --unit sats is whole-number only", () => {
  test.each(["1.5", "1abc", "0"])(
    "make-invoice rejects --amount %s for BTC/sats",
    (value) => {
      const result = run(
        `make-invoice --amount ${value} --currency BTC --unit sats --network lightning`,
      );
      expect(result.success).toBe(false);
      // "1.5" is rejected by the sats whole-number check; "1abc"/"0" by the
      // strict --amount parser at parse time.
      expect(result.output.error).toMatch(
        /whole number|Amount must be a positive number/,
      );
    },
  );
});

describe("amount model — BTC --unit BTC converts to sats", () => {
  test("a fractional-sat BTC amount is rejected", () => {
    // 0.000000001 BTC = 0.1 sats — not a whole number of sats.
    const result = run(
      "make-invoice --amount 0.000000001 --currency BTC --unit BTC --network lightning",
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("whole number of sats");
  });

  test("a whole-sat BTC amount clears validation (fails only at wallet load)", () => {
    // 0.000001 BTC = 100 sats. Resolution is synchronous, so the only thing
    // left to fail is the (absent) wallet.
    const result = run(
      "make-invoice --amount 0.000001 --currency BTC --unit BTC --network lightning",
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("No wallet connection found");
  });
});

describe("amount model — rail mismatch on a lightning-only command", () => {
  test("BTC on a chain network is rejected", () => {
    const result = run(
      "make-invoice --amount 1 --currency BTC --network arbitrum",
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain(
      "only supported on --network lightning",
    );
  });

  test("a chain network is rejected (invoices settle over Lightning)", () => {
    const result = run(
      "make-invoice --amount 10 --currency USDC --network arbitrum",
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("lightning");
  });
});

// Representative coverage proving the shared helper is wired into more than
// one command, not just make-invoice / pay.
describe("amount model — wired across commands", () => {
  test("make-hold-invoice enforces --unit for BTC", () => {
    const result = run(
      "make-hold-invoice --amount 1 --currency BTC --network lightning --payment-hash " +
        "a".repeat(64),
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--unit");
  });

  test("pay-keysend enforces --unit for BTC", () => {
    const result = run(
      `pay-keysend -p 02${"a".repeat(64)} --amount 1 --currency BTC --network lightning`,
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--unit");
  });

  test("request-invoice-from-lightning-address rejects --unit for fiat", () => {
    const result = run(
      "request-invoice-from-lightning-address -a a@b.com --amount 5 --currency USD --unit sats --network lightning",
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--unit is not valid");
  });

  test("sats-to-fiat rejects an invalid --unit", () => {
    const result = run("sats-to-fiat --amount 1000 --unit bits --currency USD");
    expect(result.success).toBe(false);
    expect(result.output.error).toContain('--unit must be "sats" or "BTC"');
  });
});
