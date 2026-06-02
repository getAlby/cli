import { Command } from "commander";
import { fiatToSats } from "../tools/lightning/fiat_to_sats.js";
import { handleError, output } from "../utils.js";

export function registerFiatToSatsCommand(program: Command) {
  program
    .command("fiat-to-sats")
    .description("Convert fiat to sats")
    .requiredOption("--currency <code>", "Currency code (e.g., USD, EUR)")
    .requiredOption("--amount <n>", "Fiat amount", Number)
    .action(async (options) => {
      await handleError(async () => {
        if (!Number.isFinite(options.amount) || options.amount <= 0) {
          throw new Error(`Invalid --amount: ${options.amount}`);
        }
        const result = await fiatToSats({
          currency: options.currency,
          amount: options.amount,
        });
        output(result);
      });
    });
}
