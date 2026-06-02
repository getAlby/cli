import { Command } from "commander";
import { satsToFiat } from "../tools/lightning/sats_to_fiat.js";
import { handleError, output, parseSatsOption } from "../utils.js";

export function registerSatsToFiatCommand(program: Command) {
  program
    .command("sats-to-fiat")
    .description("Convert sats to fiat")
    .requiredOption("--amount-sats <sats>", "Amount in sats", parseSatsOption())
    .requiredOption("--currency <code>", "Currency code (e.g., USD, EUR)")
    .action(async (options) => {
      await handleError(async () => {
        const result = await satsToFiat({
          amount_in_sats: options.amountSats,
          currency: options.currency,
        });
        output(result);
      });
    });
}
