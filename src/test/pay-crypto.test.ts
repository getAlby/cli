import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "child_process";
import { createServer, type Server } from "http";
import { type AddressInfo } from "net";

// Stand up a local HTTP mock for the Lendaswap API endpoints the CLI hits
// during validation. The CLI spawns a fresh subprocess per test, so the
// `LENDASWAP_API_URL` env var (consumed in src/lendaswap/swap.ts) points it
// at this mock instead of api.satora.io. We only need `/tokens` and
// `/swap-pairs` — pair validation runs before wallet load, so tests never
// reach the swap-creation endpoints.
//
// IMPORTANT: we use async `spawn`, not the shared `execSync`-based runCli
// helper. `execSync` blocks the event loop, which would prevent this
// in-process mock from accepting the subprocess's TCP connection — fetch
// would just time out.

let server: Server;
let mockUrl = "";

const MOCK_TOKENS = {
  btc_tokens: [],
  evm_tokens: [
    {
      chain: "42161",
      decimals: 6,
      name: "USD Coin",
      symbol: "USDC",
      token_id: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    },
    {
      chain: "42161",
      decimals: 6,
      name: "Tether USD",
      symbol: "USDT",
      token_id: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
    },
  ],
};

// Only the Lightning → 42161 (Arbitrum) pair is enabled in the mock. So
// USDC/USDT on Arbitrum resolve; the same symbols on any other chain are
// rejected as unsupported.
const MOCK_SWAP_PAIRS = {
  pairs: [
    {
      fee_percentage: 0.0025,
      max_sats: 100_000_000,
      min_sats: 1000,
      source: "Lightning",
      target: "42161",
    },
  ],
};

beforeAll(async () => {
  server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/tokens") {
      res.end(JSON.stringify(MOCK_TOKENS));
    } else if (req.url === "/swap-pairs") {
      res.end(JSON.stringify(MOCK_SWAP_PAIRS));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "not found" }));
    }
  });
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );
  const addr = server.address() as AddressInfo;
  mockUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(
  () => new Promise<void>((resolve) => server.close(() => resolve())),
);

interface ErrorOutput {
  error: string;
}

interface CliResult<T> {
  success: boolean;
  output: T;
}

