import { Command } from "commander";
import { payInvoice } from "../tools/nwc/pay_invoice.js";
import { getClient, handleError, output, parseSatsOption } from "../utils.js";

export function registerPayInvoiceCommand(program: Command) {
  program
    .command("pay-invoice")
    .description("Pay a lightning invoice")
    .argument("<bolt11>", "Invoice to pay")
    .option(
      "--amount-sats <sats>",
      "Amount in sats (for zero-amount invoices)",
      parseSatsOption(),
    )
    .action(async (invoice, options) => {
      await handleError(async () => {
        const client = await getClient(program);
        const result = await payInvoice(client, {
          invoice,
          amount_in_sats: options.amountSats,
        });
        output(result);
      });
    });
}
