import { Command } from "commander";
import { requestInvoice } from "../tools/lightning/request_invoice.js";
import { handleError, output } from "../utils.js";

export function registerRequestInvoiceCommand(program: Command) {
  program
    .command("request-invoice")
    .description("Request invoice from lightning address")
    .requiredOption("-a, --address <ln-address>", "Lightning address")
    .requiredOption("-s, --amount <sats>", "Amount in sats", parseInt)
    .option("--comment <text>", "Optional comment")
    .action(async (options) => {
      await handleError(async () => {
        const result = await requestInvoice({
          lightning_address: options.address,
          amount_in_sats: options.amount,
          comment: options.comment,
        });
        output(result);
      });
    });
}
