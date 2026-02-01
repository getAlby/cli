import { Command } from "commander";
import { signMessage } from "../tools/nwc/sign_message.js";
import { getClient, handleError, output } from "../utils.js";

export function registerSignMessageCommand(program: Command) {
  program
    .command("sign-message")
    .description("Sign a message with the wallet's key")
    .requiredOption("-m, --message <text>", "Message to sign")
    .action(async (options) => {
      await handleError(async () => {
        const client = getClient(program);
        const result = await signMessage(client, {
          message: options.message,
        });
        output(result);
      });
    });
}
