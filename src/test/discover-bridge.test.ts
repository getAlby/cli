import { describe, test, expect, vi, afterEach } from "vitest";
import { discover } from "../tools/lightning/discover.js";

// discover() calls global fetch against 402index.io. We stub it so we can drive
// the URL-wrapping logic: non-lightning services (e.g. x402 on Base/Stellar)
// come back with an explicit l402.space bridge URL, while natively
// lightning-payable services (L402, MPP, or x402 on the Lightning network) keep
// their own URL.
function stubIndexResponse(
  services: Array<{
    url: string;
    protocol: string;
    payment_network: string | null;
  }>,
) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        services: services.map((s) => ({
          name: "svc",
          description: "",
          url: s.url,
          protocol: s.protocol,
          price_sats: null,
          price_usd: null,
          payment_network: s.payment_network,
          category: "",
          provider: "",
          health_status: "healthy",
          reliability_score: null,
          latency_p50_ms: null,
          http_method: "GET",
        })),
        // Sentinel distinct from services.length: total is the index's match
        // count, so it must survive our payability filtering/slicing unchanged.
        total: 9999,
        limit: 10,
        offset: 0,
      }),
      { status: 200 },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const bridged = (url: string) =>
  "https://l402.space/" + encodeURIComponent(url);
// MPP upstreams route through the dedicated mpp-lightning inbound endpoint.
const bridgedMpp = (url: string) =>
  "https://l402.space/mpp-lightning/" + encodeURIComponent(url);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("discover l402.space bridge wrapping", () => {
  test("wraps x402 services on a bridge-funded rail via the default endpoint (base/solana, incl. eip155:8453 alias)", async () => {
    stubIndexResponse([
      { url: "https://a.example/api", protocol: "x402", payment_network: "Base" },
      {
        url: "https://b.example/api",
        protocol: "x402",
        payment_network: "eip155:8453", // CAIP-2 for Base mainnet
      },
      {
        url: "https://c.example/api",
        protocol: "x402",
        payment_network: "Solana",
      },
      {
        url: "https://d.example/api",
        protocol: "x402",
        payment_network: "Base, Solana",
      },
    ]);

    const result = await discover({});

    expect(result.services.map((s) => s.url)).toEqual([
      bridged("https://a.example/api"),
      bridged("https://b.example/api"),
      bridged("https://c.example/api"),
      bridged("https://d.example/api"),
    ]);
  });

  test("routes MPP services through the dedicated mpp-lightning endpoint, not the default one", async () => {
    // MPP challenges can't be folded into an L402 one, so an MPP upstream must
    // use l402.space/mpp-lightning/ to still hand our wallet a lightning invoice.
    stubIndexResponse([
      { url: "https://mpp.example/api", protocol: "MPP", payment_network: "Tempo" },
    ]);

    const result = await discover({});

    expect(result.services[0].url).toBe(bridgedMpp("https://mpp.example/api"));
  });

  test("drops services on rails the bridge can't settle (stellar/polygon/stripe/testnet/none)", async () => {
    // l402.space only funds base/solana/tempo/lightning, so these aren't
    // payable from a lightning wallet at all. discover must never surface a
    // service the wallet can't pay. Note "Base Sepolia" must NOT match "base".
    stubIndexResponse([
      {
        url: "https://a.example/api",
        protocol: "x402",
        payment_network: "stellar",
      },
      {
        url: "https://b.example/api",
        protocol: "x402",
        payment_network: "Polygon",
      },
      { url: "https://c.example/api", protocol: "MPP", payment_network: "Stripe" },
      {
        url: "https://d.example/api",
        protocol: "x402",
        payment_network: "Base Sepolia",
      },
      { url: "https://e.example/api", protocol: "MPP", payment_network: null },
    ]);

    const result = await discover({});

    expect(result.services).toEqual([]);
    // total still reports the index's match count, not the filtered-out zero.
    expect(result.total).toBe(9999);
  });

  test("returns only the payable services from a mixed page, keeping the index total", async () => {
    stubIndexResponse([
      {
        url: "https://ln.example/api",
        protocol: "L402",
        payment_network: "Lightning",
      },
      {
        url: "https://stellar.example/api",
        protocol: "x402",
        payment_network: "stellar",
      },
      { url: "https://base.example/api", protocol: "x402", payment_network: "Base" },
      { url: "https://stripe.example/api", protocol: "MPP", payment_network: "Stripe" },
    ]);

    const result = await discover({});

    expect(result.services.map((s) => s.url)).toEqual([
      "https://ln.example/api",
      bridged("https://base.example/api"),
    ]);
    expect(result.total).toBe(9999);
  });

  test("leaves natively lightning-payable services unwrapped", async () => {
    stubIndexResponse([
      // L402 is lightning by definition, even when the index reports no network.
      {
        url: "https://l402.example/api",
        protocol: "L402",
        payment_network: "Lightning",
      },
      { url: "https://l402null.example/api", protocol: "L402", payment_network: null },
      // x402 does settle over lightning when its rail is Lightning...
      {
        url: "https://x402ln.example/api",
        protocol: "x402",
        payment_network: "Lightning",
      },
      // ...including when Lightning is one of several listed rails.
      {
        url: "https://multi.example/api",
        protocol: "x402",
        payment_network: "Lightning, Base",
      },
    ]);

    const result = await discover({});

    expect(result.services.map((s) => s.url)).toEqual([
      "https://l402.example/api",
      "https://l402null.example/api",
      "https://x402ln.example/api",
      "https://multi.example/api",
    ]);
  });

  test("surfaces payment_network so callers see which rail they are paying", async () => {
    stubIndexResponse([
      { url: "https://a.example/api", protocol: "x402", payment_network: "Base" },
    ]);

    const result = await discover({});

    expect(result.services[0].payment_network).toBe("Base");
  });
});
