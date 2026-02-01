import { Command } from "commander";
import { payKeysend, TlvRecord } from "../tools/nwc/pay_keysend.js";
import { getClient, handleError, output } from "../utils.js";

export function registerPayKeysendCommand(program: Command) {
  program
    .command("pay-keysend")
    .description("Send a keysend payment to a node")
    .requiredOption("-p, --pubkey <hex>", "Destination node public key")
    .requiredOption("-a, --amount <sats>", "Amount in sats", parseInt)
    .option("--preimage <hex>", "Preimage (optional, will be generated if not provided)")
    .option("--tlv-records <json>", "TLV records as JSON array [{type, value}]")
    .action(async (options) => {
      await handleError(async () => {
        const client = getClient(program);
        let tlvRecords: TlvRecord[] | undefined;
        if (options.tlvRecords) {
          tlvRecords = JSON.parse(options.tlvRecords);
        }
        const result = await payKeysend(client, {
          pubkey: options.pubkey,
          amount_in_sats: options.amount,
          preimage: options.preimage,
          tlv_records: tlvRecords,
        });
        output(result);
      });
    });
}
