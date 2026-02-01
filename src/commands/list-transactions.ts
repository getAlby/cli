import { Command } from "commander";
import { listTransactions } from "../tools/nwc/list_transactions.js";
import { getClient, handleError, output } from "../utils.js";

export function registerListTransactionsCommand(program: Command) {
  program
    .command("list-transactions")
    .description("List transactions")
    .option("-f, --from <timestamp>", "Start time (unix timestamp)", parseInt)
    .option("-u, --until <timestamp>", "End time (unix timestamp)", parseInt)
    .option("-l, --limit <n>", "Max results", parseInt)
    .option("-o, --offset <n>", "Offset", parseInt)
    .option("--unpaid", "Include unpaid")
    .option("-t, --type <type>", "Filter by type (incoming|outgoing)")
    .action(async (options) => {
      await handleError(async () => {
        const client = getClient(program);
        const result = await listTransactions(client, {
          from: options.from,
          until: options.until,
          limit: options.limit,
          offset: options.offset,
          unpaid: options.unpaid,
          type: options.type,
        });
        output(result);
      });
    });
}
