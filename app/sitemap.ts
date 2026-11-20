import type { MetadataRoute } from "next";
import { postPath } from "@/lib/posts";
import { publishedPostIndex } from "@/lib/posts-server";
import { PUBLIC_PAGES, siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const { sermons, questions } = await publishedPostIndex();
  return [
    ...PUBLIC_PAGES.map(({ path }) => ({ url: `${base}${path}` })),
    ...[...sermons, ...questions].map((p) => ({ url: `${base}${postPath(p.kind, p.slug)}`, lastModified: p.published_at })),
  ];
}
