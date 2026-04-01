import { Command } from "commander";
import { fetchMpp } from "../tools/lightning/fetch_mpp.js";
import { getClient, handleError, output } from "../utils.js";

export function registerFetchMppCommand(program: Command) {
  program
    .command("fetch-mpp")
    .description("Fetch MPP-protected resource")
    .requiredOption("-u, --url <url>", "URL to fetch")
    .option("-m, --method <method>", "HTTP method (GET, POST, etc.)")
    .option("-b, --body <json>", "Request body (JSON string)")
    .option("-H, --headers <json>", "Additional headers (JSON string)")
    .action(async (options) => {
      await handleError(async () => {
        const client = getClient(program);
        const result = await fetchMpp(client, {
          url: options.url,
          method: options.method,
          body: options.body,
          headers: options.headers ? JSON.parse(options.headers) : undefined,
        });
        output(result);
      });
    });
}
