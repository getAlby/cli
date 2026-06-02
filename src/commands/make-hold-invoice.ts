import { Command } from "commander";
import { makeHoldInvoice } from "../tools/nwc/make_hold_invoice.js";
import { getClient, handleError, output } from "../utils.js";
import { parseAmountNumber, resolveLightningSats } from "../amount.js";

export function registerMakeHoldInvoiceCommand(program: Command) {
  program
    .command("make-hold-invoice")
    .description("Create a HOLD invoice that requires manual settlement")
    .requiredOption("--amount <number>", "Invoice amount", parseAmountNumber)
    .requiredOption(
      "--currency <code>",
      "Denomination: BTC, or a fiat code (USD, EUR, …) converted to sats at the current rate",
    )
    .requiredOption(
      "--network <name>",
      'Payment network — must be "lightning" for invoices',
    )
    .option("--unit <sats|BTC>", "Sub-unit (required when --currency is BTC)")
    .requiredOption("--payment-hash <hex>", "Payment hash (32 bytes hex)")
    .option("-d, --description <text>", "Invoice description")
    .option("-e, --expiry <seconds>", "Expiry time in seconds", parseInt)
    .addHelpText(
      "after",
      "\nExample:\n" +
        "  $ npx @getalby/cli make-hold-invoice --amount 1000 --currency BTC --unit sats --network lightning --payment-hash abc123...\n",
    )
    .action(async (options) => {
      await handleError(async () => {
        const resolved = await resolveLightningSats({
          amount: options.amount,
          currency: options.currency,
          unit: options.unit,
          network: options.network,
        });
        const client = await getClient(program);
        const result = await makeHoldInvoice(client, {
          amount_in_sats: resolved.sats,
          payment_hash: options.paymentHash,
          description: options.description,
          expiry: options.expiry,
        });
        output({ ...result, ...(resolved.fiat && { fiat: resolved.fiat }) });
      });
    });
}
