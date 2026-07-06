export interface DiscoverParams {
  query?: string;
  protocol?: string;
  health?: string;
  sort?: string;
  limit?: number;
}

// The l402.space bridge re-wraps any 402-gated upstream as an L402 (lightning)
// challenge, so a lightning wallet can pay endpoints it couldn't settle
// natively (e.g. USDC-only x402). We wrap non-lightning discover results in the
// bridge URL up front so the URL a caller fetches is explicit - `fetch` pays it
// as a normal L402 endpoint, with no hidden per-request redirection.
const L402_SPACE_BRIDGE = "https://l402.space/";

function bridgeUrl(url: string): string {
  return `${L402_SPACE_BRIDGE}${encodeURIComponent(url)}`;
}

// L402 and MPP settle over lightning by definition; x402 does only when its
// payment network is Lightning. Everything else (Base, Stellar, EVM chains, ...)
// needs the bridge to be payable from a lightning wallet.
function isLightningNative(
  protocol: string,
  paymentNetwork: string | null,
): boolean {
  return (
    protocol === "L402" ||
    protocol === "MPP" ||
    (paymentNetwork ?? "").toLowerCase() === "lightning"
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
  // MPP). Non-lightning results are returned with a bridged l402.space URL (see
  // below) so they stay payable in sats via the fetch command.
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
      url: isLightningNative(s.protocol, s.payment_network)
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
