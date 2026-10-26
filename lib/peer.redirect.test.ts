import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { peerFetch } from "./peer";

const realFetch = globalThis.fetch;

function jsonResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "application/json" } });
}

describe("peerFetch redirects", () => {
  beforeEach(() => {
    process.env.SCHEMA_PEER_URL = "https://board.example.com";
    process.env.SCHEMA_PEER_SECRET = "peer-secret";
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
    delete process.env.SCHEMA_PEER_URL;
    delete process.env.SCHEMA_PEER_SECRET;
  });

  it("sends the secret to the configured host", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse("{}"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await peerFetch("/api/roadmap");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://board.example.com/api/roadmap");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer peer-secret");
  });

  it("follows a same-origin redirect and keeps the secret", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 307, headers: { location: "/api/roadmap/v2" } }))
      .mockResolvedValueOnce(jsonResponse("{}"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await peerFetch("/api/roadmap");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [secondUrl, secondInit] = fetchMock.mock.calls[1];
    expect(secondUrl).toBe("https://board.example.com/api/roadmap/v2");
    expect((secondInit.headers as Record<string, string>).Authorization).toBe("Bearer peer-secret");
  });

  it("refuses a cross-host redirect and sends no header to the other host", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 307, headers: { location: "https://attacker.example.net/api/roadmap" } }),
      )
      .mockResolvedValue(jsonResponse("{}"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(peerFetch("/api/roadmap")).rejects.toThrow(/cross-host/i);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callsToAttacker = fetchMock.mock.calls.filter(
      ([url]) => new URL(String(url)).host === "attacker.example.net",
    );
    expect(callsToAttacker).toHaveLength(0);
  });
});
