import { Command } from "commander";
import { getBudget } from "../tools/nwc/get_budget.js";
import { getClient, handleError, output } from "../utils.js";

export function registerGetBudgetCommand(program: Command) {
  program
    .command("get-budget")
    .description("Get wallet budget information")
    .action(async () => {
      await handleError(async () => {
        const client = getClient(program);
        const result = await getBudget(client);
        output(result);
      });
    });
}
