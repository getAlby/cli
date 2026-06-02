import { Command } from "commander";
import { payKeysend, TlvRecord } from "../tools/nwc/pay_keysend.js";
import { getClient, handleError, output, parseSatsOption } from "../utils.js";

export function registerPayKeysendCommand(program: Command) {
  program
    .command("pay-keysend")
    .description("Send a keysend payment to a node")
    .requiredOption("-p, --pubkey <hex>", "Destination node public key")
    .requiredOption("--amount-sats <sats>", "Amount in sats", parseSatsOption())
    .option("--preimage <hex>", "Preimage (optional, will be generated if not provided)")
    .option("--tlv-records <json>", "TLV records as JSON array [{type, value}]")
    .action(async (options) => {
      await handleError(async () => {
        const client = await getClient(program);
        let tlvRecords: TlvRecord[] | undefined;
        if (options.tlvRecords) {
          tlvRecords = JSON.parse(options.tlvRecords);
        }
        const result = await payKeysend(client, {
          pubkey: options.pubkey,
          amount_in_sats: options.amountSats,
          preimage: options.preimage,
          tlv_records: tlvRecords,
        });
        output(result);
      });
    });
}
