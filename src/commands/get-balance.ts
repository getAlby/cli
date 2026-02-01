import { Command } from "commander";
import { getBalance } from "../tools/nwc/get_balance.js";
import { getClient, handleError, output } from "../utils.js";

export function registerGetBalanceCommand(program: Command) {
  program
    .command("get-balance")
    .description("Get wallet balance")
    .action(async () => {
      await handleError(async () => {
        const client = getClient(program);
        const result = await getBalance(client);
        output(result);
      });
    });
}
