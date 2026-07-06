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
        total: services.length,
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("discover l402.space bridge wrapping", () => {
  test("wraps every non-lightning rail in the bridge URL (x402 and MPP alike)", async () => {
    // MPP and x402 are payment-network agnostic - USDC on Base/Stellar/EVM,
    // USD via Stripe, or no declared rail - so none of these settle over
    // lightning and all must be bridged.
    stubIndexResponse([
      { url: "https://a.example/api", protocol: "x402", payment_network: "Base" },
      {
        url: "https://b.example/api",
        protocol: "x402",
        payment_network: "eip155:8453",
      },
      {
        url: "https://c.example/api",
        protocol: "x402",
        payment_network: "stellar",
      },
      { url: "https://d.example/api", protocol: "MPP", payment_network: "Stripe" },
      { url: "https://e.example/api", protocol: "MPP", payment_network: null },
      { url: "https://f.example/api", protocol: "x402", payment_network: null },
    ]);

    const result = await discover({});

    expect(result.services.map((s) => s.url)).toEqual([
      bridged("https://a.example/api"),
      bridged("https://b.example/api"),
      bridged("https://c.example/api"),
      bridged("https://d.example/api"),
      bridged("https://e.example/api"),
      bridged("https://f.example/api"),
    ]);
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
