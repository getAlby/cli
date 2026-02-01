import { Command } from "commander";
import { cancelHoldInvoice } from "../tools/nwc/cancel_hold_invoice.js";
import { getClient, handleError, output } from "../utils.js";

export function registerCancelHoldInvoiceCommand(program: Command) {
  program
    .command("cancel-hold-invoice")
    .description("Cancel a HOLD invoice")
    .requiredOption("--payment-hash <hex>", "Payment hash (32 bytes hex)")
    .action(async (options) => {
      await handleError(async () => {
        const client = getClient(program);
        const result = await cancelHoldInvoice(client, {
          payment_hash: options.paymentHash,
        });
        output(result);
      });
    });
}
