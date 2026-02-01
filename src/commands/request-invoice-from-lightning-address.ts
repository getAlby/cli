import { Command } from "commander";
import { requestInvoiceFromLightningAddress } from "../tools/lightning/request_invoice_from_lightning_address.js";
import { handleError, output } from "../utils.js";

export function registerRequestInvoiceFromLightningAddressCommand(program: Command) {
  program
    .command("request-invoice-from-lightning-address")
    .description("Request an invoice from a lightning address")
    .requiredOption("-a, --address <ln-address>", "Lightning address")
    .requiredOption("-s, --amount <sats>", "Amount in sats", parseInt)
    .option("--comment <text>", "Optional comment")
    .action(async (options) => {
      await handleError(async () => {
        const result = await requestInvoiceFromLightningAddress({
          lightning_address: options.address,
          amount_in_sats: options.amount,
          comment: options.comment,
        });
        output(result);
      });
    });
}
