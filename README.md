# Alby NWC CLI

CLI for Nostr Wallet Connect (NIP-47) with lightning tools.

Built for agents - use with the [Alby Bitcoin Payments CLI Skill](https://github.com/getAlby/alby-cli-skill)

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

### Multiple wallets

Use `--wallet-name` when setting up to save named connections:

```bash
npx @getalby/cli connect "nostr+walletconnect://..." --wallet-name work
npx @getalby/cli auth https://my.albyhub.com --app-name "Claude Code" --wallet-name personal
```

Then pass `--wallet-name` to any command to use that wallet:

```bash
npx @getalby/cli --wallet-name work get-balance
npx @getalby/cli --wallet-name personal pay-invoice --invoice lnbc...
```

### Connection secret resolution (in order of priority)

1. `--connection-secret` flag (value or path to file)
2. `--wallet-name` flag (`~/.alby-cli/connection-secret-<name>.key`)
3. `NWC_URL` environment variable
4. `~/.alby-cli/connection-secret.key` (default file location)

```bash
# Use the default saved wallet connection (preferred)
npx @getalby/cli <command> [options]

# Use a named wallet
npx @getalby/cli --wallet-name alice <command> [options]

# Or pass a connection secret directly
npx @getalby/cli -c /path/to/secret.txt <command> [options]
```

The `-c` option auto-detects whether you're passing a connection string or a file path. You can get a connection string from your NWC-compatible wallet (e.g., [Alby](https://getalby.com)).

You can also set the `NWC_URL` environment variable instead of using the `-c` option:

```txt
NWC_URL="nostr+walletconnect://..."
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

### Wallet Commands

These commands require a wallet connection - either default connection, or specify a custom connection with `-w`, '-c', or `NWC_URL` environment variable:

```bash
# Get wallet balance
npx @getalby/cli get-balance

# Get wallet info
npx @getalby/cli get-info

# Get wallet service capabilities
npx @getalby/cli get-wallet-service-info

# Create an invoice
npx @getalby/cli make-invoice --amount 1000 --description "Payment"

# Pay an invoice
npx @getalby/cli pay-invoice --invoice "lnbc..."

# Send a keysend payment
npx @getalby/cli pay-keysend --pubkey "02abc..." --amount 100

# Look up an invoice by payment hash
npx @getalby/cli lookup-invoice --payment-hash "abc123..."

# List transactions
npx @getalby/cli list-transactions --limit 10

# Get wallet budget
npx @getalby/cli get-budget

# Sign a message
npx @getalby/cli sign-message --message "Hello, World!"

# Fetch a payment-protected resource (auto-detects L402, X402, MPP)
npx @getalby/cli fetch --url "https://example.com/api"

# Fetch with custom method, headers, and body
npx @getalby/cli fetch --url "https://example.com/api" --method POST --body '{"query":"hello"}' --headers '{"Accept":"application/json"}'

# Fetch with a custom max amount (default: 5000 sats, 0 = no limit)
npx @getalby/cli fetch --url "https://example.com/api" --max-amount 1000

# Wait for a payment notification
npx @getalby/cli wait-for-payment --payment-hash "abc123..."
```

### HOLD Invoices

HOLD invoices allow you to accept payments conditionally - the payment is held until you settle or cancel it.

```bash
# Create a HOLD invoice (you provide the payment hash)
npx @getalby/cli make-hold-invoice --amount 1000 --payment-hash "abc123..."

# Settle a HOLD invoice (claim the payment)
npx @getalby/cli settle-hold-invoice --preimage "def456..."

# Cancel a HOLD invoice (reject the payment)
npx @getalby/cli cancel-hold-invoice --payment-hash "abc123..."
```

### Lightning Tools

These commands don't require a wallet connection:

```bash
# Convert USD to sats
npx @getalby/cli fiat-to-sats --currency USD --amount 10

# Convert sats to USD
npx @getalby/cli sats-to-fiat --amount 1000 --currency USD

# Parse a BOLT-11 invoice
npx @getalby/cli parse-invoice --invoice "lnbc..."

# Verify a preimage against an invoice
npx @getalby/cli verify-preimage --invoice "lnbc..." --preimage "abc123..."

# Request invoice from lightning address
npx @getalby/cli request-invoice-from-lightning-address --address "hello@getalby.com" --amount 1000
```

## Command Reference

Run `npx @getalby/cli help` for a full list of commands and possible arguments.

## Output

All commands output JSON to stdout. Errors are output to stderr as JSON with an `error` field.
