import { Command } from "commander";
import { NWCClient } from "@getalby/sdk";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { handleError } from "../utils.js";

const CONNECTION_SECRET_PATH = join(
  homedir(),
  ".alby-cli",
  "connection-secret.key",
);

export function registerConnectCommand(program: Command) {
  program
    .command("connect [connection-secret]")
    .description("Connect to a Nostr Wallet Connect wallet")
    .action(async (connectionSecret: string | undefined) => {
      await handleError(async () => {
        if (existsSync(CONNECTION_SECRET_PATH)) {
          console.error(
            `Error: Already connected. Connection secret exists at ${CONNECTION_SECRET_PATH}\n` +
              `To reconnect, remove the existing file first.`,
          );
          process.exit(1);
        }

        if (!connectionSecret) {
          console.error(
            `Usage: alby-cli connect <connection-secret>\n` +
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

        const dir = join(homedir(), ".alby-cli");
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(CONNECTION_SECRET_PATH, connectionSecret, {
          mode: 0o600,
        });

        console.log(`Connection saved to ${CONNECTION_SECRET_PATH}`);
      });
    });
}
