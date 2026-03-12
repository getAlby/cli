import { Command } from "commander";
import { fetchX402 } from "../tools/lightning/fetch_x402.js";
import { getClient, handleError, output } from "../utils.js";

export function registerFetchX402Command(program: Command) {
  program
    .command("fetch-x402")
    .description("Fetch X402-protected resource")
    .requiredOption("-u, --url <url>", "URL to fetch")
    .option("-m, --method <method>", "HTTP method (GET, POST, etc.)")
    .option("-b, --body <json>", "Request body (JSON string)")
    .option("-H, --headers <json>", "Additional headers (JSON string)")
    .action(async (options) => {
      await handleError(async () => {
        const client = getClient(program);
        const result = await fetchX402(client, {
          url: options.url,
          method: options.method,
          body: options.body,
          headers: options.headers ? JSON.parse(options.headers) : undefined,
        });
        output(result);
      });
    });
}
