import { Command, InvalidArgumentError } from "commander";
import { fetch402 } from "../tools/lightning/fetch.js";
import { getClient, handleError, output } from "../utils.js";
import { classifyRail } from "../amount.js";

/**
 * Commander coercion for `--max-amount`, fetch's spend cap. The value is in
 * sats (`--unit` is restricted to sats), so only a positive base-10 whole
 * number is accepted. Unlike `parseInt`, this rejects partial/odd input —
 * `"1abc"`, `"1e3"`, `"1.5"`, `"0x10"`, `"abc"`, `"0"` — instead of silently
 * coercing it (`parseInt("abc")` → `NaN`, `parseInt("0.5")` → `0`), which would
 * weaken the cap.
 */
function parseMaxAmountSats(value: string): number {
  if (!/^\d+$/.test(value.trim())) {
    throw new InvalidArgumentError(`Sats must be a whole number (got "${value}")`);
  }
  const sats = Number(value);
  if (!Number.isSafeInteger(sats)) {
    throw new InvalidArgumentError(`Sats value is too large (got "${value}")`);
  }
  if (sats === 0) {
    throw new InvalidArgumentError("Sats must be greater than 0");
  }
  return sats;
}

export function registerFetch402Command(program: Command) {
  program
    .command("fetch")
    .description(
      "Fetch a payment-protected resource (auto-detects L402, X402, MPP)",
    )
    .argument("<url>", "URL to fetch")
    .option("-X, --method <method>", "HTTP method (GET, POST, etc.)")
    .option("-b, --body <json>", "Request body (JSON string)")
    .option("-H, --headers <json>", "Additional headers (JSON string)")
    .option(
      "--max-amount <amount>",
      "Maximum amount to auto-pay per request. Aborts if the endpoint requests more. " +
        "When set, requires --currency BTC --unit sats --network lightning. (default: 5000 sats)",
      parseMaxAmountSats,
    )
    .option(
      "--currency <code>",
      "Denomination of --max-amount — currently must be BTC",
    )
    .option(
      "--unit <sats|BTC>",
      "Sub-unit of --max-amount — currently must be sats",
    )
    .option(
      "--network <name>",
      "Rail for --max-amount — currently must be lightning",
    )
    .addHelpText(
      "after",
      "\nExample:\n" +
        '  $ npx @getalby/cli fetch "https://example.com/api" --max-amount 1000 --currency BTC --unit sats --network lightning\n',
    )
    .action(async (url, options) => {
      await handleError(async () => {
        // A cap must state its denomination, like every other amount. For now
        // the only supported rail is BTC/sats over lightning — the cap is
        // inherently a sats spend limit — but it goes through the shared
        // classifier so the surface matches the rest of the CLI and can grow.
        if (options.maxAmount !== undefined) {
          const rail = classifyRail({
            currency: options.currency,
            unit: options.unit,
            network: options.network,
          });
          if (rail.kind !== "bitcoin" || rail.unit !== "sats") {
            throw new Error(
              "fetch's --max-amount spend cap currently supports only " +
                "--currency BTC --unit sats --network lightning",
            );
          }
        } else if (options.currency || options.unit || options.network) {
          throw new Error(
            "--currency/--unit/--network only apply together with a positive --max-amount",
          );
        }

        const client = await getClient(program);
        const result = await fetch402(client, {
          url: url,
          method: options.method,
          body: options.body,
          headers: options.headers ? JSON.parse(options.headers) : undefined,
          // --unit is restricted to sats above, so --max-amount is already the
          // sats cap. When omitted, the tool applies its default.
          maxAmountSats: options.maxAmount,
        });
        output(result);
      });
    });
}
