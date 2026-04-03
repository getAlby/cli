import { Command } from "commander";
import { NWCClient } from "@getalby/sdk";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  getConnectionSecretPath,
  getPendingConnectionRelayPath,
  getPendingConnectionSecretPath,
  handleError,
  saveConnectionSecret,
  testAndLogConnection,
} from "../utils.js";
import { generateSecretKey, getPublicKey } from "nostr-tools";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

export function registerAuthCommand(program: Command) {
  program
    .command("auth <wallet-url>")
    .description(
      "Securely connect a wallet with human confirmation via the browser\n\n" +
        "  Step 1: npx @getalby/cli auth https://my.albyhub.com --app-name MyApp\n" +
        "  Step 2: after human confirmation, run any command to finalize the connection",
    )
    .option(
      "--app-name <name>",
      'Name of the agent or app that will use this wallet (e.g. "Claude Code")',
    )
    .option(
      "--relay-url <url>",
      "Relay URL for the pending connection",
      "wss://relay.getalby.com/v1",
    )
    .option("--force", "Overwrite existing connection secret")
    .option("--remove-pending", "Remove a pending connection and start fresh")
    .action(
      async (
        walletUrl: string,
        options: {
          appName?: string;
          force?: boolean;
          relayUrl: string;
          removePending?: boolean;
        },
      ) => {
        await handleError(async () => {
          const walletName: string | undefined = program.opts().walletName;
          const connectionSecretPath = getConnectionSecretPath(walletName);
          const pendingSecretPath = getPendingConnectionSecretPath(walletName);

          const pendingRelayPath = getPendingConnectionRelayPath(walletName);

          // Remove pending connection
          if (options.removePending) {
            if (!existsSync(pendingSecretPath)) {
              console.log(
                `No pending connection found at ${pendingSecretPath}`,
              );
            } else {
              rmSync(pendingSecretPath);
              console.log(`Removed pending connection at ${pendingSecretPath}`);
            }
            if (existsSync(pendingRelayPath)) {
              rmSync(pendingRelayPath);
            }
            return;
          }

          // Generate auth URL
          if (!options.appName) {
            console.error(
              `Error: No app name provided.\n` +
                `Add --app-name <name> to identify the app in the wallet.`,
            );
            process.exit(1);
          }

          if (existsSync(connectionSecretPath) && !options.force) {
            console.error(
              `Error: Already connected. Connection secret exists at ${connectionSecretPath}\n` +
                `To overwrite, use --force.`,
            );
            process.exit(1);
          }

          const secret = bytesToHex(generateSecretKey());
          const pubkey = getPublicKey(hexToBytes(secret));

          const authUrl = NWCClient.getAuthorizationUrl(
            `${walletUrl}/apps/new`,
            { name: options.appName },
            pubkey,
          ).toString();

          const dir = join(homedir(), ".alby-cli");
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
          }
          writeFileSync(pendingSecretPath, secret, { mode: 0o600 });
          writeFileSync(pendingRelayPath, options.relayUrl, { mode: 0o600 });

          console.log(
            "Click the following URL to approve the connection in your wallet:\n" +
              authUrl,
          );

          const retryCmd = walletName
            ? `npx @getalby/cli get-balance --wallet-name ${walletName}`
            : `npx @getalby/cli get-balance`;
          console.log(
            `\nOnce approved, run any command, e.g.:\n  ${retryCmd}`,
          );
        });
      },
    );
}
