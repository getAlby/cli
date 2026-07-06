import { describe, test, expect, vi, afterEach } from "vitest";
import { discover } from "../tools/lightning/discover.js";

// discover() calls global fetch against 402index.io. We stub it so we can drive
// the URL-wrapping logic: non-lightning services (e.g. x402 on Base/Stellar)
// come back with an explicit l402.space bridge URL, while natively
// lightning-payable services (L402, MPP, or x402 on the Lightning network) keep
// their own URL.
function stubIndexResponse(
  services: Array<{ url: string; protocol: string; payment_network: string }>,
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
  test("wraps non-lightning services (x402 on Base/Stellar/EVM) in the bridge URL", async () => {
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
    ]);

    const result = await discover({});

    expect(result.services.map((s) => s.url)).toEqual([
      bridged("https://a.example/api"),
      bridged("https://b.example/api"),
      bridged("https://c.example/api"),
    ]);
  });

  test("leaves natively lightning-payable services unwrapped", async () => {
    stubIndexResponse([
      {
        url: "https://l402.example/api",
        protocol: "L402",
        payment_network: "Lightning",
      },
      { url: "https://mpp.example/api", protocol: "MPP", payment_network: "" },
      {
        url: "https://x402ln.example/api",
        protocol: "x402",
        payment_network: "Lightning",
      },
    ]);

    const result = await discover({});

    expect(result.services.map((s) => s.url)).toEqual([
      "https://l402.example/api",
      "https://mpp.example/api",
      "https://x402ln.example/api",
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
