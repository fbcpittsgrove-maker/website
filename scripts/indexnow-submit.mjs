import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { INDEXNOW_KEY, submitToIndexNow } from "../lib/indexnow.ts";
import { SLUG_RE } from "../lib/posts.ts";

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

async function publishedBatchUrls(origin, input) {
  const paths = new Set(input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  if (!paths.size) throw new Error("Expected published article paths on standard input.");
  const urls = [];
  for (const path of paths) {
    const match = /^\/(?:sermons|questions)\/([^/]+)$/.exec(path);
    if (!match || !SLUG_RE.test(match[1]) || match[1].length > 80) throw new Error(`Invalid article path: ${path}`);
    urls.push(origin + path);
  }

  const index = await fetchText(`${origin}/llms.txt`);
  const published = new Set([...index.matchAll(/^- \[.*?\]\((https:\/\/[^)\s]+)\): /gm)].map((match) => match[1]));
  const missing = urls.filter((url) => !published.has(url));
  if (missing.length) throw new Error(`Articles missing from the public index: ${missing.join(", ")}`);
  return urls;
}

export async function submitSiteUrls(origin, publishedPaths) {
  const servedKey = (await fetchText(`${origin}/${INDEXNOW_KEY}.txt`)).trim();
  if (servedKey !== INDEXNOW_KEY) {
    throw new Error(`IndexNow key file at ${origin}/${INDEXNOW_KEY}.txt does not match the key in lib/indexnow.ts`);
  }

  let urls;
  if (publishedPaths !== undefined) {
    urls = await publishedBatchUrls(origin, publishedPaths);
  } else {
    const sitemap = await fetchText(`${origin}/sitemap.xml`);
    urls = [...sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1].replaceAll("&amp;", "&"));
    if (urls.length === 0) throw new Error(`No <loc> entries found in ${origin}/sitemap.xml`);
  }

  const status = await submitToIndexNow(origin, urls);
  return { count: urls.length, status };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 1 || args[0] !== "--published-paths")) {
    throw new Error("Usage: node scripts/indexnow-submit.mjs [--published-paths]");
  }
  if (args.length && process.stdin.isTTY) throw new Error("Pipe the published article paths to --published-paths.");
  const origin = new URL(requireEnv("INDEXNOW_SITE_URL")).origin;
  const input = args.length ? readFileSync(0, "utf8") : undefined;
  const { count, status } = await submitSiteUrls(origin, input);
  console.log(`IndexNow: submitted ${count} URLs for ${new URL(origin).host}, HTTP ${status}`);
}
