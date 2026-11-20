import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { INDEXNOW_ENDPOINT, INDEXNOW_KEY, indexNowPayload, pagesShowing, submitToIndexNow } from "@/lib/indexnow";
import { submitSiteUrls } from "../scripts/indexnow-submit.mjs";

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

describe("terminal publication notifications", () => {
  function serveFiles(files: Record<string, string>) {
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === INDEXNOW_ENDPOINT && options?.method === "POST") return new Response(null, { status: 202 });
      const body = files[url];
      return new Response(body ?? null, { status: body === undefined ? 404 : 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const keyFile = { [`${ORIGIN}/${INDEXNOW_KEY}.txt`]: INDEXNOW_KEY };
  const livePosts = {
    ...keyFile,
    [`${ORIGIN}/llms.txt`]: [
      `- [A sermon](${ORIGIN}/sermons/message): Description`,
      `- [A question](${ORIGIN}/questions/answer): Description`,
      `- [An older question](${ORIGIN}/questions/older): Description`,
    ].join("\n"),
  };

  it("submits exactly the verified batch once, even when the sitemap is stale", async () => {
    const fetchMock = serveFiles(livePosts);
    const paths = "/sermons/message\r\n/questions/answer\r\n/sermons/message\r\n";
    await expect(submitSiteUrls(ORIGIN, paths)).resolves.toEqual({ count: 2, status: 202 });
    const submissions = fetchMock.mock.calls.filter(([url]) => url === INDEXNOW_ENDPOINT);
    expect(submissions).toHaveLength(1);
    expect(JSON.parse(String(submissions[0][1]?.body)).urlList).toEqual([
      `${ORIGIN}/sermons/message`, `${ORIGIN}/questions/answer`,
    ]);
  });

  it.each(["", "/admin/posts", "/sermons/../private", "//other.example/questions/a", "/questions/answer?draft=1",
    "/sermons/message\n/questions/still-a-draft"])("rejects an incomplete or invalid publication before submission (%s)", async (paths) => {
    const fetchMock = serveFiles(livePosts);
    await expect(submitSiteUrls(ORIGIN, paths)).rejects.toThrow();
    expect(fetchMock.mock.calls.some(([url]) => url === INDEXNOW_ENDPOINT)).toBe(false);
  });

  it("checks the served key before submitting URLs", async () => {
    const fetchMock = serveFiles({ ...livePosts, [`${ORIGIN}/${INDEXNOW_KEY}.txt`]: "different-key" });
    await expect(submitSiteUrls(ORIGIN, "/sermons/message")).rejects.toThrow("does not match");
    expect(fetchMock.mock.calls.some(([url]) => url === INDEXNOW_ENDPOINT)).toBe(false);
  });

  it("still supports the whole-sitemap command", async () => {
    const mock = serveFiles({ ...keyFile, [`${ORIGIN}/sitemap.xml`]: `<urlset><url><loc>${ORIGIN}/</loc></url></urlset>` });
    await expect(submitSiteUrls(ORIGIN, undefined)).resolves.toEqual({ count: 1, status: 202 });
    expect(mock.mock.calls.some(([url]) => url.endsWith("/llms.txt"))).toBe(false);
  });
});
