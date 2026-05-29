import { Command } from "commander";
import { LN_ADDRESS_REGEX } from "@getalby/lightning-tools";
import { payInvoice } from "../tools/nwc/pay_invoice.js";
import { payKeysend, TlvRecord } from "../tools/nwc/pay_keysend.js";
import { requestInvoiceFromLightningAddress } from "../tools/lightning/request_invoice_from_lightning_address.js";
import {
  isPlausibleEvmAddress,
  payCrypto,
  findSupportedPair,
} from "../lendaswap/swap.js";
import { getClient, handleError, output } from "../utils.js";

type DestinationType = "crypto" | "invoice" | "lightning-address" | "keysend";

type TransactionMetadata = {
  comment?: string; // LUD-12
  recipient_data?: {
    identifier?: string;
  };
} & Record<string, unknown>;

function detectDestinationType(destination: string): DestinationType | null {
  if (/^0x[0-9a-fA-F]{40}$/.test(destination)) return "crypto";
  // BOLT-11 prefixes: lnbc = mainnet, lntb = testnet/signet, lnbcrt = regtest, lntbs = signet (e.g. mutinynet).
  if (/^ln(bcrt|tbs|bc|tb)/i.test(destination)) return "invoice";
  if (LN_ADDRESS_REGEX.test(destination)) return "lightning-address";
  if (/^0[23][0-9a-fA-F]{64}$/.test(destination)) return "keysend";
  return null;
}

const ALLOWED_OPTS: Record<DestinationType, ReadonlyArray<string>> = {
  invoice: ["amount"],
  "lightning-address": ["amount", "comment"],
  keysend: ["amount", "preimage", "tlvRecords"],
  crypto: ["amount", "currency", "network"],
};

const OPT_FLAG: Record<string, string> = {
  amount: "--amount",
  comment: "--comment",
  preimage: "--preimage",
  tlvRecords: "--tlv-records",
  currency: "--currency",
  network: "--network",
};

function rejectUnusedOpts(
  type: DestinationType,
  options: Record<string, unknown>,
  providedKeys: Set<string>,
) {
  const allowed = new Set(ALLOWED_OPTS[type]);
  const used = Object.keys(options).filter((k) => providedKeys.has(k));
  const stray = used.filter((k) => !allowed.has(k));
  if (stray.length > 0) {
    throw new Error(
      `Option${stray.length > 1 ? "s" : ""} ${stray.map((k) => OPT_FLAG[k] ?? `--${k}`).join(", ")} not applicable to ${type} payment`,
    );
  }
}

