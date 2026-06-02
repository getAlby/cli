import { Command } from "commander";
import { payKeysend, TlvRecord } from "../tools/nwc/pay_keysend.js";
import { getClient, handleError, output } from "../utils.js";
import { parseAmountNumber, resolveLightningSats } from "../amount.js";

export function registerPayKeysendCommand(program: Command) {
  program
    .command("pay-keysend")
    .description("Send a keysend payment to a node")
    .requiredOption("-p, --pubkey <hex>", "Destination node public key")
    .requiredOption("--amount <number>", "Amount", parseAmountNumber)
    .requiredOption(
      "--currency <code>",
      "Denomination: BTC, or a fiat code (USD, EUR, …) converted to sats at the current rate",
    )
    .requiredOption("--network <name>", 'Payment network — must be "lightning"')
    .option("--unit <sats|BTC>", "Sub-unit (required when --currency is BTC)")
    .option(
      "--preimage <hex>",
      "Preimage (optional, will be generated if not provided)",
    )
    .option("--tlv-records <json>", "TLV records as JSON array [{type, value}]")
    .addHelpText(
      "after",
      "\nExample:\n" +
        "  $ npx @getalby/cli pay-keysend -p 02abc... --amount 100 --currency BTC --unit sats --network lightning\n",
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
        let tlvRecords: TlvRecord[] | undefined;
        if (options.tlvRecords) {
          tlvRecords = JSON.parse(options.tlvRecords);
        }
        const result = await payKeysend(client, {
          pubkey: options.pubkey,
          amount_in_sats: resolved.sats,
          preimage: options.preimage,
          tlv_records: tlvRecords,
        });
        output({
          ...result,
          amount_in_sats: resolved.sats,
          ...(resolved.fiat && { fiat: resolved.fiat }),
        });
      });
    });
}
