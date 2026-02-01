import { Command } from "commander";
import { NWCClient } from "@getalby/sdk";

export function getClient(program: Command): NWCClient {
  const opts = program.opts();
  const connectionSecret = opts.connectionSecret;
  if (!connectionSecret) {
    console.error("Error: --connection-secret is required for this command");
    process.exit(1);
  }
  return new NWCClient({ nostrWalletConnectUrl: connectionSecret });
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
        2
      )
    );
    process.exit(1);
  }
}