export function registerPayCommand(program: Command) {
  program
    .command("pay")
    .description(
      "Pay any supported destination — auto-detects type from the destination string.\n\n" +
        "Supported destinations:\n" +
        "  - BOLT-11 invoice (lnbc... / lntb... / lnbcrt... / lntbs...): no extra args (use --amount only for zero-amount invoices)\n" +
        "  - Lightning address (user@domain): requires --amount (sats); optional --comment\n" +
        "  - Node pubkey (66-char hex, compressed secp256k1): keysend, requires --amount (sats)\n" +
        "  - EVM address (0x...): pay crypto/stablecoin, requires --amount, --currency, and --network",
    )
    .argument(
      "<destination>",
      "Invoice, lightning address, node pubkey, or EVM address",
    )
    .option(
      "-a, --amount <number>",
      "Amount — sats for lightning destinations, target-currency units for crypto (e.g. 10 = 10 USDC)",
      Number,
    )
    .option("--comment <text>", "Comment for lightning address payments")
    .option(
      "--preimage <hex>",
      "Preimage for keysend (optional, generated if omitted)",
    )
    .option(
      "--tlv-records <json>",
      "TLV records for keysend, as JSON array [{type, value}]",
    )
    .option(
      "--currency <name>",
      "Target currency for crypto payments (required for EVM destinations)",
    )
    .option(
      "--network <name>",
      "Target network for crypto payments — chain name or id (required for EVM destinations)",
    )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  $ npx @getalby/cli pay lnbc1...\n" +
        "  $ npx @getalby/cli pay alice@getalby.com --amount 100 --comment hi\n" +
        "  $ npx @getalby/cli pay 02aabb... --amount 100\n" +
        "  $ npx @getalby/cli pay 0xabc... --amount 10 --currency USDC --network arbitrum\n",
    )
    .action(async (destination: string, options, cmd: Command) => {
      await handleError(async () => {
        const type = detectDestinationType(destination);
        if (!type) {
          throw new Error(
            `Could not detect destination type for: ${destination}\n` +
              "Expected one of:\n" +
              "  - BOLT-11 invoice (starts with lnbc, lntb, lnbcrt, or lntbs)\n" +
              "  - Lightning address (user@domain)\n" +
              "  - Node pubkey for keysend (66-char hex, compressed secp256k1: starts with 02/03)\n" +
              "  - EVM address (0x + 40 hex characters)",
          );
        }

        // Track which options the user *explicitly* set (vs. defaults from
        // commander) so we only reject stray flags the user actually typed.
        const providedKeys = new Set<string>();
        for (const opt of cmd.options) {
          const key = opt.attributeName();
          const src = cmd.getOptionValueSource(key);
          if (src === "cli" || src === "env") {
            providedKeys.add(key);
          }
        }
        rejectUnusedOpts(type, options, providedKeys);

        switch (type) {
          case "invoice": {
            if (
              options.amount !== undefined &&
              !Number.isInteger(options.amount)
            ) {
              throw new Error(
                `Invalid --amount: must be an integer number of sats`,
              );
            }
            const client = await getClient(program);
            const result = await payInvoice(client, {
              invoice: destination,
              amount_in_sats: options.amount,
              metadata: {},
            });
            output(result);
            return;
          }
          case "lightning-address": {
            if (options.amount === undefined) {
              throw new Error(
                "Lightning address payments require --amount <sats>",
              );
            }
            if (!Number.isInteger(options.amount) || options.amount <= 0) {
              throw new Error(
                `Invalid --amount: must be a positive integer number of sats`,
              );
            }
            const invoice = await requestInvoiceFromLightningAddress({
              lightning_address: destination,
              amount_in_sats: options.amount,
              comment: options.comment,
            });
            const client = await getClient(program);
            // Stash identifier + comment on the payment record so the wallet
            // can show who was paid even when the LNURL server drops them
            // from the invoice memo.
            const metadata: TransactionMetadata = {
              ...(options.comment && { comment: options.comment }),
              recipient_data: { identifier: destination },
            };
            const result = await payInvoice(client, {
              invoice: invoice.paymentRequest,
              metadata,
            });
            output(result);
            return;
          }
          case "keysend": {
            if (options.amount === undefined) {
              throw new Error("Keysend payments require --amount <sats>");
            }
            if (!Number.isInteger(options.amount) || options.amount <= 0) {
              throw new Error(
                `Invalid --amount: must be a positive integer number of sats`,
              );
            }
            let tlvRecords: TlvRecord[] | undefined;
            if (options.tlvRecords) {
              tlvRecords = JSON.parse(options.tlvRecords);
            }
            const client = await getClient(program);
            const result = await payKeysend(client, {
              pubkey: destination,
              amount_in_sats: options.amount,
              preimage: options.preimage,
              tlv_records: tlvRecords,
            });
            output(result);
            return;
          }
          case "crypto": {
            if (options.amount === undefined) {
              throw new Error("Crypto payments require --amount <number>");
            }
            if (!Number.isFinite(options.amount) || options.amount <= 0) {
              throw new Error(`Invalid --amount: ${options.amount}`);
            }
            if (!options.currency) {
              throw new Error("Crypto payments require --currency <name>");
            }
            if (!options.network) {
              throw new Error(
                "Crypto payments require --network <chain-name-or-id>",
              );
            }
            if (!isPlausibleEvmAddress(destination)) {
              throw new Error(
                `Recipient address does not look valid (expected 0x + 40 hex chars): ${destination}`,
              );
            }
            const pair = await findSupportedPair(
              options.currency,
              options.network,
            );
            const nwc = await getClient(program);
            const { swapId } = await payCrypto({
              pair,
              amount: options.amount,
              targetAddress: destination,
              payInvoice: async (bolt11Invoice) => {
                await payInvoice(nwc, { invoice: bolt11Invoice });
              },
            });
            output({
              swap_id: swapId,
              status: "completed",
              target: {
                address: destination,
                currency: pair.symbol,
                network: pair.network,
                amount: options.amount,
              },
            });
            return;
          }
        }
      });
    });
}
