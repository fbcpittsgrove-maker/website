import { afterEach, describe, expect, it, vi } from "vitest";
import { CHURCH, phoneHref } from "@/lib/church";
import { PUBLIC_PAGES, TITLE_SUFFIX, eventsGraph, jsonLdScript, pageMetadata, postGraph, postMetadata, siteGraph, siteUrl } from "@/lib/seo";

const BASE = "https://fbc.example";

afterEach(() => vi.unstubAllEnvs());

describe("siteUrl", () => {
  it("strips a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fbc.example/");
    expect(siteUrl()).toBe(BASE);
  });

  it("fails loud when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(() => siteUrl()).toThrow("NEXT_PUBLIC_SITE_URL is not set");
  });
});

describe("page titles and descriptions", () => {
  it("keeps every full title within 30–60 characters", () => {
    for (const p of PUBLIC_PAGES) {
      const full = p.path === "/" ? p.title : p.title + TITLE_SUFFIX;
      expect(full.length, full).toBeGreaterThanOrEqual(30);
      expect(full.length, full).toBeLessThanOrEqual(60);
    }
  });

  it("keeps every description within 120–160 characters", () => {
    for (const p of PUBLIC_PAGES) {
      expect(p.description.length, p.path).toBeGreaterThanOrEqual(120);
      expect(p.description.length, p.path).toBeLessThanOrEqual(160);
    }
  });

  it("never repeats a title or description", () => {
    expect(new Set(PUBLIC_PAGES.map((p) => p.title)).size).toBe(PUBLIC_PAGES.length);
    expect(new Set(PUBLIC_PAGES.map((p) => p.description)).size).toBe(PUBLIC_PAGES.length);
  });

  it("gives the home page an absolute title and every page a canonical", () => {
    expect(pageMetadata("/").title).toEqual({ absolute: PUBLIC_PAGES[0].title });
    expect(pageMetadata("/visit")).toMatchObject({ title: "Service Times & Directions", alternates: { canonical: "/visit" } });
  });

  it("restates the full Open Graph block with the share card on every page", () => {
    for (const p of PUBLIC_PAGES) {
      const og = pageMetadata(p.path).openGraph;
      expect(og).toMatchObject({ type: "website", siteName: CHURCH.fullName, url: p.path });
      expect(og.images[0]).toMatchObject({ url: "/opengraph-image", width: 1200, height: 630 });
    }
  });

  it("refuses a page with no SEO entry", () => {
    expect(() => pageMetadata("/nope")).toThrow("No SEO entry for public page /nope");
  });
});

describe("structured data", () => {
  it("declares one church node and a website that points at it", () => {
    const graph = siteGraph(BASE)["@graph"] as Record<string, unknown>[];
    expect(graph.filter((n) => n["@type"] === "Church")).toHaveLength(1);
    const church = graph.find((n) => n["@type"] === "Church")!;
    expect(church).toMatchObject({
      "@id": `${BASE}/#organization`,
      name: CHURCH.fullName,
      url: `${BASE}/`,
      address: { streetAddress: CHURCH.address.street, postalCode: CHURCH.address.zip, addressCountry: "US" },
      sameAs: [CHURCH.facebook],
    });
    expect(graph.find((n) => n["@type"] === "WebSite")).toMatchObject({ publisher: { "@id": `${BASE}/#organization` } });
  });

  it("only includes contact details that exist", () => {
    const church = (siteGraph(BASE)["@graph"] as Record<string, unknown>[])[0];
    expect("telephone" in church).toBe(Boolean(CHURCH.phone));
    expect("email" in church).toBe(Boolean(CHURCH.email));
  });

  it("builds call and text links from the church phone", () => {
    expect(phoneHref("tel")).toBe("tel:+18563624851");
    expect(phoneHref("sms")).toBe("sms:+18563624851");
  });

  it("describes events with ISO dates, the church as organizer, and a place", () => {
    const graph = eventsGraph(
      [
        { id: "a", title: "Revival", description: "", location: "", starts_at: "2026-11-08T23:00:00+00:00", ends_at: null },
        { id: "b", title: "Picnic", description: "Bring a dish", location: "Parvin State Park", starts_at: "2026-06-01T16:00:00Z", ends_at: "2026-06-01T19:00:00Z" },
      ],
      BASE,
    )["@graph"] as Record<string, unknown>[];
    expect(graph[0]).toMatchObject({
      name: "Revival",
      startDate: "2026-11-08T23:00:00.000Z",
      organizer: { "@id": `${BASE}/#organization` },
      location: { name: CHURCH.fullName },
    });
    expect("endDate" in graph[0]).toBe(false);
    expect("description" in graph[0]).toBe(false);
    expect(graph[1]).toMatchObject({ endDate: "2026-06-01T19:00:00.000Z", description: "Bring a dish", location: { name: "Parvin State Park" } });
  });

  it("credits the preacher on a sermon post and the church on a question page", () => {
    const post = {
      kind: "sermon" as const,
      slug: "the-promise-of-heaven",
      title: "The Promise of Heaven",
      description: "d",
      published_at: "2026-10-26T15:00:00Z",
      updated_at: "2026-10-27T15:00:00Z",
      sermon: { preacher: "Steven Bradbury" },
    };
    const [article, crumbs] = postGraph(post, BASE)["@graph"] as Record<string, unknown>[];
    expect(article).toMatchObject({
      "@type": "BlogPosting",
      url: `${BASE}/sermons/the-promise-of-heaven`,
      datePublished: "2026-10-26T15:00:00.000Z",
      author: { "@type": "Person", name: "Steven Bradbury" },
      publisher: { "@id": `${BASE}/#organization` },
    });
    expect((crumbs.itemListElement as { name: string }[]).map((c) => c.name)).toEqual(["Home", "Sermons", "The Promise of Heaven"]);
    const question = (postGraph({ ...post, kind: "question" }, BASE)["@graph"] as Record<string, unknown>[])[0];
    expect(question).toMatchObject({ url: `${BASE}/questions/the-promise-of-heaven`, author: { "@id": `${BASE}/#organization` } });
  });

  it("gives a post an absolute title, canonical and article Open Graph", () => {
    const meta = postMetadata({ kind: "question", slug: "is-jesus-god", title: "Is Jesus God?", description: "d", published_at: "2026-10-26T15:00:00Z", updated_at: "2026-10-26T15:00:00Z" });
    expect(meta).toMatchObject({ title: { absolute: "Is Jesus God?" }, alternates: { canonical: "/questions/is-jesus-god" }, openGraph: { type: "article" } });
  });

  it("can't be broken out of its script tag by content", () => {
    const out = jsonLdScript({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});
