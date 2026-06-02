import { Command } from "commander";
import { makeInvoice } from "../tools/nwc/make_invoice.js";
import { getClient, handleError, output } from "../utils.js";
import { parseAmountNumber, resolveLightningSats } from "../amount.js";

export function registerReceiveCommand(program: Command) {
  program
    .command("receive")
    .description(
      "Get paid — returns either the wallet's lightning address or a BOLT-11 invoice.\n\n" +
        "  - receive                                                            → returns the wallet's lightning address (if available)\n" +
        "  - receive --amount <n> --currency <code> --network lightning [--unit] → returns a BOLT-11 invoice for the given amount",
    )
    .option("--amount <number>", "Invoice amount", parseAmountNumber)
    .option(
      "--currency <code>",
      "Denomination: BTC, or a fiat code (USD, EUR, …) converted to sats at the current rate — required with --amount",
    )
    .option(
      "--network <name>",
      'Payment network — must be "lightning" (required with --amount)',
    )
    .option("--unit <sats|BTC>", "Sub-unit (required when --currency is BTC)")
    .option("-d, --description <text>", "Invoice description (requires --amount)")
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  $ npx @getalby/cli receive\n" +
        '  $ npx @getalby/cli receive --amount 2100 --currency BTC --unit sats --network lightning --description "coffee"\n' +
        "  $ npx @getalby/cli receive --amount 5 --currency USD --network lightning\n",
    )
    .action(async (options) => {
      await handleError(async () => {
        if (options.amount === undefined) {
          // Amount-less call: no rail flags apply.
          for (const [flag, value] of [
            ["--description", options.description],
            ["--currency", options.currency],
            ["--unit", options.unit],
            ["--network", options.network],
          ] as const) {
            if (value !== undefined) {
              throw new Error(`${flag} requires --amount`);
            }
          }
          const client = await getClient(program);
          if (!client.lud16) {
            throw new Error(
              "This wallet does not expose a lightning address. " +
                "Either pass --amount <n> --currency <code> --network lightning to generate a BOLT-11 invoice, " +
                "or connect a wallet that has a lightning address.",
            );
          }
          output({ lightning_address: client.lud16 });
          return;
        }

        const resolved = await resolveLightningSats({
          amount: options.amount,
          currency: options.currency,
          unit: options.unit,
          network: options.network,
        });
        const client = await getClient(program);
        const result = await makeInvoice(client, {
          amount_in_sats: resolved.sats,
          description: options.description,
        });
        output({ ...result, ...(resolved.fiat && { fiat: resolved.fiat }) });
      });
    });
}
