import { Command } from "commander";
import { NWCClient } from "@getalby/sdk";
import { readFileSync } from "node:fs";

export function getClient(program: Command): NWCClient {
  const opts = program.opts();
  let connectionSecret: string | undefined = opts.connectionSecret;

  // Check environment variables if --connection-secret not provided
  if (!connectionSecret) {
    connectionSecret = process.env.NWC_URL || process.env.NWC_SECRET;
  }

  if (!connectionSecret) {
    console.error("Error: --connection-secret is required for this command");
    process.exit(1);
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
