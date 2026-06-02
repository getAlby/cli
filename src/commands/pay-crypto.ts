import { Command } from "commander";
import { payInvoice } from "../tools/nwc/pay_invoice.js";
import { getClient, handleError, output } from "../utils.js";
import {
  isPlausibleEvmAddress,
  payCrypto,
  findSupportedPair,
} from "../lendaswap/swap.js";
import { parseAmountNumber, classifyRail } from "../amount.js";

export function registerPayCryptoCommand(program: Command) {
  program
    .command("pay-crypto")
    .description(
      "Pay any supported crypto or stablecoin address from your bitcoin lightning wallet.\n\n" +
        "If the requested currency/network pair isn't supported you'll get an error listing the pairs that are.",
    )
    .argument("<address>", "Recipient address on the target network")
    .requiredOption(
      "--amount <number>",
      "Amount to send in target-currency units (e.g. 10 = 10 USDC)",
      parseAmountNumber,
    )
    .requiredOption("--currency <name>", "Target currency (e.g. USDC)")
    .requiredOption(
      "--network <name>",
      "Target chain network (chain name or id, e.g. arbitrum / 42161)",
    )
    .addHelpText(
      "after",
      "\nExample:\n" +
        "  $ npx @getalby/cli pay-crypto 0xabc... --amount 10 --currency USDC --network arbitrum\n",
    )
    .action(async (address: string, options) => {
      await handleError(async () => {
        // Shared rail classifier: rejects --unit, rejects --network lightning,
        // rejects BTC/fiat on a chain network — leaving only a crypto token on
        // a chain network, which findSupportedPair then validates.
        const rail = classifyRail({
          currency: options.currency,
          unit: options.unit,
          network: options.network,
        });
        if (rail.kind !== "crypto") {
          throw new Error(
            "pay-crypto only sends crypto tokens over a chain network " +
              "(e.g. --currency USDC --network arbitrum). For BTC/fiat over " +
              "lightning, use the pay command.",
          );
        }
        if (!isPlausibleEvmAddress(address)) {
          throw new Error(
            `Recipient address does not look valid (expected 0x + 40 hex chars): ${address}`,
          );
        }

        // Validate the pair against the live Lendaswap catalog before
        // asking the user for their wallet — fast feedback on typos.
        const pair = await findSupportedPair(rail.currency, rail.network);

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
