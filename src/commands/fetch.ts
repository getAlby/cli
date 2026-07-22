import { Command, InvalidArgumentError } from "commander";
import { fetch402, type Fetch402Resume } from "../tools/lightning/fetch.js";
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

/**
 * Parse and validate the `--resume` JSON: the `pendingPayment` object from a
 * previous fetch's payment-recovery error plus the preimage recovered via
 * lookup-invoice. `pendingPayment` is opaque to the CLI (the library builds
 * the credential from it), so only its shape is checked here.
 */
function parseResume(value: string): Fetch402Resume {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new InvalidArgumentError(
      "--resume must be valid JSON (e.g. '{\"pendingPayment\":{...},\"preimage\":\"...\"}')",
    );
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).pendingPayment !== "object" ||
    (parsed as Record<string, unknown>).pendingPayment === null ||
    typeof (parsed as Record<string, unknown>).preimage !== "string" ||
    !(parsed as Record<string, unknown>).preimage
  ) {
    throw new InvalidArgumentError(
      '--resume must be a JSON object with a "pendingPayment" object and a non-empty string "preimage"',
    );
  }
  return parsed as Fetch402Resume;
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
    .option(
      "--credentials <json>",
      "Reusable payment credential from a previous fetch " +
        '(JSON: {"header":"...","value":"..."}). When set, the request is ' +
        "authorized with it and never pays again — use it to authorize " +
        "follow-up requests (e.g. polling) without re-paying.",
    )
    .option(
      "--resume <json>",
      "Resume a payment interrupted before its preimage was known " +
        '(JSON: {"pendingPayment":{...},"preimage":"..."}). Use the ' +
        "pendingPayment from a previous fetch's paymentRecovery error " +
        "together with the preimage recovered via lookup-invoice. The " +
        "request is authorized with the rebuilt credential and never pays " +
        "again.",
    )
    .addHelpText(
      "after",
      "\nExample:\n" +
        '  $ npx @getalby/cli fetch "https://example.com/api" --max-amount 1000 --currency BTC --unit sats --network lightning\n' +
        "\nA successful response includes a `payment` object with the amount paid\n" +
        "(amountSat), routing fees (feesPaidMsat, in millisatoshis) and a reusable\n" +
        "`credentials` value. Reuse it to avoid paying again:\n" +
        '  $ npx @getalby/cli fetch "https://example.com/api" --credentials \'{"header":"Authorization","value":"L402 ..."}\'\n' +
        "\nIf a payment is interrupted (e.g. a wallet timeout), the error output includes\n" +
        "a `paymentRecovery` object with the payment hash and everything needed to\n" +
        "recover - follow its instructions (check lookup-invoice, then re-run with\n" +
        "--resume or --credentials) instead of retrying blindly, so the same invoice\n" +
        "is never paid twice.\n",
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

        if (options.credentials && options.resume) {
          throw new Error(
            "--credentials and --resume are mutually exclusive - use " +
              "--credentials to reuse a completed payment's credential, or " +
              "--resume to complete an interrupted one",
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
          resume: options.resume ? parseResume(options.resume) : undefined,
        });
        output(result);
      });
    });
}
