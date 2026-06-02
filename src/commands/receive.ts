import { Command } from "commander";
import { makeInvoice } from "../tools/nwc/make_invoice.js";
import { getClient, handleError, output } from "../utils.js";

export function registerReceiveCommand(program: Command) {
  program
    .command("receive")
    .description(
      "Get paid — returns either the wallet's lightning address or a BOLT-11 invoice.\n\n" +
        "  - receive                    → returns the wallet's lightning address (if available)\n" +
        "  - receive --amount-sats <sats>    → returns a BOLT-11 invoice for the given amount",
    )
    .option("--amount-sats <sats>", "Invoice amount in sats", parseInt)
    .option(
      "-d, --description <text>",
      "Invoice description (requires --amount-sats)",
    )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  $ npx @getalby/cli receive\n" +
        '  $ npx @getalby/cli receive --amount-sats 2100 --description "coffee"\n',
    )
    .action(async (options) => {
      await handleError(async () => {
        if (options.amountSats === undefined) {
          if (options.description !== undefined) {
            throw new Error("--description requires --amount-sats");
          }
          const client = await getClient(program);
          if (!client.lud16) {
            throw new Error(
              "This wallet does not expose a lightning address. " +
                "Either pass --amount-sats <sats> to generate a BOLT-11 invoice, " +
                "or connect a wallet that has a lightning address.",
            );
          }
          output({ lightning_address: client.lud16 });
          return;
        }

        if (!Number.isInteger(options.amountSats) || options.amountSats <= 0) {
          throw new Error(
            "Invalid --amount-sats: must be a positive integer number of sats",
          );
        }
        const client = await getClient(program);
        const result = await makeInvoice(client, {
          amount_in_sats: options.amountSats,
          description: options.description,
        });
        output(result);
      });
    });
}
