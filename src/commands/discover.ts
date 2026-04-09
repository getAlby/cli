import { Command } from "commander";
import { discover } from "../tools/lightning/discover.js";
import { handleError, output } from "../utils.js";

export function registerDiscoverCommand(program: Command) {
  program
    .command("discover")
    .description(
      "Search 402index.io for paid API services that accept bitcoin/lightning",
    )
    .option("-q, --query <text>", "Search query")
    .option(
      "-C, --category <category>",
      "Filter by category (e.g. ai, data, bitcoin, nostr)",
    )
    .option(
      "-p, --protocol <protocol>",
      "Filter by protocol (L402, x402, MPP)",
    )
    .option(
      "--health <status>",
      "Filter by health (healthy, degraded, down, unknown)",
      "healthy",
    )
    .option(
      "-s, --sort <field>",
      "Sort by (reliability, latency, price, name)",
      "reliability",
    )
    .option("-l, --limit <number>", "Number of results", "10")
    .action(async (options) => {
      await handleError(async () => {
        const result = await discover({
          query: options.query,
          category: options.category,
          protocol: options.protocol,
          health: options.health,
          sort: options.sort,
          limit: parseInt(options.limit, 10),
        });
        output(result);
      });
    });
}
