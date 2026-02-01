import { Command } from "commander";
import { payInvoice } from "../tools/nwc/pay_invoice.js";
import { getClient, handleError, output } from "../utils.js";

export function registerPayInvoiceCommand(program: Command) {
  program
    .command("pay-invoice")
    .description("Pay a lightning invoice")
    .requiredOption("-i, --invoice <bolt11>", "Invoice to pay")
    .option("-a, --amount <sats>", "Amount (for zero-amount invoices)", parseInt)
    .action(async (options) => {
      await handleError(async () => {
        const client = getClient(program);
        const result = await payInvoice(client, {
          invoice: options.invoice,
          amount_in_sats: options.amount,
        });
        output(result);
      });
    });
}
