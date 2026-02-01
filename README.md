# Alby NWC CLI

CLI for Nostr Wallet Connect (NIP-47) with lightning tools.

## Usage

```bash
npx @getalby/cli --connection-secret <NWC_CONNECTION_STRING> <command> [options]
```

The `--connection-secret` (or `-c`) option is required for wallet operations. You can get a connection string from your NWC-compatible wallet (e.g., [Alby](https://getalby.com)).

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

# Look up an invoice by payment hash
npx @getalby/cli -c "nostr+walletconnect://..." lookup-invoice --payment-hash "abc123..."

# List transactions
npx @getalby/cli -c "nostr+walletconnect://..." list-transactions --limit 10

# Fetch L402-protected resource
npx @getalby/cli -c "nostr+walletconnect://..." fetch-l402 --url "https://example.com/api"
```

### Lightning Tools

These commands don't require a wallet connection:

```bash
# Convert USD to sats
npx @getalby/cli fiat-to-sats --currency USD --amount 10

# Parse a BOLT-11 invoice
npx @getalby/cli parse-invoice --invoice "lnbc..."

# Request invoice from lightning address
npx @getalby/cli request-invoice --address "hello@getalby.com" --amount 1000
```

## Command Reference

| Command | Description | Required Options |
|---------|-------------|------------------|
| `get-balance` | Get wallet balance | - |
| `get-info` | Get wallet info | - |
| `get-wallet-service-info` | Get wallet capabilities | - |
| `make-invoice` | Create a lightning invoice | `--amount` |
| `pay-invoice` | Pay a lightning invoice | `--invoice` |
| `lookup-invoice` | Look up an invoice | `--payment-hash` or `--invoice` |
| `list-transactions` | List transactions | - |
| `fiat-to-sats` | Convert fiat to sats | `--currency`, `--amount` |
| `parse-invoice` | Parse a BOLT-11 invoice | `--invoice` |
| `request-invoice` | Request invoice from lightning address | `--address`, `--amount` |
| `fetch-l402` | Fetch L402-protected resource | `--url` |

## Output

All commands output JSON to stdout. Errors are output to stderr as JSON with an `error` field.
