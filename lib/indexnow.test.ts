import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { INDEXNOW_ENDPOINT, INDEXNOW_KEY, indexNowPayload, pagesShowing, submitToIndexNow } from "@/lib/indexnow";

const ORIGIN = "https://fbc.example";

afterEach(() => vi.unstubAllGlobals());

describe("indexNowPayload", () => {
  it("names the host, key and the key file the engines read back", () => {
    expect(indexNowPayload(ORIGIN, [`${ORIGIN}/events`])).toEqual({
      host: "fbc.example",
      key: INDEXNOW_KEY,
      keyLocation: `${ORIGIN}/${INDEXNOW_KEY}.txt`,
      urlList: [`${ORIGIN}/events`],
    });
  });

  it("refuses URLs from another host, plain http and an empty list", () => {
    expect(() => indexNowPayload(ORIGIN, ["https://other.example/"])).toThrow("is not on https://fbc.example");
    expect(() => indexNowPayload("http://fbc.example", [`${ORIGIN}/`])).toThrow("bare https origin");
    expect(() => indexNowPayload(ORIGIN, [])).toThrow("at least one URL");
  });

  it("serves the key file with the same key", () => {
    expect(readFileSync(`public/${INDEXNOW_KEY}.txt`, "utf8").trim()).toBe(INDEXNOW_KEY);
  });
});

describe("pagesShowing", () => {
  it("pings the home page plus the kind's own page", () => {
    expect(pagesShowing("events", ORIGIN)).toEqual([`${ORIGIN}/`, `${ORIGIN}/events`]);
    expect(pagesShowing("sermons", ORIGIN)).toEqual([`${ORIGIN}/`, `${ORIGIN}/sermons`]);
    expect(pagesShowing("announcements", ORIGIN)).toEqual([`${ORIGIN}/`]);
  });
});

describe("submitToIndexNow", () => {
  it("posts the payload and accepts 200 or 202", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(submitToIndexNow(ORIGIN, [`${ORIGIN}/`])).resolves.toBe(202);
    expect(fetchMock).toHaveBeenCalledWith(INDEXNOW_ENDPOINT, expect.objectContaining({ method: "POST" }));
  });

  it("fails loud on a rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Key not valid", { status: 403, statusText: "Forbidden" })));
    await expect(submitToIndexNow(ORIGIN, [`${ORIGIN}/`])).rejects.toThrow("HTTP 403 Forbidden Key not valid");
  });
});
