import { describe, test, expect } from "vitest";
import { runCli } from "./helpers.js";

interface ErrorOutput {
  error: string;
}

// fetch's `--max-amount` is the unified spend-cap flag. Its value is a strict
// sats integer (see `parseMaxAmountSats` in src/commands/fetch.ts) because the
// cap is currently restricted to BTC/sats over lightning; the denomination flags are
// validated through the shared amount model (src/amount.ts). Parsing happens at
// commander parse time — before any network I/O — so these assertions are
// deterministic and need no wallet. Payment/invoice amounts are covered by
// amount-model.test.ts.

describe("fetch --max-amount strict parsing", () => {
  // The cap is a positive whole number of sats. Malformed input must be
  // rejected, not coerced (parseInt("abc") → NaN, parseInt("0.5") → 0), so a
  // typo can't silently weaken the limit. Negatives are rejected by the
  // digits-only check, and 0 is no longer a "no limit" escape hatch.
  test.each(["0.5", "abc", "-1", "1e3", "0"])(
    "rejects malformed/non-positive --max-amount %s",
    (value) => {
      const result = runCli<ErrorOutput>(
        `fetch http://example.invalid --max-amount ${value}`,
      );
      expect(result.success).toBe(false);
      expect(result.output.error).toContain("Sats must be");
    },
  );

  test("a positive --max-amount requires its denomination (--currency)", () => {
    const result = runCli<ErrorOutput>(
      "fetch http://example.invalid --max-amount 1000",
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain("--currency");
  });

  test("a positive --max-amount rejects a non-BTC/sats/lightning denomination", () => {
    const result = runCli<ErrorOutput>(
      "fetch http://example.invalid --max-amount 5 --currency USD --network lightning",
    );
    expect(result.success).toBe(false);
    expect(result.output.error).toContain(
      "currently supports only --currency BTC --unit sats --network lightning",
    );
  });
});
