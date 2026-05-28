import { Command } from "commander";
import { getAlbyCliDir, handleError, listWallets, output } from "../utils.js";

export function registerListWalletsCommand(program: Command) {
  program
    .command("list-wallets")
    .description(
      "List configured wallets (names and connection status only, no secrets)",
    )
    .action(async () => {
      await handleError(async () => {
        const wallets = listWallets();
        output({ directory: getAlbyCliDir(), wallets });
      });
    });
}
