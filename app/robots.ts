import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

const disallow = ["/admin", "/account", "/login", "/forgot-password", "/update-password", "/auth/", "/api/"];

/** Search and AI-answer crawlers named explicitly (blog-engine 08), so a
 *  blanket rule can never shut them out by accident. */
const namedCrawlers = [
  "Googlebot",
  "Google-Extended",
  "Bingbot",
  "Applebot",
  "Applebot-Extended",
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "PerplexityBot",
  "Perplexity-User",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  "CCBot",
  "DuckAssistBot",
];

/** Only production is indexed; the signed-in surfaces never are. */
export default function robots(): MetadataRoute.Robots {
  const env = process.env.VERCEL_ENV;
  if (env !== "production") {
    if (process.env.VERCEL && env !== "preview" && env !== "development") {
      throw new Error(`robots.ts: unexpected VERCEL_ENV "${env ?? "unset"}" on a Vercel build`);
    }
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      { userAgent: namedCrawlers, allow: "/", disallow },
      { userAgent: "Bytespider", disallow: "/" },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
