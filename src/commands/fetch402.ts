import { Command } from "commander";
import { fetch402 } from "../tools/lightning/fetch402.js";
import { getClient, handleError, output } from "../utils.js";

export function registerFetch402Command(program: Command) {
  program
    .command("402")
    .description("Fetch a payment-protected resource (auto-detects L402, X402, MPP)")
    .requiredOption("-u, --url <url>", "URL to fetch")
    .option("-m, --method <method>", "HTTP method (GET, POST, etc.)")
    .option("-b, --body <json>", "Request body (JSON string)")
    .option("-H, --headers <json>", "Additional headers (JSON string)")
    .action(async (options) => {
      await handleError(async () => {
        const client = getClient(program);
        const result = await fetch402(client, {
          url: options.url,
          method: options.method,
          body: options.body,
          headers: options.headers ? JSON.parse(options.headers) : undefined,
        });
        output(result);
      });
    });
}
