import { Command } from "commander";
import { satsToFiat } from "../tools/lightning/sats_to_fiat.js";
import { handleError, output } from "../utils.js";
import { parseAmountNumber, resolveToSats, Unit } from "../amount.js";

export function registerSatsToFiatCommand(program: Command) {
  program
    .command("sats-to-fiat")
    .description("Convert a bitcoin amount to fiat")
    .requiredOption(
      "--amount <number>",
      "Amount on the bitcoin side (paired with --unit)",
      parseAmountNumber,
    )
    .requiredOption("--unit <sats|BTC>", "Sub-unit of --amount (sats or BTC)")
    .requiredOption("--currency <code>", "Target fiat currency (e.g., USD, EUR)")
    .addHelpText(
      "after",
      "\nExample:\n" +
        "  $ npx @getalby/cli sats-to-fiat --amount 1000 --unit sats --currency USD\n",
    )
    .action(async (options) => {
      await handleError(async () => {
        const normalizedUnit = options.unit.toLowerCase();
        let unit: Unit;
        if (normalizedUnit === "sats") unit = "sats";
        else if (normalizedUnit === "btc") unit = "BTC";
        else
          throw new Error(`--unit must be "sats" or "BTC" (got "${options.unit}")`);

        // The amount is denominated in BTC's sub-units, so resolve it to whole
        // sats first (reusing the shared sats/BTC math), then convert.
        const { sats } = await resolveToSats({
          amount: options.amount,
          currency: "BTC",
          unit,
        });
        const result = await satsToFiat({
          amount_in_sats: sats,
          currency: options.currency,
        });
        output(result);
      });
    });
}
