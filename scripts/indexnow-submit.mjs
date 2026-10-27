import { INDEXNOW_KEY, submitToIndexNow } from "../lib/indexnow.ts";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var ${name}`);
  }
  return value;
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: "error" });
  if (response.status !== 200) {
    throw new Error(`GET ${url} returned HTTP ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function main() {
  const origin = new URL(requireEnv("INDEXNOW_SITE_URL")).origin;

  const servedKey = (await fetchText(`${origin}/${INDEXNOW_KEY}.txt`)).trim();
  if (servedKey !== INDEXNOW_KEY) {
    throw new Error(`IndexNow key file at ${origin}/${INDEXNOW_KEY}.txt does not match the key in lib/indexnow.ts`);
  }

  const sitemap = await fetchText(`${origin}/sitemap.xml`);
  const urls = [...sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1].replaceAll("&amp;", "&"));
  if (urls.length === 0) {
    throw new Error(`No <loc> entries found in ${origin}/sitemap.xml`);
  }

  const status = await submitToIndexNow(origin, urls);
  console.log(`IndexNow: submitted ${urls.length} URLs for ${new URL(origin).host}, HTTP ${status}`);
}

await main();
