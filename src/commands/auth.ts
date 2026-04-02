import { Command } from "commander";
import { NWAClient, NWCClient } from "@getalby/sdk";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { handleError } from "../utils.js";
import { getInfo } from "../tools/nwc/get_info.js";
import { generateSecretKey, getPublicKey } from "nostr-tools";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

function getConnectionSecretPath(name?: string) {
  const filename = name
    ? `connection-secret-${name}.key`
    : "connection-secret.key";
  return join(homedir(), ".alby-cli", filename);
}

function getPendingConnectionSecretPath(name?: string) {
  const filename = name
    ? `pending-connection-secret-${name}.key`
    : "pending-connection-secret.key";
  return join(homedir(), ".alby-cli", filename);
}

async function testAndLogConnection(client: NWCClient) {
  console.log("Testing connection...");
  const info = await getInfo(client);
  console.log(
    `Connected to ${info.alias || "wallet"} (${info.network || "unknown network"})`,
  );
}

function saveConnectionSecret(path: string, secret: string) {
  const alreadyExists = existsSync(path);
  const dir = join(homedir(), ".alby-cli");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, secret, { mode: 0o600 });
  if (alreadyExists) {
    chmodSync(path, 0o600);
  }
  console.log(`Connection saved to ${path}`);
}

export function registerAuthCommand(program: Command) {
  program
    .command("auth [wallet-url]")
    .description(
      "Securely connect a wallet with human confirmation via the browser\n\n" +
        "  Step 1: npx @getalby/cli auth https://my.albyhub.com --app-name MyApp\n" +
        "  Step 2: npx @getalby/cli auth --complete",
    )
    .option("--app-name <name>", "Name of the agent or app that will use this wallet (e.g. \"Claude Code\")")
    .option(
      "--complete",
      "Complete a pending connection after human approves it in the wallet",
    )
    .option("--force", "Overwrite existing connection secret")
    .option(
      "--wallet-name <name>",
      "Save as a named connection instead of the default",
    )
    .action(
      async (
        walletUrl: string | undefined,
        options: {
          appName?: string;
          complete?: boolean;
          force?: boolean;
          walletName?: string;
        },
      ) => {
        await handleError(async () => {
          const connectionSecretPath = getConnectionSecretPath(
            options.walletName,
          );
          const pendingSecretPath = getPendingConnectionSecretPath(
            options.walletName,
          );

          // Step 2: complete a pending connection
          if (options.complete) {
            if (!existsSync(pendingSecretPath)) {
              console.error(
                `Error: No pending connection found at ${pendingSecretPath}\n` +
                  `Run: npx @getalby/cli auth <wallet-url> --app-name <name>`,
              );
              process.exit(1);
            }

            const secret = readFileSync(pendingSecretPath, "utf-8").trim();

            const nwaClient = new NWAClient({
              appSecretKey: secret,
              relayUrls: ["wss://relay.getalby.com/v1"],
              requestMethods: [],
            });

            await new Promise<void>((resolve, reject) => {
              let settled = false;

              const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                unsub?.();
                reject(
                  new Error(
                    "Timed out waiting for wallet approval. Run `npx @getalby/cli auth --complete` to try again.",
                  ),
                );
              }, 5000);

              let unsub: (() => void) | undefined;

              nwaClient
                .subscribe({
                  onSuccess: async (nwcClient) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    unsub?.();

                    await testAndLogConnection(nwcClient);
                    saveConnectionSecret(
                      connectionSecretPath,
                      nwcClient.getNostrWalletConnectUrl(),
                    );
                    rmSync(pendingSecretPath);
                    resolve();
                  },
                })
                .then(({ unsub: u }) => {
                  unsub = u;
                });
            });

            return;
          }

          // Step 1: generate auth URL
          if (walletUrl) {
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

            console.log(
              "Click the following URL to approve the connection in your wallet:\n" +
                authUrl,
            );

            const completeCmd =
              `npx @getalby/cli auth --complete` +
              (options.walletName
                ? ` --wallet-name ${options.walletName}`
                : "");
            console.log(`\nOnce approved, run:\n  ${completeCmd}`);

            return;
          }

          console.error(
            `Usage:\n` +
              `  npx @getalby/cli auth <wallet-url> --app-name <name>\n` +
              `  npx @getalby/cli auth --complete`,
          );
          process.exit(1);
        });
      },
    );
}
