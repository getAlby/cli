import { Command } from "commander";
import { NWCClient } from "@getalby/sdk";
import { existsSync } from "node:fs";
import {
  getConnectionSecretPath,
  handleError,
  saveConnectionSecret,
  testAndLogConnection,
} from "../utils.js";

export function registerConnectCommand(program: Command) {
  program
    .command('connect "[connection-secret]"')
    .description("Connect to a Nostr Wallet Connect wallet")
    .option("--force", "Overwrite existing connection secret")
    .action(
      async (
        connectionSecret: string | undefined,
        options: { force?: boolean },
      ) => {
        await handleError(async () => {
          const connectionSecretPath = getConnectionSecretPath(
            program.opts().walletName,
          );
          if (existsSync(connectionSecretPath) && !options.force) {
            console.error(
              `Error: Already connected. Connection secret exists at ${connectionSecretPath}\n` +
                `To overwrite, use --force.`,
            );
            process.exit(1);
          }

          if (!connectionSecret) {
            console.error(
              `Usage: npx @getalby/cli connect "<connection-secret>"\n` +
                `Provide a NWC connection secret (nostr+walletconnect://...)`,
            );
            process.exit(1);
          }

          if (!connectionSecret.startsWith("nostr+walletconnect://")) {
            console.error(
              `Error: Invalid connection secret. Expected format: nostr+walletconnect://...`,
            );
            process.exit(1);
          }

          const client = new NWCClient({
            nostrWalletConnectUrl: connectionSecret,
          });

          if (!client.secret || !/^[0-9a-f]{64}$/i.test(client.secret)) {
            console.error(
              `Error: Invalid connection secret. Missing or invalid secret key.`,
            );
            process.exit(1);
          }

          if (
            !client.walletPubkey ||
            !/^[0-9a-f]{64}$/i.test(client.walletPubkey)
          ) {
            console.error(
              `Error: Invalid connection secret. Missing or invalid wallet pubkey.`,
            );
            process.exit(1);
          }

          if (!client.relayUrls?.length) {
            console.error(
              `Error: Invalid connection secret. Missing relay URL.`,
            );
            process.exit(1);
          }

          await testAndLogConnection(client);

          saveConnectionSecret(
            connectionSecretPath,
            connectionSecret,
            program.opts().verbose,
          );
        });
      },
    );
}
