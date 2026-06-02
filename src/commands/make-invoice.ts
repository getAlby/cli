import { Command } from "commander";
import { makeInvoice } from "../tools/nwc/make_invoice.js";
import { getClient, handleError, output } from "../utils.js";
import { parseAmountNumber, resolveLightningSats } from "../amount.js";

export function registerMakeInvoiceCommand(program: Command) {
  program
    .command("make-invoice")
    .description("Create a lightning invoice")
    .requiredOption("--amount <number>", "Invoice amount", parseAmountNumber)
    .requiredOption(
      "--currency <code>",
      "Denomination: BTC, or a fiat code (USD, EUR, …) converted to sats at the current rate",
    )
    .requiredOption(
      "--network <name>",
      'Payment network — must be "lightning" for invoices',
    )
    .option("--unit <sats|BTC>", "Sub-unit (required when --currency is BTC)")
    .option("-d, --description <text>", "Invoice description")
    .option("-e, --expiry <seconds>", "Expiry time in seconds", parseInt)
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  $ npx @getalby/cli make-invoice --amount 1000 --currency BTC --unit sats --network lightning\n" +
        "  $ npx @getalby/cli make-invoice --amount 5 --currency USD --network lightning\n",
    )
    .action(async (options) => {
      await handleError(async () => {
        const resolved = await resolveLightningSats({
          amount: options.amount,
          currency: options.currency,
          unit: options.unit,
          network: options.network,
        });
        const client = await getClient(program);
        const result = await makeInvoice(client, {
          amount_in_sats: resolved.sats,
          description: options.description,
          expiry: options.expiry,
        });
        output({ ...result, ...(resolved.fiat && { fiat: resolved.fiat }) });
      });
    });
}
