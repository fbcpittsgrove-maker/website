import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseTimestamp } from "../lib/posts.ts";

/**
 * Stages one sermon's blog drafts on the site — never publishes.
 *
 *   node scripts/import-sermon.mjs <folder> [--url https://…] [--replace]
 *
 * <folder>/sermon.md        the sermon post (kind: sermon)
 * <folder>/questions/*.md   question pages + sermon ideas (kind: question)
 * <folder>/transcript.json  whisper.cpp -oj output (optional)
 *
 * Posts to <url>/api/posts with SCHEMA_PEER_SECRET. Defaults to the local
 * dev server (dev database); pass --url with the production site to stage
 * drafts for review there. An existing unpublished post is left alone
 * unless --replace is passed (a revised draft after "Send back").
 */

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  const value = process.argv[i + 1];
  if (!value) throw new Error(`${flag} needs a value`);
  return value;
}

async function readTranscript(folder) {
  let raw;
  try {
    raw = await readFile(join(folder, "transcript.json"), "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
  const json = JSON.parse(raw);
  if (!Array.isArray(json.transcription)) throw new Error("transcript.json has no transcription array (expected whisper.cpp -oj output)");
  const segments = json.transcription.map((s) => ({ start: Math.round(s.offsets.from / 1000), text: s.text.trim() }));
  return {
    body: segments.map((s) => s.text).join("\n"),
    segments,
    engine: `whisper.cpp ${json.model?.type ?? ""}`.trim(),
  };
}

async function main() {
  const folder = process.argv[2];
  if (!folder || folder.startsWith("--")) throw new Error("Usage: node scripts/import-sermon.mjs <folder> [--url https://…] [--replace]");
  process.loadEnvFile(".env.local");
  const secret = requireEnv("SCHEMA_PEER_SECRET");
  const url = (argValue("--url") ?? "http://localhost:3150").replace(/\/+$/, "");

  const sermon = await readFile(join(folder, "sermon.md"), "utf8");
  const questionDir = join(folder, "questions");
  const names = (await readdir(questionDir).catch((e) => (e.code === "ENOENT" ? [] : Promise.reject(e))))
    .filter((n) => n.endsWith(".md"))
    .sort();
  const questions = await Promise.all(
    names.map(async (name) => {
      const file = await readFile(join(questionDir, name), "utf8");
      const start = /^start:\s*"?([\d:]+)"?\s*$/m.exec(file);
      return { file, start_seconds: start ? parseTimestamp(start[1]) : null };
    }),
  );
  const transcript = await readTranscript(folder);

  const response = await fetch(`${url}/api/posts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "import", sermon, questions, transcript, replace: process.argv.includes("--replace") }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    throw new Error(`Import to ${url} failed: HTTP ${response.status} ${result?.error ?? ""}`.trim());
  }
  console.log(`Staged on ${url} (sermon ${result.sermon_id}):`);
  for (const r of result.results) console.log(`  ${r.outcome.padEnd(18)} ${r.slug}`);
}

await main();
