import { describe, test, expect, vi, afterEach } from "vitest";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NWCClient } from "@getalby/sdk";
import { fetch402 } from "../tools/lightning/fetch.js";

// A minimal WAV header: contains bytes (0xAC, 0x88, ...) that are invalid
// UTF-8, so a text decode would corrupt them into U+FFFD.
const WAV_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
  0x66, 0x6d, 0x74, 0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x44, 0xac, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00,
]);

const URL = "https://example.com/protected";

const client = {} as unknown as NWCClient;
const savedFiles: string[] = [];

function stubResponse(
  body: BodyInit,
  headers: Record<string, string> = {},
): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(body, { status: 200, headers })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const file of savedFiles.splice(0)) {
    rmSync(file, { force: true });
  }
});

describe("fetch binary responses", () => {
  test("saves a binary body to a temp file instead of returning mangled text", async () => {
    stubResponse(WAV_BYTES, { "content-type": "audio/wav" });

    const result = await fetch402(client, { url: URL });
    savedFiles.push(result.outputPath!);

    expect(result.content).toBeUndefined();
    expect(result.outputPath).toContain(tmpdir());
    expect(result.outputPath).toMatch(/\.wav$/);
    expect(result.contentType).toBe("audio/wav");
    expect(result.sizeBytes).toBe(WAV_BYTES.length);
    // The saved bytes are the original response, byte for byte.
    expect(new Uint8Array(readFileSync(result.outputPath!))).toEqual(WAV_BYTES);
  });

  test("saves an unlabeled binary body with a .bin extension", async () => {
    stubResponse(WAV_BYTES);

    const result = await fetch402(client, { url: URL });
    savedFiles.push(result.outputPath!);

    expect(result.outputPath).toMatch(/\.bin$/);
    expect(new Uint8Array(readFileSync(result.outputPath!))).toEqual(WAV_BYTES);
  });

  test("returns a declared-text body inline even when not valid UTF-8", async () => {
    stubResponse(new Uint8Array([0x68, 0x69, 0xff]), {
      "content-type": "text/plain; charset=utf-8",
    });

    const result = await fetch402(client, { url: URL });

    expect(result.outputPath).toBeUndefined();
    expect(result.content).toBe("hi�");
  });

  test("returns an unlabeled body inline when it decodes cleanly as UTF-8", async () => {
    // Bytes without a content-type header: a string body would get an
    // automatic text/plain and never reach the sniffing path.
    stubResponse(new TextEncoder().encode('{"ok":true}'));

    const result = await fetch402(client, { url: URL });

    expect(result.outputPath).toBeUndefined();
    expect(result.content).toBe('{"ok":true}');
  });

  test("--output saves any body, text included, to the given path", async () => {
    stubResponse('{"ok":true}', { "content-type": "application/json" });
    const outputPath = join(tmpdir(), `fetch-binary-test-${process.pid}.json`);

    const result = await fetch402(client, { url: URL, outputPath });
    savedFiles.push(outputPath);

    expect(result.content).toBeUndefined();
    expect(result.outputPath).toBe(outputPath);
    expect(readFileSync(outputPath, "utf-8")).toBe('{"ok":true}');
  });

  test("falls back to base64 inline when a binary body cannot be saved", async () => {
    // A failed write must not throw away the (possibly paid) response.
    stubResponse(WAV_BYTES, { "content-type": "audio/wav" });
    const outputPath = join(tmpdir(), "no-such-dir", "out.wav");

    const result = await fetch402(client, { url: URL, outputPath });

    expect(result.outputPath).toBeUndefined();
    expect(result.writeError).toContain("ENOENT");
    expect(result.contentType).toBe("audio/wav");
    expect(
      new Uint8Array(Buffer.from(result.contentBase64!, "base64")),
    ).toEqual(WAV_BYTES);
  });

  test("falls back to inline text when a text body cannot be saved", async () => {
    stubResponse('{"ok":true}', { "content-type": "application/json" });
    const outputPath = join(tmpdir(), "no-such-dir", "out.json");

    const result = await fetch402(client, { url: URL, outputPath });

    expect(result.outputPath).toBeUndefined();
    expect(result.writeError).toContain("ENOENT");
    expect(result.content).toBe('{"ok":true}');
  });
});
