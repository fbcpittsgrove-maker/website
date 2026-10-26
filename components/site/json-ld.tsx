import { jsonLdScript } from "@/lib/seo";

/** Server-rendered JSON-LD — crawlers that run no JavaScript still see it. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />;
}
