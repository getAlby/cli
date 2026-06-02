import { Command } from "commander";
import { makeHoldInvoice } from "../tools/nwc/make_hold_invoice.js";
import { getClient, handleError, output, parseSatsOption } from "../utils.js";

export function registerMakeHoldInvoiceCommand(program: Command) {
  program
    .command("make-hold-invoice")
    .description("Create a HOLD invoice that requires manual settlement")
    .requiredOption("--amount-sats <sats>", "Amount in sats", parseSatsOption())
    .requiredOption("--payment-hash <hex>", "Payment hash (32 bytes hex)")
    .option("-d, --description <text>", "Invoice description")
    .option("-e, --expiry <seconds>", "Expiry time in seconds", parseInt)
    .action(async (options) => {
      await handleError(async () => {
        const client = await getClient(program);
        const result = await makeHoldInvoice(client, {
          amount_in_sats: options.amountSats,
          payment_hash: options.paymentHash,
          description: options.description,
          expiry: options.expiry,
        });
        output(result);
      });
    });
}
