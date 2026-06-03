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
import {
  parseAmountNumber,
  classifyRail,
  resolveLightningSats,
} from "../amount.js";

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

// Which flags each destination accepts. The amount axes (amount/currency/
// unit/network) are shared by every lightning destination; the crypto rail
// has no sub-unit, so `unit` is excluded there.
const ALLOWED_OPTS: Record<DestinationType, ReadonlyArray<string>> = {
  invoice: ["amount", "currency", "unit", "network"],
  "lightning-address": ["amount", "currency", "unit", "network", "comment"],
  keysend: ["amount", "currency", "unit", "network", "preimage", "tlvRecords"],
  crypto: ["amount", "currency", "network"],
};

const OPT_FLAG: Record<string, string> = {
  amount: "--amount",
  currency: "--currency",
  unit: "--unit",
  network: "--network",
  comment: "--comment",
  preimage: "--preimage",
  tlvRecords: "--tlv-records",
};

function rejectUnusedOpts(
  type: DestinationType,
  options: Record<string, unknown>,
  providedKeys: Set<string>,
) {
  const allowed = new Set(ALLOWED_OPTS[type]);
  const used = Object.keys(options).filter((k) => providedKeys.has(k));
  const stray = used.filter((k) => !allowed.has(k));
  if (stray.length === 0) {
    return;
  }
  // --unit is the most likely cross-rail mistake: it's only valid for BTC
  // (a lightning destination), never for a crypto-token payment.
  if (stray.includes("unit") && type === "crypto") {
    throw new Error(
      "Option --unit is not valid for crypto payments — only BTC has sub-units (sats/BTC)",
    );
  }
  throw new Error(
    `Option${stray.length > 1 ? "s" : ""} ${stray.map((k) => OPT_FLAG[k] ?? `--${k}`).join(", ")} not applicable to ${type} payment`,
  );
}

export function registerPayCommand(program: Command) {
  program
    .command("pay")
    .description(
      "Pay any supported destination — auto-detects type from the destination string.\n\n" +
        "Supported destinations:\n" +
        "  - BOLT-11 invoice (lnbc... / lntb... / lnbcrt... / lntbs...): no amount flags (the invoice encodes the amount; pass --amount/--currency/--network only for a zero-amount invoice)\n" +
        "  - Lightning address (user@domain): requires --amount, --currency, --network lightning (and --unit for BTC); optional --comment\n" +
        "  - Node pubkey (66-char hex, compressed secp256k1): keysend, requires --amount, --currency, --network lightning (and --unit for BTC)\n" +
        "  - EVM address (0x...): pay crypto/stablecoin, requires --amount, --currency (token), and --network <chain>",
    )
    .argument(
      "<destination>",
      "Invoice, lightning address, node pubkey, or EVM address",
    )
    .option("--amount <number>", "Amount", parseAmountNumber)
    .option(
      "--currency <code>",
      "Denomination: BTC, a fiat code (USD, EUR, …), or a crypto token (USDC, …)",
    )
    .option(
      "--network <name>",
      'Destination network: "lightning" to pay a lightning invoice/address (amount in --currency BTC or a fiat code), or a chain name (e.g. arbitrum) to pay a crypto/stablecoin address (funded from your lightning wallet)',
    )
    .option("--unit <sats|BTC>", "Sub-unit (required when --currency is BTC)")
    .option("--comment <text>", "Comment for lightning address payments")
    .option(
      "--preimage <hex>",
      "Preimage for keysend (optional, generated if omitted)",
    )
    .option(
      "--tlv-records <json>",
      "TLV records for keysend, as JSON array [{type, value}]",
    )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  $ npx @getalby/cli pay lnbc1...\n" +
        "  $ npx @getalby/cli pay alice@getalby.com --amount 100 --currency BTC --unit sats --network lightning --comment hi\n" +
        "  $ npx @getalby/cli pay alice@getalby.com --amount 5 --currency USD --network lightning\n" +
        "  $ npx @getalby/cli pay 02aabb... --amount 100 --currency BTC --unit sats --network lightning\n" +
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
            // A BOLT-11 invoice encodes its own amount. Amount flags are only
            // for zero-amount invoices, and must come as a complete set.
            let amountInSats: number | undefined;
            let fiat: { amount: number; currency: string } | undefined;
            if (options.amount === undefined) {
              if (options.currency || options.unit || options.network) {
                throw new Error(
                  "--currency/--unit/--network only apply to a zero-amount invoice — also pass --amount, or omit them for a fixed-amount invoice",
                );
              }
            } else {
              const resolved = await resolveLightningSats({
                amount: options.amount,
                currency: options.currency,
                unit: options.unit,
                network: options.network,
              });
              amountInSats = resolved.sats;
              fiat = resolved.fiat;
            }
            const client = await getClient(program);
            const result = await payInvoice(client, {
              invoice: destination,
              amount_in_sats: amountInSats,
              metadata: {},
            });
            output({ ...result, ...(fiat && { fiat }) });
            return;
          }
          case "lightning-address": {
            if (options.amount === undefined) {
              throw new Error(
                "Lightning address payments require --amount <n> --currency <code> --network lightning (and --unit for BTC)",
              );
            }
            const resolved = await resolveLightningSats({
              amount: options.amount,
              currency: options.currency,
              unit: options.unit,
              network: options.network,
            });
            const invoice = await requestInvoiceFromLightningAddress({
              lightning_address: destination,
              amount_in_sats: resolved.sats,
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
            output({
              ...result,
              amount_in_sats: resolved.sats,
              ...(resolved.fiat && { fiat: resolved.fiat }),
            });
            return;
          }
          case "keysend": {
            if (options.amount === undefined) {
              throw new Error(
                "Keysend payments require --amount <n> --currency <code> --network lightning (and --unit for BTC)",
              );
            }
            const resolved = await resolveLightningSats({
              amount: options.amount,
              currency: options.currency,
              unit: options.unit,
              network: options.network,
            });
            let tlvRecords: TlvRecord[] | undefined;
            if (options.tlvRecords) {
              tlvRecords = JSON.parse(options.tlvRecords);
            }
            const client = await getClient(program);
            const result = await payKeysend(client, {
              pubkey: destination,
              amount_in_sats: resolved.sats,
              preimage: options.preimage,
              tlv_records: tlvRecords,
            });
            output({
              ...result,
              amount_in_sats: resolved.sats,
              ...(resolved.fiat && { fiat: resolved.fiat }),
            });
            return;
          }
          case "crypto": {
            if (options.amount === undefined) {
              throw new Error(
                "EVM address payments require --amount <n> --currency <token> --network <chain>",
              );
            }
            // An EVM address is settled by a crypto-token swap on a chain
            // network — the lightning rail (BTC/fiat) is never valid here.
            if (options.network?.toLowerCase() === "lightning") {
              throw new Error(
                "An EVM address is paid with a crypto token over a chain network " +
                  "(e.g. --currency USDC --network arbitrum). --network lightning " +
                  "(BTC/fiat) is not valid for an EVM address.",
              );
            }
            const rail = classifyRail({
              currency: options.currency,
              unit: options.unit,
              network: options.network,
            });
            if (rail.kind !== "crypto") {
              throw new Error(
                "An EVM address is paid with a crypto token over a chain network " +
                  "(e.g. --currency USDC --network arbitrum).",
              );
            }
            if (!isPlausibleEvmAddress(destination)) {
              throw new Error(
                `Recipient address does not look valid (expected 0x + 40 hex chars): ${destination}`,
              );
            }
            const pair = await findSupportedPair(rail.currency, rail.network);
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
