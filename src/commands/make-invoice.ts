import { Command } from "commander";
import { makeInvoice } from "../tools/nwc/make_invoice.js";
import { getClient, handleError, output } from "../utils.js";

export function registerMakeInvoiceCommand(program: Command) {
  program
    .command("make-invoice")
    .description("Create a lightning invoice")
    .requiredOption("-a, --amount <sats>", "Amount in sats", parseInt)
    .option("-d, --description <text>", "Invoice description")
    .option("-e, --expiry <seconds>", "Expiry time in seconds", parseInt)
    .action(async (options) => {
      await handleError(async () => {
        const client = getClient(program);
        const result = await makeInvoice(client, {
          amount_in_sats: options.amount,
          description: options.description,
          expiry: options.expiry,
        });
        output(result);
      });
    });
}
