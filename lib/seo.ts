import { CHURCH } from "@/lib/church";

/**
 * SEO plumbing, following C:\CODE\blog-engine (knowledge/05-schema,
 * 08-publish-index, 13-local-seo): one JSON-LD @graph per page linked by
 * stable @ids, every schema fact also visible on the page, absolute URLs.
 */

/** The site's absolute origin — canonical URLs, the sitemap, llms.txt and
 *  structured data are all built from it. */
export function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SITE_URL is not set");
  return url.replace(/\/+$/, "");
}

export type PublicPage = { path: string; name: string; title: string; description: string };

/** Suffix every inner page's <title> gets (the home title is absolute). */
export const TITLE_SUFFIX = " · Faith Baptist Pittsgrove";

/** Public pages: sitemap order, per-page title + description (full titles
 *  30–60 characters, descriptions 120–160), and the llms.txt page list. */
export const PUBLIC_PAGES: PublicPage[] = [
  {
    path: "/",
    name: "Home",
    title: "Faith Baptist Church · Pittsgrove, NJ",
    description:
      "An independent Baptist church in Pittsgrove, New Jersey, preaching from the King James Bible. Service times, events, sermons and directions.",
  },
  {
    path: "/visit",
    name: "Plan Your Visit",
    title: "Service Times & Directions",
    description:
      "Planning your first visit to Faith Baptist Church in Pittsgrove, NJ? Sunday, Wednesday and Saturday service times, our Greenville Rd address and what to expect.",
  },
  {
    path: "/about",
    name: "About",
    title: "About Us & Our Pastors",
    description:
      "Who we are and what we believe: an independent Baptist church in Pittsgrove, NJ that preaches from the King James Bible. Meet our pastors and church family.",
  },
  {
    path: "/ministries",
    name: "Ministries",
    title: "Ministries & Camp Meetings",
    description:
      "Sunday School, midweek services, the bus ministry, camp meetings, the ladies' ministry, hymn sings and discipleship at Faith Baptist Church, Pittsgrove NJ.",
  },
  {
    path: "/sermons",
    name: "Sermons",
    title: "Sermons",
    description:
      "Recent sermons preached at Faith Baptist Church of Pittsgrove, New Jersey, with the scripture passage, a short summary, and links to watch or listen again.",
  },
  {
    path: "/events",
    name: "Events",
    title: "Upcoming Events",
    description:
      "Upcoming special services, camp meetings, fellowship days and church events at Faith Baptist Church in Pittsgrove, New Jersey. All times are Eastern.",
  },
  {
    path: "/contact",
    name: "Contact",
    title: "Contact & Directions",
    description:
      "Get in touch with Faith Baptist Church of Pittsgrove: our address at 465 Greenville Rd, Pittsgrove, NJ 08318, directions, and how to message us on Facebook.",
  },
];

export function publicPage(path: string): PublicPage {
  const page = PUBLIC_PAGES.find((p) => p.path === path);
  if (!page) throw new Error(`No SEO entry for public page ${path}`);
  return page;
}

type JsonLd = Record<string, unknown>;

export function postalAddress(): JsonLd {
  const { street, city, state, zip } = CHURCH.address;
  return {
    "@type": "PostalAddress",
    streetAddress: street,
    addressLocality: city,
    addressRegion: state,
    postalCode: zip,
    addressCountry: "US",
  };
}

/** Sitewide graph: the Church (the one organization node, referenced by
 *  @id everywhere else) and the WebSite it publishes. */
export function siteGraph(base = siteUrl()): JsonLd {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Church",
        "@id": `${base}/#organization`,
        name: CHURCH.fullName,
        description: `${CHURCH.tagline}.`,
        url: `${base}/`,
        ...(CHURCH.heroImage ? { image: `${base}${CHURCH.heroImage.wide}` } : {}),
        address: postalAddress(),
        ...(CHURCH.phone ? { telephone: CHURCH.phone } : {}),
        ...(CHURCH.email ? { email: CHURCH.email } : {}),
        sameAs: [CHURCH.facebook],
      },
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        url: `${base}/`,
        name: CHURCH.fullName,
        publisher: { "@id": `${base}/#organization` },
        inLanguage: "en-US",
      },
    ],
  };
}

export type EventForLd = { id: string; title: string; description: string; location: string; starts_at: string; ends_at: string | null };

/** schema.org Event per upcoming published event, organized by the church
 *  node and held at the church unless the event names another place. */
export function eventsGraph(events: EventForLd[], base = siteUrl()): JsonLd {
  return {
    "@context": "https://schema.org",
    "@graph": events.map((e) => ({
      "@type": "Event",
      "@id": `${base}/events#event-${e.id}`,
      name: e.title,
      ...(e.description ? { description: e.description } : {}),
      startDate: new Date(e.starts_at).toISOString(),
      ...(e.ends_at ? { endDate: new Date(e.ends_at).toISOString() } : {}),
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: { "@type": "Place", name: e.location || CHURCH.fullName, address: postalAddress() },
      organizer: { "@id": `${base}/#organization` },
      url: `${base}/events`,
    })),
  };
}

/** JSON for a <script type="application/ld+json"> body. `<` is escaped so a
 *  title containing "</script>" can never close the tag early. */
export function jsonLdScript(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** The generated share card (app/opengraph-image.tsx). */
export const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Faith Baptist Church of Pittsgrove, Pittsgrove, New Jersey",
};

/** Next metadata for a public page: unique title, description, canonical,
 *  and complete Open Graph / Twitter tags. A page's openGraph replaces the
 *  layout's wholesale, so every field is restated here. */
export function pageMetadata(path: string) {
  const page = publicPage(path);
  const title = path === "/" ? { absolute: page.title } : page.title;
  const fullTitle = path === "/" ? page.title : `${page.title}${TITLE_SUFFIX}`;
  return {
    title,
    description: page.description,
    alternates: { canonical: path },
    openGraph: {
      type: "website" as const,
      siteName: CHURCH.fullName,
      locale: "en_US",
      title: fullTitle,
      description: page.description,
      url: path,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image" as const, title: fullTitle, description: page.description, images: [OG_IMAGE.url] },
  };
}
