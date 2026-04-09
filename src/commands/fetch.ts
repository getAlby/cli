import { Command } from "commander";
import { fetch402 } from "../tools/lightning/fetch.js";
import { getClient, handleError, output } from "../utils.js";

export function registerFetch402Command(program: Command) {
  program
    .command("fetch")
    .description(
      "Fetch a payment-protected resource (auto-detects L402, X402, MPP)",
    )
    .argument("<url>", "URL to fetch")
    .option("-m, --method <method>", "HTTP method (GET, POST, etc.)")
    .option("-b, --body <json>", "Request body (JSON string)")
    .option("-H, --headers <json>", "Additional headers (JSON string)")
    .option(
      "--max-amount <sats>",
      "Maximum amount in sats to pay per request. Aborts if the endpoint requests more. (default: 5000, 0 = no limit)",
      parseInt,
    )
    .action(async (url, options) => {
      await handleError(async () => {
        const client = await getClient(program);
        const result = await fetch402(client, {
          url: url,
          method: options.method,
          body: options.body,
          headers: options.headers ? JSON.parse(options.headers) : undefined,
          maxAmountSats: options.maxAmount,
        });
        output(result);
      });
    });
}
