export interface DiscoverParams {
  query?: string;
  protocol?: string;
  health?: string;
  sort?: string;
  limit?: number;
}

export async function discover(params: DiscoverParams) {
  const url = new URL("https://402index.io/api/v1/services");
  const requestedLimit = params.limit ?? 10;

  if (params.query) url.searchParams.set("q", params.query);
  if (params.protocol) url.searchParams.set("protocol", params.protocol);
  if (params.health) url.searchParams.set("health", params.health);
  if (params.sort) url.searchParams.set("sort", params.sort);

  // Filter to BTC (Lightning) services server-side
  url.searchParams.set("payment_asset", "BTC");
  url.searchParams.set("limit", String(requestedLimit));

  const response = await fetch(url.toString());
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
      payment_network: string;
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
      url: s.url,
      protocol: s.protocol,
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
