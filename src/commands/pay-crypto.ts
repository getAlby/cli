import { Command } from "commander";
import { payInvoice } from "../tools/nwc/pay_invoice.js";
import { getClient, handleError, output } from "../utils.js";
import {
  isPlausibleEvmAddress,
  payCrypto,
  findSupportedPair,
} from "../lendaswap/swap.js";

export function registerPayCryptoCommand(program: Command) {
  program
    .command("pay-crypto")
    .description(
      "Pay any supported crypto or stablecoin address from your bitcoin lightning wallet.\n\n" +
        "Supported currencies and networks are sourced live from the Lendaswap API; if a pair is not available you'll get an error listing what is.",
    )
    .argument("<address>", "Recipient address on the target network")
    .requiredOption(
      "-a, --amount <number>",
      "Amount to send in target-currency units (e.g. 10 = 10 USDC)",
      Number,
    )
    .requiredOption("--currency <name>", "Target currency (e.g. USDC)")
    .requiredOption(
      "--network <name>",
      "Target network (chain name or id, e.g. arbitrum / 42161)",
    )
    .addHelpText(
      "after",
      "\nExample:\n" +
        "  $ npx @getalby/cli pay-crypto 0xabc... --amount 10 --currency USDC --network arbitrum\n",
    )
    .action(async (address: string, options) => {
      await handleError(async () => {
        if (!Number.isFinite(options.amount) || options.amount <= 0) {
          throw new Error(`Invalid --amount: ${options.amount}`);
        }
        if (!isPlausibleEvmAddress(address)) {
          throw new Error(
            `Recipient address does not look valid (expected 0x + 40 hex chars): ${address}`,
          );
        }

        // Validate the pair against the live Lendaswap catalog before
        // asking the user for their wallet — fast feedback on typos.
        const pair = await findSupportedPair(options.currency, options.network);

        const nwc = await getClient(program);

        const { swapId } = await payCrypto({
          pair,
          amount: options.amount,
          targetAddress: address,
          payInvoice: async (bolt11Invoice) => {
            await payInvoice(nwc, { invoice: bolt11Invoice });
          },
        });

        output({
          swap_id: swapId,
          status: "completed",
          target: {
            address,
            currency: pair.symbol,
            network: pair.network,
            amount: options.amount,
          },
        });
      });
    });
}
