import type { MetadataRoute } from "next";
import { postPath } from "@/lib/posts";
import { publishedPosts } from "@/lib/posts-server";
import { PUBLIC_PAGES, siteUrl } from "@/lib/seo";

/** No priority/changefreq (Google ignores them) and no lastmod until a page
 *  has an honest content-modified date — posts have one (published_at).
 *  Publishing a post revalidates this route. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [sermons, questions] = await Promise.all([publishedPosts("sermon"), publishedPosts("question")]);
  return [
    ...PUBLIC_PAGES.map(({ path }) => ({ url: `${base}${path}` })),
    ...[...sermons, ...questions].map((p) => ({ url: `${base}${postPath(p.kind, p.slug)}`, lastModified: p.published_at })),
  ];
}
