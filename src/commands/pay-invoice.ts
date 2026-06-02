import { Command } from "commander";
import { payInvoice } from "../tools/nwc/pay_invoice.js";
import { getClient, handleError, output } from "../utils.js";
import { parseAmountNumber, resolveLightningSats } from "../amount.js";

export function registerPayInvoiceCommand(program: Command) {
  program
    .command("pay-invoice")
    .description("Pay a lightning invoice")
    .argument("<bolt11>", "Invoice to pay")
    .option(
      "--amount <number>",
      "Amount (only for zero-amount invoices)",
      parseAmountNumber,
    )
    .option(
      "--currency <code>",
      "Denomination: BTC, or a fiat code (USD, EUR, …) converted to sats at the current rate — required with --amount",
    )
    .option(
      "--network <name>",
      'Payment network — must be "lightning" (required with --amount)',
    )
    .option("--unit <sats|BTC>", "Sub-unit (required when --currency is BTC)")
    .addHelpText(
      "after",
      "\nExample (zero-amount invoice):\n" +
        "  $ npx @getalby/cli pay-invoice lnbc1... --amount 1000 --currency BTC --unit sats --network lightning\n",
    )
    .action(async (invoice, options) => {
      await handleError(async () => {
        let amountInSats: number | undefined;
        let fiat: { amount: number; currency: string } | undefined;
        if (options.amount !== undefined) {
          const resolved = await resolveLightningSats({
            amount: options.amount,
            currency: options.currency,
            unit: options.unit,
            network: options.network,
          });
          amountInSats = resolved.sats;
          fiat = resolved.fiat;
        }
        const client = await getClient(program);
        const result = await payInvoice(client, {
          invoice,
          amount_in_sats: amountInSats,
        });
        output({ ...result, ...(fiat && { fiat }) });
      });
    });
}
