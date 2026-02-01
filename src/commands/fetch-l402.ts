import { Command } from "commander";
import { fetchL402 } from "../tools/lightning/fetch_l402.js";
import { getClient, handleError, output } from "../utils.js";

export function registerFetchL402Command(program: Command) {
  program
    .command("fetch-l402")
    .description("Fetch L402-protected resource")
    .requiredOption("-u, --url <url>", "URL to fetch")
    .option("-m, --method <method>", "HTTP method (GET, POST, etc.)")
    .option("-b, --body <json>", "Request body (JSON string)")
    .option("-H, --headers <json>", "Additional headers (JSON string)")
    .action(async (options) => {
      await handleError(async () => {
        const client = getClient(program);
        const result = await fetchL402(client, {
          url: options.url,
          method: options.method,
          body: options.body,
          headers: options.headers ? JSON.parse(options.headers) : undefined,
        });
        output(result);
      });
    });
}
