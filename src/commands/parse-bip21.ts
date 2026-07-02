import { Command } from "commander";
import { parseBip21 } from "../tools/lightning/parse_bip21.js";
import { handleError, output } from "../utils.js";

export function registerParseBip21Command(program: Command) {
  program
    .command("parse-bip21")
    .description("Parse a BIP21 bitcoin payment URI")
    .requiredOption("-u, --uri <uri>", "BIP21 URI to parse (bitcoin:...)")
    .addHelpText(
      "after",
      "\nExample:\n" +
        '  $ npx @getalby/cli parse-bip21 --uri "bitcoin:bc1q...?amount=0.001&lightning=lnbc..."\n',
    )
    .action(async (options) => {
      await handleError(async () => {
        const result = parseBip21({ uri: options.uri });
        output(result);
      });
    });
}
