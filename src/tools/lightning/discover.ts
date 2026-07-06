export interface DiscoverParams {
  query?: string;
  protocol?: string;
  health?: string;
  sort?: string;
  limit?: number;
}

// The l402.space bridge re-wraps a 402-gated upstream as an L402 (lightning)
// challenge and settles the upstream on our behalf, so a lightning wallet can
// pay endpoints it couldn't settle natively (e.g. USDC-only x402 on Base). We
// wrap bridgeable discover results in the bridge URL up front so the URL a
// caller fetches is explicit - `fetch` pays it as a normal L402 endpoint, with
// no hidden per-request redirection.
const L402_SPACE_BRIDGE = "https://l402.space/";

function bridgeUrl(url: string): string {
  return `${L402_SPACE_BRIDGE}${encodeURIComponent(url)}`;
}

// The bridge can only settle upstreams on the rails it has funded wallets for -
// l402.space/api/info reports these as "base", "solana", "tempo", "lightning".
// "lightning" is handled as native (paid directly), so these are the extra
// rails the bridge unlocks. Assets follow the rail (USDC on base/solana, TIP-20
// on tempo). Rails outside this set (Stellar, Polygon, Stripe, testnets, ...)
// aren't payable from a lightning wallet at all - we leave those unwrapped.
const BRIDGE_FUNDED_NETWORKS = new Set(["base", "solana", "tempo"]);

// The index reports some rails as CAIP-2 chain ids; normalize the ones that map
// onto a funded network (eip155:8453 is Base mainnet). Testnets like Base
// Sepolia (eip155:84532 / "Base Sepolia") intentionally don't match.
const NETWORK_ALIASES: Record<string, string> = { "eip155:8453": "base" };

// payment_network can list several rails, e.g. "Base, Solana".
function paymentRails(paymentNetwork: string | null): string[] {
  return (paymentNetwork ?? "").split(",").map((rail) => {
    const normalized = rail.trim().toLowerCase();
    return NETWORK_ALIASES[normalized] ?? normalized;
  });
}

// L402 is lightning by definition (native even when the index reports no
// network); x402/MPP are rail-agnostic and only native when their rail is
// Lightning.
function isLightningNative(
  protocol: string,
  paymentNetwork: string | null,
): boolean {
  return (
    protocol === "L402" || paymentRails(paymentNetwork).includes("lightning")
  );
}

function isBridgeable(paymentNetwork: string | null): boolean {
  return paymentRails(paymentNetwork).some((rail) =>
    BRIDGE_FUNDED_NETWORKS.has(rail),
  );
}

export async function discover(params: DiscoverParams) {
  const url = new URL("https://402index.io/api/v1/services");
  const requestedLimit = params.limit ?? 10;

  if (params.query) url.searchParams.set("q", params.query);
  if (params.protocol) url.searchParams.set("protocol", params.protocol);
  if (params.health) url.searchParams.set("health", params.health);
  if (params.sort) url.searchParams.set("sort", params.sort);

  // No payment_asset filter: return services across all protocols (L402, x402,
  // MPP). Results on a bridge-funded rail are returned with a bridged
  // l402.space URL (see below) so they stay payable in sats via the fetch
  // command; unsupported rails keep their own URL.
  url.searchParams.set("limit", String(requestedLimit));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  let response: Response;
  try {
    response = await fetch(url.toString(), { signal: controller.signal });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request to 402index.io timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new Error(
      `402index.io returned status ${response.status}: ${await response.text()}`,
    );
  }

  const data = (await response.json()) as {
    services: Array<{
      name: string;
      description: string;
      url: string;
      protocol: string;
      price_sats: number | null;
      price_usd: number | null;
      payment_network: string | null;
      category: string;
      provider: string;
      health_status: string;
      reliability_score: number | null;
      latency_p50_ms: number | null;
      http_method: string;
    }>;
    total: number;
    limit: number;
    offset: number;
  };

  return {
    services: data.services.map((s) => ({
      name: s.name,
      description: s.description,
      url:
        isLightningNative(s.protocol, s.payment_network) ||
        !isBridgeable(s.payment_network)
          ? s.url
          : bridgeUrl(s.url),
      protocol: s.protocol,
      payment_network: s.payment_network,
      price_sats: s.price_sats,
      price_usd: s.price_usd,
      category: s.category,
      provider: s.provider,
      health_status: s.health_status,
      reliability_score: s.reliability_score,
      latency_p50_ms: s.latency_p50_ms,
      http_method: s.http_method,
    })),
    total: data.total,
  };
}
