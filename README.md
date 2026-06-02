# Alby NWC CLI

CLI for Nostr Wallet Connect (NIP-47) with lightning tools.

Built for agents - best used with the [Alby Bitcoin Payments CLI Skill](https://github.com/getAlby/alby-cli-skill)

## What this CLI can do

Bitcoin lightning wallet operations using Nostr Wallet Connect (NIP-47). Use when the user needs to send/receive bitcoin payments, pay to crypto/stablecoin addresses, check wallet balance, create invoices, convert between fiat and sats, work with lightning addresses, when an HTTP request returns a 402 Payment Required status code and the user wants to pay for and retry the request, or discover paid API services.

## Usage

### First-time setup

The CLI is an interface to a wallet and therefore needs a connection secret.

**Option 1: `auth` — for wallets that support it (e.g. Alby Hub)**

```bash
# Step 1: generate a connection URL and open it in your wallet to approve
# --app-name is the name of the agent/app that will use the wallet via the CLI (e.g. "Claude Code", "OpenClaw")
npx @getalby/cli auth https://my.albyhub.com --app-name "Claude Code"

# Step 2: after approving in the wallet, complete the connection
npx @getalby/cli auth --complete
```

**Option 2: `connect` — paste a NWC connection secret directly**

```bash
npx @getalby/cli connect "nostr+walletconnect://..."
```

Already have a connection secret? Pass it per-command with `-c <secret-or-file>`, or set the `NWC_URL` environment variable.

### Multiple wallets

Use `--wallet-name` when setting up to save named connections:

```bash
npx @getalby/cli connect "nostr+walletconnect://..." --wallet-name work
npx @getalby/cli auth https://my.albyhub.com --app-name "Claude Code" --wallet-name personal
```

Then pass `--wallet-name` to any command to use that wallet:

```bash
npx @getalby/cli --wallet-name work get-balance
npx @getalby/cli --wallet-name personal pay lnbc...
```

List the wallets you've configured (names and connection status only, never the secrets):

```bash
npx @getalby/cli list-wallets
```

## Testing Wallet

For testing the CLI without using real funds, you can create a test wallet using the [NWC Faucet](https://faucet.nwc.dev):

```bash
curl -X POST "https://faucet.nwc.dev?balance=10000"
```

This returns a connection string for a test wallet with 10,000 sats. Test wallets can send payments to each other but cannot interact with the real lightning network.

To top up an existing test wallet:

```bash
curl -X POST "https://faucet.nwc.dev/wallets/<username>/topup?amount=5000"
```

## Commands

Run `npx @getalby/cli help` for the full list of commands and their arguments, or `npx @getalby/cli help <command>` for one command.

Amounts are always given as `--amount` with `--currency` and `--network`; `--currency BTC` additionally requires `--unit sats|BTC`.

## Output

All commands output JSON to stdout. Errors are output to stderr as JSON with an `error` field.
