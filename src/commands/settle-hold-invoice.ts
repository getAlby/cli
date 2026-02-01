import { Command } from "commander";
import { settleHoldInvoice } from "../tools/nwc/settle_hold_invoice.js";
import { getClient, handleError, output } from "../utils.js";

export function registerSettleHoldInvoiceCommand(program: Command) {
  program
    .command("settle-hold-invoice")
    .description("Settle a HOLD invoice with the preimage")
    .requiredOption("--preimage <hex>", "Preimage (32 bytes hex)")
    .action(async (options) => {
      await handleError(async () => {
        const client = getClient(program);
        const result = await settleHoldInvoice(client, {
          preimage: options.preimage,
        });
        output(result);
      });
    });
}
