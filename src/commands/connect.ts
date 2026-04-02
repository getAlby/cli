import { Command } from "commander";
import { NWCClient } from "@getalby/sdk";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { handleError } from "../utils.js";
import { getInfo } from "../tools/nwc/get_info.js";

export function getConnectionSecretPath(name?: string) {
  const filename = name
    ? `connection-secret-${name}.key`
    : "connection-secret.key";
  return join(homedir(), ".alby-cli", filename);
}

export function registerConnectCommand(program: Command) {
  program
    .command('connect "[connection-secret]"')
    .description("Connect to a Nostr Wallet Connect wallet")
    .option("--force", "Overwrite existing connection secret")
    .option("--wallet-name <name>", "Save as a named connection instead of the default")
    .action(
      async (
        connectionSecret: string | undefined,
        options: { force?: boolean; walletName?: string },
      ) => {
        await handleError(async () => {
          const connectionSecretPath = getConnectionSecretPath(options.walletName);
          const alreadyExists = existsSync(connectionSecretPath);
          if (alreadyExists && !options.force) {
            console.error(
              `Error: Already connected. Connection secret exists at ${connectionSecretPath}\n` +
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
          writeFileSync(connectionSecretPath, connectionSecret, {
            mode: 0o600,
          });

          if (alreadyExists) {
            chmodSync(connectionSecretPath, 0o600);
          }

          console.log(`Connection saved to ${connectionSecretPath}`);
        });
      },
    );
}
