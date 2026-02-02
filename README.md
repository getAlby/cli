# Alby NWC CLI

CLI for Nostr Wallet Connect (NIP-47) with lightning tools.

Built for agents - use with the [Alby Bitcoin Payments CLI Skill](https://github.com/getAlby/alby-cli-skill)

## Usage

```bash
# Pass a file path to a connection secret (preferred)
npx @getalby/cli -c /path/to/secret.txt <command> [options]

# Or pass connection string directly
npx @getalby/cli -c "nostr+walletconnect://..." <command> [options]
```

The `-c` option auto-detects whether you're passing a connection string or a file path. You can get a connection string from your NWC-compatible wallet (e.g., [Alby](https://getalby.com)).

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

These commands require `--connection-secret`:

```bash
# Get wallet balance
npx @getalby/cli -c "nostr+walletconnect://..." get-balance

# Get wallet info
npx @getalby/cli -c "nostr+walletconnect://..." get-info

# Get wallet service capabilities
npx @getalby/cli -c "nostr+walletconnect://..." get-wallet-service-info

# Create an invoice
npx @getalby/cli -c "nostr+walletconnect://..." make-invoice --amount 1000 --description "Payment"

# Pay an invoice
npx @getalby/cli -c "nostr+walletconnect://..." pay-invoice --invoice "lnbc..."

# Send a keysend payment
npx @getalby/cli -c "nostr+walletconnect://..." pay-keysend --pubkey "02abc..." --amount 100

# Look up an invoice by payment hash
npx @getalby/cli -c "nostr+walletconnect://..." lookup-invoice --payment-hash "abc123..."

# List transactions
npx @getalby/cli -c "nostr+walletconnect://..." list-transactions --limit 10

# Get wallet budget
npx @getalby/cli -c "nostr+walletconnect://..." get-budget

# Sign a message
npx @getalby/cli -c "nostr+walletconnect://..." sign-message --message "Hello, World!"

# Fetch L402-protected resource
npx @getalby/cli -c "nostr+walletconnect://..." fetch-l402 --url "https://example.com/api"

# Wait for a payment notification
npx @getalby/cli -c "nostr+walletconnect://..." wait-for-payment --payment-hash "abc123..."
```

### HOLD Invoices

HOLD invoices allow you to accept payments conditionally - the payment is held until you settle or cancel it.

```bash
# Create a HOLD invoice (you provide the payment hash)
npx @getalby/cli -c "nostr+walletconnect://..." make-hold-invoice --amount 1000 --payment-hash "abc123..."

# Settle a HOLD invoice (claim the payment)
npx @getalby/cli -c "nostr+walletconnect://..." settle-hold-invoice --preimage "def456..."

# Cancel a HOLD invoice (reject the payment)
npx @getalby/cli -c "nostr+walletconnect://..." cancel-hold-invoice --payment-hash "abc123..."
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

### Wallet Commands

These require `-c` or `--connection-secret`:

| Command                   | Description                    | Required Options                |
| ------------------------- | ------------------------------ | ------------------------------- |
| `get-balance`             | Get wallet balance             | -                               |
| `get-info`                | Get wallet info                | -                               |
| `get-wallet-service-info` | Get wallet capabilities        | -                               |
| `get-budget`              | Get wallet budget              | -                               |
| `make-invoice`            | Create a lightning invoice     | `--amount`                      |
| `pay-invoice`             | Pay a lightning invoice        | `--invoice`                     |
| `pay-keysend`             | Send a keysend payment         | `--pubkey`, `--amount`          |
| `lookup-invoice`          | Look up an invoice             | `--payment-hash` or `--invoice` |
| `list-transactions`       | List transactions              | -                               |
| `sign-message`            | Sign a message with wallet key | `--message`                     |
| `wait-for-payment`        | Wait for payment notification  | `--payment-hash`                |
| `fetch-l402`              | Fetch L402-protected resource  | `--url`                         |

### HOLD Invoice Commands

These require `-c` or `--connection-secret`:

| Command               | Description           | Required Options             |
| --------------------- | --------------------- | ---------------------------- |
| `make-hold-invoice`   | Create a HOLD invoice | `--amount`, `--payment-hash` |
| `settle-hold-invoice` | Settle a HOLD invoice | `--preimage`                 |
| `cancel-hold-invoice` | Cancel a HOLD invoice | `--payment-hash`             |

### Lightning Tools

These don't require a wallet connection:

| Command                                  | Description                            | Required Options          |
| ---------------------------------------- | -------------------------------------- | ------------------------- |
| `fiat-to-sats`                           | Convert fiat to sats                   | `--currency`, `--amount`  |
| `sats-to-fiat`                           | Convert sats to fiat                   | `--amount`, `--currency`  |
| `parse-invoice`                          | Parse a BOLT-11 invoice                | `--invoice`               |
| `verify-preimage`                        | Verify preimage against invoice        | `--invoice`, `--preimage` |
| `request-invoice-from-lightning-address` | Request invoice from lightning address | `--address`, `--amount`   |

## Output

All commands output JSON to stdout. Errors are output to stderr as JSON with an `error` field.
