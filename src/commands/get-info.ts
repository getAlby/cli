import { Command } from "commander";
import { getInfo } from "../tools/nwc/get_info.js";
import { getClient, handleError, output } from "../utils.js";

export function registerGetInfoCommand(program: Command) {
  program
    .command("get-info")
    .description("Get wallet info")
    .action(async () => {
      await handleError(async () => {
        const client = getClient(program);
        const result = await getInfo(client);
        output(result);
      });
    });
}
