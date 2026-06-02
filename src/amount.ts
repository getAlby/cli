import { InvalidArgumentError } from "commander";
import { getSatoshiValue } from "@getalby/lightning-tools";

/**
 * Shared amount model for every amount-bearing command. One axis each for
 * *what* (`--currency`), *where* (`--network`), and — for BTC only — the
 * sub-unit (`--unit`): denomination and rail are never guessed, and the
 * BTC/sats split is made explicit so a bare `--amount 1 --currency BTC` can
 * never be silently interpreted as 1 sat vs 1 whole bitcoin.
 *
 * Rail dispatch is keyed purely on `--network`, so no catalog of currencies or
 * tokens is hardcoded here. BTC is the only special-cased currency (a protocol
 * constant with sub-units); every other code is resolved by the rail it lands
 * on — a fiat code by the rate converter on the lightning rail, a token symbol
 * by the Lendaswap catalog on a chain rail. A currency that doesn't belong on
 * the chosen rail therefore surfaces its error from that downstream resolver.
 */

export const SATS_PER_BTC = 100_000_000;

/**
 * Commander coercion for `--amount`: a strict positive number. Rejects `NaN`,
 * unit-suffixed input (`"10abc"`), and values `<= 0` instead of silently
 * truncating them. Replaces the ad-hoc `Number`/`parseInt`/`parseFloat`
 * coercions that previously let the same flag resolve to different values
 * across commands.
 */
export function parseAmountNumber(value: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new InvalidArgumentError(
      `Amount must be a positive number (got "${value}")`,
    );
  }
  return num;
}

const LIGHTNING_NETWORK = "lightning";

export type Unit = "sats" | "BTC";

export interface BitcoinRail {
  kind: "bitcoin";
  currency: "BTC";
  unit: Unit;
  network: string;
}

export interface FiatRail {
  kind: "fiat";
  currency: string;
  network: string;
}

export interface CryptoRail {
  kind: "crypto";
  currency: string;
  network: string;
}

export type ClassifiedRail = BitcoinRail | FiatRail | CryptoRail;

export interface ClassifyRailInput {
  currency?: string;
  unit?: string;
  network?: string;
}

/**
 * Validate a (currency, unit, network) triple and decide the payment rail.
 * Keyed on `--network`, which selects the *destination*: `lightning` pays a
 * lightning invoice/address (amount denominated in BTC, or in a fiat code
 * converted to sats); any other value is the chain of a crypto/stablecoin
 * address — still funded from the lightning wallet, then swapped to the token.
 * The payer always pays with lightning. The only currency interpreted here is
 * `BTC` — every other code is passed through for the downstream resolver (rate
 * converter for fiat, Lendaswap catalog for tokens) to validate. Pure /
 * synchronous — no network I/O — so the structural checks run at validation
 * time before any wallet load.
 */
export function classifyRail({
  currency,
  unit,
  network,
}: ClassifyRailInput): ClassifiedRail {
  if (!currency) {
    throw new Error(
      "An amount requires --currency <BTC|USD|EUR|USDC|…> so the denomination is never guessed",
    );
  }
  if (!network) {
    throw new Error(
      'An amount requires --network <name>. Use "lightning" to pay a lightning ' +
        "invoice or address (amount in --currency BTC, or a fiat code like USD " +
        "that's converted to sats). Use a chain name (e.g. arbitrum) to pay a " +
        "crypto/stablecoin address on that chain — still paid from your lightning " +
        "wallet, then swapped to the token.",
    );
  }

  const code = currency.toUpperCase();
  const isBtc = code === "BTC";
  const isLightning = network.toLowerCase() === LIGHTNING_NETWORK;

  // --unit is meaningful only for BTC (the one currency with sub-units).
  if (!isBtc && unit !== undefined) {
    throw new Error(
      `--unit is not valid for --currency ${code} — only BTC has sub-units (sats/BTC). Drop --unit.`,
    );
  }

  if (isLightning) {
    if (isBtc) {
      return { kind: "bitcoin", currency: "BTC", unit: parseUnit(unit), network };
    }
    // Fiat code (or, if mis-routed, a token) — the rate converter validates it.
    return { kind: "fiat", currency: code, network };
  }

  // Chain network → crypto swap rail. BTC has no chain rail today.
  if (isBtc) {
    throw new Error(
      `--currency BTC is only supported on --network lightning, not "${network}"`,
    );
  }
  // Token symbol (or, if mis-routed, a fiat code) — the catalog validates it.
  return { kind: "crypto", currency: code, network };
}

