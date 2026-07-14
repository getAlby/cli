import { Command, InvalidArgumentError } from "commander";
import { dryRun402, fetch402 } from "../tools/lightning/fetch.js";
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

/**
 * Parse and validate the `--credentials` JSON. It must be an object with string
 * `header` and `value` fields, matching the reusable credential emitted in a
 * previous fetch's `payment.credentials`. Rejects anything else so a malformed
 * credential fails loudly instead of being silently ignored by the fetch helper.
 */
function parseCredentials(value: string): { header: string; value: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new InvalidArgumentError(
      "--credentials must be valid JSON (e.g. '{\"header\":\"Authorization\",\"value\":\"L402 ...\"}')",
    );
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).header !== "string" ||
    typeof (parsed as Record<string, unknown>).value !== "string"
  ) {
    throw new InvalidArgumentError(
      '--credentials must be a JSON object with string "header" and "value" fields',
    );
  }
  const { header, value: headerValue } = parsed as {
    header: string;
    value: string;
  };
  return { header, value: headerValue };
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
      "--dry-run",
      "Preview the price without paying: sends the request unpaid and reports " +
        "the 402 challenge (price in sats when a lightning invoice is offered). " +
        "Needs no wallet. Prices listed by directories can be stale or dynamic - " +
        "this is the endpoint's actual price right now.",
    )
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
    .option(
      "--credentials <json>",
      "Reusable payment credential from a previous fetch " +
        '(JSON: {"header":"...","value":"..."}). When set, the request is ' +
        "authorized with it and never pays again — use it to authorize " +
        "follow-up requests (e.g. polling) without re-paying.",
    )
    .addHelpText(
      "after",
      "\nExample:\n" +
        '  $ npx @getalby/cli fetch "https://example.com/api" --max-amount 1000 --currency BTC --unit sats --network lightning\n' +
        "\nA successful response includes a `payment` object with the fees paid and a\n" +
        "reusable `credentials` value. Reuse it to avoid paying again:\n" +
        '  $ npx @getalby/cli fetch "https://example.com/api" --credentials \'{"header":"Authorization","value":"L402 ..."}\'\n',
    )
    .action(async (url, options) => {
      await handleError(async () => {
        // A dry run never pays, so the payment flags are meaningless with it.
        if (options.dryRun) {
          if (
            options.maxAmount !== undefined ||
            options.currency ||
            options.unit ||
            options.network ||
            options.credentials
          ) {
            throw new Error(
              "--dry-run never pays; drop --max-amount/--currency/--unit/--network/--credentials",
            );
          }
          const result = await dryRun402({
            url: url,
            method: options.method,
            body: options.body,
            headers: options.headers ? JSON.parse(options.headers) : undefined,
          });
          output(result);
          return;
        }

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
          credentials: options.credentials
            ? parseCredentials(options.credentials)
            : undefined,
        });
        output(result);
      });
    });
}
