import {
  Asset,
  Client,
  InMemorySwapStorage,
  InMemoryWalletStorage,
  type LightningToEvmSwapResponse,
  type SwapStatus,
  type SwapStatusHandler,
  toChain,
  toChainName,
} from "@lendasat/lendaswap-sdk-pure";

// Allow tests (or local dev against staging) to override the API endpoint.
const API_BASE_URL = process.env.LENDASWAP_API_URL || "https://api.satora.io";

// Terminal statuses where the swap is irrecoverably done. Mirrors the same
// constants used by the bitcoin-card-topup reference frontend.
const SUCCESS_STATUSES: SwapStatus[] = ["clientredeemed", "serverredeemed"];
const FAILURE_STATUSES: SwapStatus[] = [
  "expired",
  "clientrefunded",
  "clientrefundedserverrefunded",
  "clientrefundedserverfunded",
  "clientinvalidfunded",
  "clientfundedtoolate",
  "serverwontfund",
];

let clientPromise: Promise<Client> | null = null;

function getClient(): Promise<Client> {
  if (!clientPromise) {
    // In-memory storage: a single CLI invocation waits synchronously for a
    // terminal swap status, so there's nothing to recover across runs. If the
    // process is killed mid-swap, the HTLC refund timer is the safety net.
    clientPromise = Client.builder()
      .withBaseUrl(API_BASE_URL)
      .withSignerStorage(new InMemoryWalletStorage())
      .withSwapStorage(new InMemorySwapStorage())
      .build();
  }
  return clientPromise;
}

export interface SupportedPair {
  /** Token symbol as reported by the API (e.g. "USDC"). */
  symbol: string;
  /** Human-friendly chain name (e.g. "Arbitrum"). */
  network: string;
  decimals: number;
  /** Canonical chain identifier from the SDK (e.g. "42161"). */
  chain: string;
  /** Token ID — ERC-20 contract address for EVM tokens. */
  tokenId: string;
}

let supportedPairsPromise: Promise<SupportedPair[]> | null = null;

/**
 * Fetch all (currency, network) pairs that can be the target of a
 * Lightning → EVM swap. The list comes straight from the Lendaswap API:
 * `getTokens()` for the token universe, intersected with `getSwapPairs()`
 * filtered to source = Lightning.
 */
export function getSupportedPairs(): Promise<SupportedPair[]> {
  if (!supportedPairsPromise) {
    supportedPairsPromise = (async () => {
      const client = await getClient();
      const [tokens, swapPairs] = await Promise.all([
        client.getTokens(),
        client.getSwapPairs(),
      ]);
      const lightningTargetChains = new Set(
        swapPairs.pairs
          .filter((p) => p.source === "Lightning")
          .map((p) => p.target),
      );
      return tokens.evm_tokens
        .filter((t) => lightningTargetChains.has(t.chain))
        .map((t) => ({
          symbol: t.symbol,
          network: toChainName(t.chain),
          decimals: t.decimals,
          chain: t.chain,
          tokenId: t.token_id,
        }));
    })();
  }
  return supportedPairsPromise;
}

function formatPairsList(pairs: SupportedPair[]): string {
  return pairs.map((p) => `  - ${p.symbol} on ${p.network}`).join("\n");
}

/**
 * Resolve a (currency, network) pair against the live API list, or throw
 * with a human-readable error listing every supported pair. Network can be
 * a chain name ("arbitrum") or chain id ("42161"); matching is case-insensitive.
 */
export async function findSupportedPair(
  currency: string,
  network: string,
): Promise<SupportedPair> {
  const pairs = await getSupportedPairs();
  const symbol = currency.toUpperCase();
  // toChain normalizes "arbitrum"/"42161"/"Arbitrum" to the canonical chain id.
  const chain = toChain(network);
  const pair = pairs.find(
    (p) => p.symbol.toUpperCase() === symbol && p.chain === chain,
  );
  if (!pair) {
    throw new Error(
      `Unsupported currency/network combination: ${currency} on ${network}.\n` +
        `Supported:\n${formatPairsList(pairs)}`,
    );
  }
  return pair;
}

