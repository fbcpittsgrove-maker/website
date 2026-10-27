import type { ContentKind } from "@/lib/content";

/** Public by design: Bing and the other IndexNow engines read it back from
 *  /<key>.txt (public/) to confirm a submit came from this site. */
export const INDEXNOW_KEY = "f87f266e101129a8c576993bda85dce9";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

const MAX_URLS = 10_000;

export type IndexNowPayload = { host: string; key: string; keyLocation: string; urlList: string[] };

export function indexNowPayload(origin: string, urls: readonly string[]): IndexNowPayload {
  const site = new URL(origin);
  if (site.protocol !== "https:" || site.pathname !== "/" || site.search || site.hash) {
    throw new Error(`IndexNow origin must be a bare https origin, got ${origin}`);
  }
  if (urls.length === 0) {
    throw new Error("IndexNow needs at least one URL to submit");
  }
  if (urls.length > MAX_URLS) {
    throw new Error(`IndexNow accepts at most ${MAX_URLS} URLs per request, got ${urls.length}`);
  }
  const urlList = urls.map((value) => {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.host !== site.host) {
      throw new Error(`IndexNow URL ${value} is not on ${site.origin}`);
    }
    return value;
  });
  return { host: site.host, key: INDEXNOW_KEY, keyLocation: `${site.origin}/${INDEXNOW_KEY}.txt`, urlList };
}

export async function submitToIndexNow(origin: string, urls: readonly string[]): Promise<200 | 202> {
  const payload = indexNowPayload(origin, urls);
  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (response.status !== 200 && response.status !== 202) {
    const body = await response.text();
    throw new Error(`IndexNow rejected ${payload.urlList.length} URLs for ${payload.host}: HTTP ${response.status} ${response.statusText} ${body}`.trim());
  }
  return response.status;
}

/** Public pages that show a content kind: the home page lists all three,
 *  events and sermons also have their own page. */
export function pagesShowing(kind: ContentKind, origin: string): string[] {
  const own = kind === "announcements" ? [] : [`${origin}/${kind}`];
  return [`${origin}/`, ...own];
}
