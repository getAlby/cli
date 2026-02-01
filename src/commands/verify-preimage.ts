import { Command } from "commander";
import { verifyPreimage } from "../tools/lightning/verify_preimage.js";
import { handleError, output } from "../utils.js";

export function registerVerifyPreimageCommand(program: Command) {
  program
    .command("verify-preimage")
    .description("Verify a preimage against an invoice")
    .requiredOption("-i, --invoice <bolt11>", "BOLT-11 invoice")
    .requiredOption("--preimage <hex>", "Preimage to verify (32 bytes hex)")
    .action(async (options) => {
      await handleError(async () => {
        const result = verifyPreimage({
          invoice: options.invoice,
          preimage: options.preimage,
        });
        output(result);
      });
    });
}
