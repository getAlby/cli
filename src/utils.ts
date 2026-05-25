import { Command } from "commander";
import { NWAClient, NWCClient } from "@getalby/sdk";
import { getInfo } from "./tools/nwc/get_info.js";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function getAlbyCliDir() {
  return join(homedir(), ".alby-cli");
}

function sanitizeWalletName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function getConnectionSecretPath(name?: string) {
  const filename = name
    ? `connection-secret-${sanitizeWalletName(name)}.key`
    : "connection-secret.key";
  return join(getAlbyCliDir(), filename);
}

export function getPendingConnectionSecretPath(name?: string) {
  const filename = name
    ? `pending-connection-secret-${sanitizeWalletName(name)}.key`
    : "pending-connection-secret.key";
  return join(getAlbyCliDir(), filename);
}

export function getPendingConnectionRelayPath(name?: string) {
  const filename = name
    ? `pending-connection-relay-${sanitizeWalletName(name)}.txt`
    : "pending-connection-relay.txt";
  return join(getAlbyCliDir(), filename);
}

export interface WalletInfo {
  /** Wallet name, or null for the default (unnamed) wallet. */
  name: string | null;
  isDefault: boolean;
  /** "connected" if a connection secret exists, "pending" if awaiting wallet approval. */
  status: "connected" | "pending";
}

/**
 * List configured wallets by scanning ~/.alby-cli for connection secret files.
 * Never reads or returns secret contents - only wallet names and status.
 */
export function listWallets(): WalletInfo[] {
  const dir = getAlbyCliDir();
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return [];
    throw err;
  }

  // Map of wallet name (null for default) -> status. Connected takes precedence
  // over pending so a re-authed wallet still shows as usable.
  const wallets = new Map<string | null, "connected" | "pending">();

  const patterns: { regex: RegExp; status: "connected" | "pending" }[] = [
    { regex: /^connection-secret(?:-(.+))?\.key$/, status: "connected" },
    { regex: /^pending-connection-secret(?:-(.+))?\.key$/, status: "pending" },
  ];

  for (const file of files) {
    for (const { regex, status } of patterns) {
      const match = file.match(regex);
      if (!match) continue;
      const name = match[1] ?? null;
      if (status === "connected" || !wallets.has(name)) {
        wallets.set(name, wallets.get(name) === "connected" ? "connected" : status);
      }
      break;
    }
  }

  return [...wallets.entries()]
    .map(([name, status]) => ({
      name,
      isDefault: name === null,
      status,
    }))
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
}

export function saveConnectionSecret(
  path: string,
  secret: string,
  verbose: boolean,
) {
  const alreadyExists = existsSync(path);
  const dir = getAlbyCliDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, secret, { mode: 0o600 });
  if (alreadyExists) {
    chmodSync(path, 0o600);
  }
  if (verbose) {
    console.error(`Connection saved to ${path}`);
  }
}

export async function testAndLogConnection(client: NWCClient) {
  console.log("Testing connection...");
  const info = await getInfo(client);
  console.log(
    `Connected to ${info.alias || "wallet"} (${info.network || "unknown network"})`,
  );
}

export async function completePendingConnection(
  pendingSecretPath: string,
  connectionSecretPath: string,
  relayUrl: string | undefined,
  verbose: boolean,
  pendingRelayPath?: string,
): Promise<NWCClient> {
  const secret = readFileSync(pendingSecretPath, "utf-8").trim();

  const DEFAULT_RELAY = "wss://relay.getalby.com/v1";
  if (!relayUrl && pendingRelayPath && existsSync(pendingRelayPath)) {
    relayUrl = readFileSync(pendingRelayPath, "utf-8").trim();
  }
  const resolvedRelay = relayUrl ?? DEFAULT_RELAY;

  const nwaClient = new NWAClient({
    appSecretKey: secret,
    relayUrls: [resolvedRelay],
    requestMethods: [],
  });

  return new Promise<NWCClient>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsub?.();
      reject(
        new Error(
          "Timed out waiting for wallet approval.\n\nTo retry, run the command again.\nTo cancel: npx @getalby/cli auth --remove-pending",
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

          saveConnectionSecret(
            connectionSecretPath,
            nwcClient.getNostrWalletConnectUrl(),
            verbose,
          );
          rmSync(pendingSecretPath);
          if (pendingRelayPath && existsSync(pendingRelayPath)) {
            rmSync(pendingRelayPath);
          }
          resolve(nwcClient);
        },
      })
      .then(({ unsub: u }) => {
        unsub = u;
      });
  });
}

