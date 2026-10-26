import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, siteUrl } from "@/lib/seo";

/** No priority/changefreq (Google ignores them) and no lastmod until a page
 *  has an honest content-modified date. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PUBLIC_PAGES.map(({ path }) => ({ url: `${base}${path}` }));
}