function runCliAsync<T>(args: string): Promise<CliResult<T>> {
  return new Promise((resolve) => {
    const child = spawn("node", ["build/index.js", ...args.split(" ")], {
      env: {
        ...process.env,
        // Wallet load always fails — exposes the validation gates as the
        // only thing that can succeed or fail before that point.
        HOME: "/tmp/nonexistent-alby-cli-test-home",
        NWC_URL: "",
        LENDASWAP_API_URL: mockUrl,
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      const raw = code === 0 ? stdout : stderr || stdout || "{}";
      try {
        resolve({ success: code === 0, output: JSON.parse(raw) });
      } catch {
        resolve({ success: code === 0, output: { error: raw } as T });
      }
    });
  });
}

describe("pay-crypto validation", () => {
  describe("unsupported currency/network combination", () => {
    test("unknown currency is rejected and lists supported pairs", async () => {
      const result = await runCliAsync<ErrorOutput>(
        "pay-crypto 0x000000000000000000000000000000000000dead --amount 10 --currency XYZ --network arbitrum",
      );
      expect(result.success).toBe(false);
      expect(result.output.error).toContain(
        "Unsupported currency/network combination",
      );
      expect(result.output.error).toContain("USDC on Arbitrum");
    });

    test("USDC on ethereum is rejected (chain not in swap-pairs)", async () => {
      const result = await runCliAsync<ErrorOutput>(
        "pay-crypto 0x000000000000000000000000000000000000dead --amount 10 --currency USDC --network ethereum",
      );
      expect(result.success).toBe(false);
      expect(result.output.error).toContain(
        "Unsupported currency/network combination",
      );
      expect(result.output.error).toContain("USDC on Arbitrum");
    });
  });

  describe("malformed EVM address", () => {
    test("completely non-hex string is rejected", async () => {
      const result = await runCliAsync<ErrorOutput>(
        "pay-crypto notanaddress --amount 10 --currency USDC --network arbitrum",
      );
      expect(result.success).toBe(false);
      expect(result.output.error).toContain("address does not look valid");
    });

    test("too-short hex with 0x prefix is rejected", async () => {
      const result = await runCliAsync<ErrorOutput>(
        "pay-crypto 0xabc --amount 10 --currency USDC --network arbitrum",
      );
      expect(result.success).toBe(false);
      expect(result.output.error).toContain("address does not look valid");
    });

    test("40-char hex without 0x prefix is rejected", async () => {
      const result = await runCliAsync<ErrorOutput>(
        "pay-crypto 000000000000000000000000000000000000dead --amount 10 --currency USDC --network arbitrum",
      );
      expect(result.success).toBe(false);
      expect(result.output.error).toContain("address does not look valid");
    });
  });

  describe("invalid amount", () => {
    test("--amount 0 is rejected", async () => {
      const result = await runCliAsync<ErrorOutput>(
        "pay-crypto 0x000000000000000000000000000000000000dead --amount 0 --currency USDC --network arbitrum",
      );
      expect(result.success).toBe(false);
      expect(result.output.error).toContain("Amount must be a positive number");
    });

    test("--amount -1 is rejected", async () => {
      const result = await runCliAsync<ErrorOutput>(
        "pay-crypto 0x000000000000000000000000000000000000dead --amount -1 --currency USDC --network arbitrum",
      );
      expect(result.success).toBe(false);
      expect(result.output.error).toContain("Amount must be a positive number");
    });

    test("--amount abc (NaN) is rejected", async () => {
      const result = await runCliAsync<ErrorOutput>(
        "pay-crypto 0x000000000000000000000000000000000000dead --amount abc --currency USDC --network arbitrum",
      );
      expect(result.success).toBe(false);
      expect(result.output.error).toContain("Amount must be a positive number");
    });

    // Unit-suffixed input must not be truncated to its leading digits
    // (Number("123usd") is NaN, unlike parseFloat which would yield 123).
    test("--amount 123usd is rejected", async () => {
      const result = await runCliAsync<ErrorOutput>(
        "pay-crypto 0x000000000000000000000000000000000000dead --amount 123usd --currency USDC --network arbitrum",
      );
      expect(result.success).toBe(false);
      expect(result.output.error).toContain("Amount must be a positive number");
    });
  });

  describe("missing required options", () => {
    test("missing --currency is rejected", async () => {
      const result = await runCliAsync<ErrorOutput>(
        "pay-crypto 0x000000000000000000000000000000000000dead --amount 10 --network arbitrum",
      );
      expect(result.success).toBe(false);
      expect(result.output.error).toContain("--currency");
    });

    test("missing --network is rejected", async () => {
      const result = await runCliAsync<ErrorOutput>(
        "pay-crypto 0x000000000000000000000000000000000000dead --amount 10 --currency USDC",
      );
      expect(result.success).toBe(false);
      expect(result.output.error).toContain("--network");
    });
  });

  describe("happy-path validation", () => {
    test("valid USDC/arbitrum inputs get past validation and fail only at wallet load", async () => {
      // The mocked supported list includes USDC on 42161 (Arbitrum), so
      // findSupportedPair succeeds. With the wallet env disabled, the only
      // error left is "No wallet connection found" from getClient() —
      // proof that amount, address, and pair gates all accepted the input.
      const result = await runCliAsync<ErrorOutput>(
        "pay-crypto 0x000000000000000000000000000000000000dead --amount 10 --currency USDC --network arbitrum",
      );
      expect(result.success).toBe(false);
      expect(result.output.error).toContain("No wallet connection found");
    });
  });
});