export async function getClient(program: Command): Promise<NWCClient> {
  const opts = program.opts();
  let connectionSecret: string | undefined = opts.connectionSecret;

  const walletName: string | undefined = opts.walletName;
  const connectionPath = getConnectionSecretPath(walletName);
  const pendingPath = getPendingConnectionSecretPath(walletName);

  if (!connectionSecret && !walletName) {
    connectionSecret = process.env.NWC_URL;
  }

  // Check for pending connections BEFORE reading the existing connection file.
  // When `auth --force` is used, the old connection-secret.key still exists.
  // If we read it first, we'd skip the pending connection and silently use
  // the old connection instead of completing the new one.
  if (!connectionSecret && existsSync(pendingPath)) {
    if (opts.verbose) {
      console.error("Pending connection found. Waiting for wallet approval...");
    }
    const pendingRelayPath = getPendingConnectionRelayPath(walletName);
    return await completePendingConnection(
      pendingPath,
      connectionPath,
      undefined,
      opts.verbose,
      pendingRelayPath,
    );
  }

  if (!connectionSecret) {
    try {
      connectionSecret = readFileSync(connectionPath, "utf-8").trim();
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") throw err;
    }
  }

  if (!connectionSecret) {
    throw new Error(
      "No connection secret provided. Pass -c <secret or file path>, set NWC_URL, use --wallet-name <name>, or create ~/.alby-cli/connection-secret.key",
    );
  }

  // Auto-detect: if it doesn't start with the protocol, treat as file path
  if (!connectionSecret.startsWith("nostr+walletconnect://")) {
    try {
      connectionSecret = readFileSync(connectionSecret, "utf-8").trim();
    } catch (error) {
      console.error(
        `Error: Failed to read connection secret file "${opts.connectionSecret}": ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  }

  // Validate the connection string format
  if (!connectionSecret.startsWith("nostr+walletconnect://")) {
    console.error(
      `Error: Invalid connection secret. Expected format: nostr+walletconnect://...\n` +
        `Got: "${connectionSecret.substring(0, 50)}${connectionSecret.length > 50 ? "..." : ""}"\n` +
        `Hint: Make sure the connection string is complete and not truncated.`,
    );
    process.exit(1);
  }

  const client = new NWCClient({ nostrWalletConnectUrl: connectionSecret });

  // Validate client properties
  if (!client.secret || !/^[0-9a-f]{64}$/i.test(client.secret)) {
    console.error(
      `Error: Invalid connection secret. Missing or invalid secret key.\n` +
        `Hint: Make sure the connection string is complete and not truncated.`,
    );
    process.exit(1);
  }

  if (!client.walletPubkey || !/^[0-9a-f]{64}$/i.test(client.walletPubkey)) {
    console.error(
      `Error: Invalid connection secret. Missing or invalid wallet pubkey.\n` +
        `Hint: Make sure the connection string is complete and not truncated.`,
    );
    process.exit(1);
  }

  if (!client.relayUrls) {
    console.error(
      `Error: Invalid connection secret. Missing relay URL.\n` +
        `Hint: Make sure the connection string is complete and not truncated.`,
    );
    process.exit(1);
  }

  return client;
}

export function output(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

export async function handleError(fn: () => Promise<void>) {
  try {
    await fn();
    process.exit(0);
  } catch (error) {
    console.error(
      JSON.stringify(
        { error: error instanceof Error ? error.message : String(error) },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}