/**
 * EVM address shape check: every chain reachable from Lightning is EVM, so
 * the universal `0x` + 40-hex format applies. Lendaswap does the
 * authoritative validation when it builds the swap; this is just a sanity
 * pre-check so an obvious typo fails fast before we lock funds.
 */
export function isPlausibleEvmAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

function toSmallestUnit(amount: number, decimals: number): number {
  return Math.round(amount * 10 ** decimals);
}

async function createPaymentSwap(params: {
  pair: SupportedPair;
  amount: number;
  targetAddress: string;
}): Promise<LightningToEvmSwapResponse> {
  const client = await getClient();
  const targetAmount = toSmallestUnit(params.amount, params.pair.decimals);

  const targetAsset: Asset = {
    chain: params.pair.chain,
    tokenId: params.pair.tokenId,
  };

  const result = await client.createSwap({
    source: Asset.BTC_LIGHTNING,
    target: targetAsset,
    targetAmount,
    targetAddress: params.targetAddress,
    gasless: true,
    referralCode: "lnds_2c07e38f10a28d47",
  });
  // Source is BTC_LIGHTNING and target is an EVM token, so the SDK routes
  // through its Lightning→EVM path.
  return result.response as LightningToEvmSwapResponse;
}

async function subscribeToSwap(
  swapId: string,
  onUpdate: SwapStatusHandler,
): Promise<() => void> {
  const client = await getClient();
  return client.subscribeToSwaps([swapId], onUpdate);
}

async function claimSwap(swapId: string) {
  const client = await getClient();
  return client.claim(swapId);
}

export interface PayCryptoParams {
  /** Currency/network pair the recipient will be paid in — use {@link findSupportedPair} to obtain. */
  pair: SupportedPair;
  /** Amount of the target currency the recipient should receive (e.g. 10 for 10 USDC). */
  amount: number;
  /** Recipient address on the target network. */
  targetAddress: string;
  /**
   * Pay the swap's bolt11 invoice. The caller owns the Lightning wallet; this
   * keeps lendaswap independent of any specific wallet/NWC implementation.
   */
  payInvoice: (bolt11Invoice: string) => Promise<void>;
}

export interface PayCryptoResult {
  swapId: string;
}

/**
 * Run a Lightning → on-chain crypto payment swap and block until it reaches a
 * terminal status. Throws on any failure status. All swap-provider specifics
 * (Lendaswap SDK calls, status handling, claim-on-serverfunded) live here so
 * that swapping out the provider is a self-contained change.
 */
export async function payCrypto(
  params: PayCryptoParams,
): Promise<PayCryptoResult> {
  const swap = await createPaymentSwap({
    pair: params.pair,
    amount: params.amount,
    targetAddress: params.targetAddress,
  });

  // Subscribe BEFORE paying so we don't miss the `serverfunded` event
  // that triggers our claim. Unsubscribe in `finally` no matter what.
  let unsubscribe: (() => void) | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };

      let claimStarted = false;
      subscribeToSwap(swap.id, (_id, status) => {
        if (status === "serverfunded" && !claimStarted) {
          claimStarted = true;
          claimSwap(swap.id).catch((err) =>
            settle(() =>
              reject(err instanceof Error ? err : new Error(String(err))),
            ),
          );
        }
        if (SUCCESS_STATUSES.includes(status)) {
          settle(resolve);
        } else if (FAILURE_STATUSES.includes(status)) {
          settle(() => reject(new Error(`Swap ${status}`)));
        }
      })
        .then((unsub) => {
          unsubscribe = unsub;
          // If the swap already terminated before subscribe resolved,
          // tear down immediately.
          if (settled) unsub();
        })
        .catch((err) =>
          settle(() =>
            reject(err instanceof Error ? err : new Error(String(err))),
          ),
        );

      // Pay the Lightning invoice. Failure here propagates as the
      // overall swap failure; success doesn't resolve us — only a
      // terminal swap status does.
      params
        .payInvoice(swap.bolt11_invoice)
        .catch((err) =>
          settle(() =>
            reject(err instanceof Error ? err : new Error(String(err))),
          ),
        );
    });
  } finally {
    unsubscribe?.();
  }

  return { swapId: swap.id };
}
