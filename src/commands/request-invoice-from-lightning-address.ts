import { Command } from "commander";
import { requestInvoiceFromLightningAddress } from "../tools/lightning/request_invoice_from_lightning_address.js";
import { handleError, output } from "../utils.js";
import { parseAmountNumber, resolveLightningSats } from "../amount.js";

export function registerRequestInvoiceFromLightningAddressCommand(
  program: Command,
) {
  program
    .command("request-invoice-from-lightning-address")
    .description("Request an invoice from a lightning address")
    .requiredOption("-a, --address <ln-address>", "Lightning address")
    .requiredOption("--amount <number>", "Amount", parseAmountNumber)
    .requiredOption(
      "--currency <code>",
      "Denomination: BTC, or a fiat code (USD, EUR, …) converted to sats at the current rate",
    )
    .requiredOption(
      "--network <name>",
      'Payment network — must be "lightning"',
    )
    .option("--unit <sats|BTC>", "Sub-unit (required when --currency is BTC)")
    .option("--comment <text>", "Optional comment")
    .addHelpText(
      "after",
      "\nExample:\n" +
        "  $ npx @getalby/cli request-invoice-from-lightning-address -a hello@getalby.com --amount 1000 --currency BTC --unit sats --network lightning\n",
    )
    .action(async (options) => {
      await handleError(async () => {
        const resolved = await resolveLightningSats({
          amount: options.amount,
          currency: options.currency,
          unit: options.unit,
          network: options.network,
        });
        const result = await requestInvoiceFromLightningAddress({
          lightning_address: options.address,
          amount_in_sats: resolved.sats,
          comment: options.comment,
        });
        output({ ...result, ...(resolved.fiat && { fiat: resolved.fiat }) });
      });
    });
}
