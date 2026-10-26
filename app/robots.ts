import type { MetadataRoute } from "next";

/** Only production is indexed; the signed-in surfaces never are. */
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/login", "/auth"] } };
}
