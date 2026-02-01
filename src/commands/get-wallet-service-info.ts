import { Command } from "commander";
import { getWalletServiceInfo } from "../tools/nwc/get_wallet_service_info.js";
import { getClient, handleError, output } from "../utils.js";

export function registerGetWalletServiceInfoCommand(program: Command) {
  program
    .command("get-wallet-service-info")
    .description("Get wallet service capabilities")
    .action(async () => {
      await handleError(async () => {
        const client = getClient(program);
        const result = await getWalletServiceInfo(client);
        output(result);
      });
    });
}
