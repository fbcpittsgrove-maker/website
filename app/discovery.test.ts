import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as llms } from "@/app/llms.txt/route";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { postPath, type PostKind } from "@/lib/posts";
import { PUBLIC_PAGES } from "@/lib/seo";

vi.mock("server-only", () => ({}));

const origin = "https://fbc.example";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function servePosts(count: number) {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://database.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-anon-key");
  const posts = Array.from({ length: count }, (_, index) => ({
    id: String(index).padStart(5, "0"),
    kind: (index % 2 === 0 ? "sermon" : "question") as PostKind,
    slug: `post-${index}`,
    title: `Post ${index}`,
    description: "Description",
    status: "published",
    published_at: "2026-07-22T00:00:00Z",
  }));
  const fetchPage = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    expect(url.pathname).toBe("/rest/v1/posts");
    expect(url.searchParams.get("order")).toBe("id.asc");
    expect(url.searchParams.get("status")).toBe("eq.published");
    const cursor = url.searchParams.get("id")?.replace(/^gt\./, "");
    const limit = Math.min(Number(url.searchParams.get("limit")), 100);
    return Response.json(posts.filter((p) => p.status === "published" && (!cursor || p.id > cursor)).slice(0, limit));
  });
  vi.stubGlobal("fetch", fetchPage);
  return { posts, fetchPage };
}

describe("sitemap and llms.txt", () => {
  it("includes every published post across page boundaries, even when publication times are identical", async () => {
    const { posts } = servePosts(413);
    posts[3].status = "draft";
    posts[8].status = "idea";
    const urls = [
      ...PUBLIC_PAGES.map((p) => origin + p.path),
      ...posts.filter((p) => p.status === "published").map((p) => origin + postPath(p.kind, p.slug)),
    ].sort();
    expect((await sitemap()).map((entry) => entry.url).sort()).toEqual(urls);
    const markdown = await (await llms()).text();
    expect([...markdown.matchAll(/^- \[.*?\]\((https:\/\/[^)]+)\): /gm)].map((m) => m[1]).sort()).toEqual(urls);
  });

  it("reads subsequent publications and removals on the next request", async () => {
    const { posts } = servePosts(2);
    posts[1].status = "draft";
    expect((await sitemap()).map((p) => p.url)).toContain(origin + "/sermons/post-0");
    expect(await (await llms()).text()).not.toContain("/questions/post-1");
    posts[0].status = "draft";
    posts[1].status = "published";
    const urls = (await sitemap()).map((p) => p.url);
    expect(urls).toContain(origin + "/questions/post-1");
    expect(urls).not.toContain(origin + "/sermons/post-0");
    expect(await (await llms()).text()).toContain("/questions/post-1");
  });

  it("fails the request when a later page cannot be read", async () => {
    const { fetchPage } = servePosts(220);
    const first = fetchPage.getMockImplementation()!;
    fetchPage.mockImplementationOnce(first).mockResolvedValueOnce(Response.json({ message: "read denied" }, { status: 403 }));
    await expect(sitemap()).rejects.toThrow("read denied");
  });
});

describe("robots.txt", () => {
  it("gives named and unlisted crawlers the public site and excludes private routes", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin);
    const { rules, sitemap: url } = robots();
    const groups = Array.isArray(rules) ? rules : [rules];
    const names = groups.flatMap((group) => group.userAgent ?? []);
    expect(names).toEqual(expect.arrayContaining(["*", "Bytespider", "Googlebot", "Bingbot", "OAI-SearchBot", "ClaudeBot"]));
    for (const group of groups) {
      expect(group.allow).toBe("/");
      expect(group.disallow).toEqual(expect.arrayContaining(["/admin", "/account", "/login", "/auth/", "/api/"]));
      expect(group.disallow).not.toContain("/");
    }
    expect(url).toBe(origin + "/sitemap.xml");
  });

  it("excludes all crawlers outside production", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(robots().rules).toEqual({ userAgent: "*", disallow: "/" });
  });
});