/**
 * Normalize and validate `--unit` for BTC. Case-insensitive; canonical forms
 * are `sats` and `BTC`. Required (no default) because the sats/BTC split is
 * dangerous and must be stated explicitly.
 */
function parseUnit(unit: string | undefined): Unit {
  if (unit === undefined) {
    throw new Error(
      "--unit <sats|BTC> is required when --currency is BTC (1 BTC = 100,000,000 sats, so the amount can't be guessed)",
    );
  }
  const normalized = unit.toLowerCase();
  if (normalized === "sats") return "sats";
  if (normalized === "btc") return "BTC";
  throw new Error(`--unit must be "sats" or "BTC" (got "${unit}")`);
}

export interface ResolvedSats {
  sats: number;
  /** Present when the amount was denominated in fiat and rate-converted. */
  fiat?: { amount: number; currency: string };
}

export interface ResolveToSatsInput {
  amount: number;
  currency: string;
  unit?: Unit;
}

/**
 * Resolve a bitcoin- or fiat-denominated amount to whole sats. For BTC, does
 * the sats/BTC arithmetic and enforces a whole-sat result. For fiat, converts
 * at the live rate and surfaces the resolved sats alongside the original fiat
 * amount. Crypto-token amounts are handled by the swap path, not here.
 */
export async function resolveToSats({
  amount,
  currency,
  unit,
}: ResolveToSatsInput): Promise<ResolvedSats> {
  if (currency.toUpperCase() === "BTC") {
    if (unit === "sats") {
      if (!Number.isInteger(amount)) {
        throw new Error(
          `Amount in sats must be a whole number (got ${amount}). Use --unit BTC for fractional bitcoin.`,
        );
      }
      return { sats: amount };
    }
    // unit === "BTC"
    const raw = amount * SATS_PER_BTC;
    const sats = Math.round(raw);
    if (Math.abs(raw - sats) > 1e-6) {
      throw new Error(
        `Amount ${amount} BTC is not a whole number of sats (1 BTC = 100,000,000 sats)`,
      );
    }
    if (sats < 1) {
      throw new Error(`Amount ${amount} BTC is less than 1 sat`);
    }
    return { sats };
  }

  // Fiat → sats at the live rate. A non-fiat code (e.g. a token mistakenly put
  // on the lightning rail) surfaces the converter's own rate-lookup error.
  const sats = await getSatoshiValue({ amount, currency });
  return { sats, fiat: { amount, currency: currency.toUpperCase() } };
}

export interface ResolveLightningSatsInput {
  amount: number;
  currency?: string;
  unit?: string;
  network?: string;
}

/**
 * For commands that can only settle over lightning (invoices, lightning-address
 * / keysend payments): classify the rail, reject a chain (crypto) rail with a
 * pointer to `pay-crypto`, and resolve BTC/fiat to whole sats.
 */
export async function resolveLightningSats({
  amount,
  currency,
  unit,
  network,
}: ResolveLightningSatsInput): Promise<ResolvedSats> {
  const rail = classifyRail({ currency, unit, network });
  if (rail.kind === "crypto") {
    throw new Error(
      `--network "${network}" is a chain network for crypto-token payments. ` +
        "This command settles over lightning — use --network lightning with " +
        "--currency BTC (and --unit sats|BTC) or a fiat code (e.g. --currency USD). " +
        "For on-chain crypto, see the pay-crypto command.",
    );
  }
  return resolveToSats({
    amount,
    currency: rail.currency,
    unit: rail.kind === "bitcoin" ? rail.unit : undefined,
  });
}
