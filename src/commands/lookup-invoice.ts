import { Command } from "commander";
import { lookupInvoice } from "../tools/nwc/lookup_invoice.js";
import { getClient, handleError, output } from "../utils.js";

export function registerLookupInvoiceCommand(program: Command) {
  program
    .command("lookup-invoice")
    .description("Look up an invoice")
    .option("-p, --payment-hash <hash>", "Payment hash")
    .option("-i, --invoice <bolt11>", "Invoice string")
    .action(async (options) => {
      await handleError(async () => {
        if (!options.paymentHash && !options.invoice) {
          console.error("Error: --payment-hash or --invoice is required");
          process.exit(1);
        }
        const client = getClient(program);
        const result = await lookupInvoice(client, {
          payment_hash: options.paymentHash,
          invoice: options.invoice,
        });
        output(result);
      });
    });
}
