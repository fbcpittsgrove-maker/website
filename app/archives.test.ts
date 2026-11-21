import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import BlogPage from "@/app/(site)/blog/page";
import SermonsPage from "@/app/(site)/sermons/page";
import { publicSermonArchive } from "@/lib/content-server";
import { publicBlogArchive } from "@/lib/posts-server";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", async (original) => ({
  ...await original<typeof import("next/navigation")>(),
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function serveArchive(count: number) {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://database.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-anon-key");
  const rows = Array.from({ length: count }, (_, i) => {
    const id = String(i).padStart(4, "0");
    const sermon = {
      id, title: `Message ${i}`, preacher: "TJ Bradbury", scripture: "John 1", summary: "",
      preached_on: i % 2 ? "2024-04-21" : "2026-10-25", audio_url: null, video_url: null,
    };
    const post = {
      id, kind: i === 0 ? "question" : "sermon", slug: `post-${i}`, title: `Post ${i}`, description: "", question: "",
      sermon: i === 0 ? null : sermon, published_at: "2026-10-28T12:00:00Z", pinned_at: i === 2 ? "2026-10-28T12:00:00Z" : null,
    };
    return { id, sermon, post, published: i !== 1, status: i === 3 ? "draft" : "published" };
  });
  const fetchPage = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const params = url.searchParams;
    const cursor = params.get("id")?.replace(/^gt\./, "") ?? "";
    const limit = Math.min(Number(params.get("limit")), 75);
    const remaining = rows.filter((row) => row.id > cursor);
    const select = params.get("select")!;
    if (url.pathname.endsWith("/sermons")) {
      expect(params.get("published")).toBe("eq.true");
      expect(params.get("posts.kind")).toBe("eq.sermon");
      expect(params.get("posts.status")).toBe("eq.published");
      expect(select).toContain("posts!posts_sermon_id_fkey(slug,pinned_at)");
      expect(params.get("order")).toBe("id.asc");
      return Response.json(remaining.filter((r) => r.published).slice(0, limit).map(({ sermon, post, status }) => ({
        ...sermon, posts: status === "published" && post.kind === "sermon" ? [{ slug: post.slug, pinned_at: post.pinned_at }] : [],
      })));
    }
    expect(url.pathname).toBe("/rest/v1/posts");
    const visible = remaining.filter((r) => r.status === "published");
    if (params.get("kind") === "eq.question") return Response.json(visible.filter((r) => r.post.kind === "question").slice(0, limit).map((r) => r.post));
    expect(params.get("status")).toBe("eq.published");
    expect(params.get("order")).toBe("id.asc");
    if (params.has("body_md")) {
      expect(params.get("body_md")).toBe("plfts(english).forgiveness");
      expect(select).toBe("id");
      return Response.json(visible.slice(0, limit).map(({ id }) => ({ id })));
    }
    expect(select).not.toMatch(/body_md|reviewer_notes|transcript/);
    return Response.json(visible.slice(0, limit).map((r) => r.post));
  });
  vi.stubGlobal("fetch", fetchPage);
  return fetchPage;
}

it("reads published sermons, blog summaries and full-text hits past the former listing limits", async () => {
  serveArchive(225);
  const [sermons, blog] = await Promise.all([publicSermonArchive(), publicBlogArchive("forgiveness")]);
  expect(sermons).toHaveLength(224);
  expect(sermons.at(-1)?.id).toBe("0224");
  expect(sermons.find((s) => s.id === "0003")?.postSlug).toBeUndefined();
  expect(sermons.some((s) => s.id === "0001")).toBe(false);
  expect(blog.posts).toHaveLength(224);
  expect(blog.bodyMatches.size).toBe(224);
  expect(blog.bodyMatches.has("0224")).toBe(true);
  expect(blog.bodyMatches.has("0003")).toBe(false);
});

it("renders the archive controls, every month, featured links and sermons without a written post", async () => {
  serveArchive(5);
  const html = renderToStaticMarkup(await SermonsPage({ searchParams: Promise.resolve({}) }));
  expect(html).toContain("Newest first");
  expect(html).toContain("All years");
  expect(html).toContain("4 sermons");
  expect(html.indexOf("October 2026")).toBeGreaterThan(-1);
  expect(html.indexOf("April 2024")).toBeGreaterThan(html.indexOf("October 2026"));
  expect(html).toContain('href="#sermon-0002"');
  expect(html.match(/id="sermon-0002"/g)).toHaveLength(1);
  expect(html).toContain("Message 3");
  expect(html).not.toContain("/sermons/post-3");
});

it("renders shared blog searches with working article links, result counts and a reset for empty results", async () => {
  const fetchPage = serveArchive(5);
  const search = { type: "question", q: "forgiveness", year: "2026" };
  const html = renderToStaticMarkup(await BlogPage({ searchParams: Promise.resolve(search) }));
  expect(html).toContain("Bible questions");
  expect(html).toContain("1 post");
  expect(html).toContain('href="/questions/post-0"');
  expect(html).toContain("October 28, 2026");
  expect(html).not.toContain("/sermons/post-2");
  fetchPage.mockClear();
  const empty = renderToStaticMarkup(await BlogPage({ searchParams: Promise.resolve({ year: "2010" }) }));
  expect(empty).toContain("No posts match");
  expect(empty).toContain('href="/blog"');
  expect(fetchPage.mock.calls.every(([url]) => !String(url).includes("body_md="))).toBe(true);
});
