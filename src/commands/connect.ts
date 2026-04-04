import { Command } from "commander";
import { NWCClient } from "@getalby/sdk";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { handleError } from "../utils.js";
import { getInfo } from "../tools/nwc/get_info.js";

const CONNECTION_SECRET_PATH = join(
  homedir(),
  ".alby-cli",
  "connection-secret.key",
);

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
          const alreadyExists = existsSync(CONNECTION_SECRET_PATH);
          if (alreadyExists && !options.force) {
            console.error(
              `Error: Already connected. Connection secret exists at ${CONNECTION_SECRET_PATH}\n` +
                `To overwrite, use --force.`,
            );
            process.exit(1);
          }

          if (!connectionSecret) {
            console.error(
              `Usage: alby-cli connect "<connection-secret>"\n` +
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

          console.log("Testing connection...");
          const info = await getInfo(client);
          console.log(
            `Connected to ${info.alias || "wallet"} (${info.network || "unknown network"})`,
          );

          const dir = join(homedir(), ".alby-cli");
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
          }
          writeFileSync(CONNECTION_SECRET_PATH, connectionSecret, {
            mode: 0o600,
          });

          if (alreadyExists) {
            chmodSync(CONNECTION_SECRET_PATH, 0o600);
          }

          console.log(`Connection saved to ${CONNECTION_SECRET_PATH}`);
        });
      },
    );
}
