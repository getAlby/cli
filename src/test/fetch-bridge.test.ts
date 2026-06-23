import { describe, test, expect, vi, beforeEach } from "vitest";
import type { NWCClient } from "@getalby/sdk";

// Mock the underlying protocol handler so we can drive the wrapper's decision
// logic: lightning-tools already pays L402/MPP/lightning-x402 directly and hands
// back an unpaid 402 for anything it can't settle over lightning (e.g. USDC-only
// x402). We assert our wrapper transparently retries those through l402.space.
const fetch402Lib = vi.fn();
vi.mock("@getalby/lightning-tools/402", () => ({
  fetch402: (...args: unknown[]) => fetch402Lib(...args),
}));

const { fetch402 } = await import("../tools/lightning/fetch.js");

const fakeClient = {} as NWCClient;

beforeEach(() => {
  fetch402Lib.mockReset();
});

describe("fetch402 l402.space bridge fallback", () => {
  test("retries through l402.space when a direct fetch returns 402", async () => {
    fetch402Lib
      .mockResolvedValueOnce(new Response("nope", { status: 402 }))
      .mockResolvedValueOnce(new Response("paid content", { status: 200 }));

    const result = await fetch402(fakeClient, {
      url: "https://x402.example/api",
    });

    expect(result.content).toBe("paid content");
    expect(fetch402Lib).toHaveBeenCalledTimes(2);
    expect(fetch402Lib.mock.calls[0][0]).toBe("https://x402.example/api");
    expect(fetch402Lib.mock.calls[1][0]).toBe(
      "https://l402.space/" + encodeURIComponent("https://x402.example/api"),
    );
  });

  test("pays directly without the bridge when the first fetch succeeds", async () => {
    fetch402Lib.mockResolvedValueOnce(
      new Response("direct content", { status: 200 }),
    );

    const result = await fetch402(fakeClient, {
      url: "https://l402.example/api",
    });

    expect(result.content).toBe("direct content");
    expect(fetch402Lib).toHaveBeenCalledTimes(1);
  });

  test("does not double-bridge a url already pointing at l402.space", async () => {
    fetch402Lib.mockResolvedValueOnce(new Response("nope", { status: 402 }));

    await expect(
      fetch402(fakeClient, { url: "https://l402.space/whatever" }),
    ).rejects.toThrow("non-OK status: 402");
    expect(fetch402Lib).toHaveBeenCalledTimes(1);
  });
});
