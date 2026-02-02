import { execSync } from "child_process";
import { createHash, randomBytes } from "crypto";

export interface TestWallet {
  nwcUrl: string;
  lightningAddress: string;
}

export interface HoldInvoiceParams {
  preimage: string;
  paymentHash: string;
}

export function generateHoldInvoiceParams(): HoldInvoiceParams {
  const preimage = randomBytes(32).toString("hex");
  const paymentHash = createHash("sha256")
    .update(Buffer.from(preimage, "hex"))
    .digest("hex");
  return { preimage, paymentHash };
}

export async function createTestWallet(retries = 5): Promise<TestWallet> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch("https://faucet.nwc.dev?balance=10000", {
        method: "POST",
      });
      if (!response.ok) {
        if (i < retries - 1) {
          await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
          continue;
        }
        throw new Error(`Faucet request failed: ${response.status}`);
      }
      const nwcUrl = (await response.text()).trim();
      const lud16Match = nwcUrl.match(/lud16=([^&\s]+)/);
      if (!lud16Match) {
        throw new Error("No lud16 in NWC URL");
      }
      return {
        nwcUrl,
        lightningAddress: decodeURIComponent(lud16Match[1]),
      };
    } catch (error) {
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Failed to create test wallet");
}

export interface CliResult<T> {
  success: boolean;
  output: T;
}

export function runCli<T>(args: string, env?: Record<string, string>): CliResult<T> {
  try {
    const result = execSync(`node build/index.js ${args}`, {
      encoding: "utf-8",
      cwd: process.cwd(),
      env: env ? { ...process.env, ...env } : process.env,
    });
    return { success: true, output: JSON.parse(result) };
  } catch (error) {
    const err = error as { stderr?: string; stdout?: string };
    const errorOutput = err.stderr || err.stdout || "{}";
    try {
      return { success: false, output: JSON.parse(errorOutput) };
    } catch {
      return { success: false, output: { error: errorOutput } as T };
    }
  }
}
