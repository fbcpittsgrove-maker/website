import { describe, expect, it } from "vitest";
import { archiveHref, blogListing, MAX_SEARCH_LENGTH, readArchiveFilters, sermonListing, type ArchiveSort } from "@/lib/archive";
import type { BlogPost } from "@/lib/posts-server";

const defaults = readArchiveFilters("/blog", {});

describe("archive controls", () => {
  it("round-trips the selected controls, including punctuation in a search", () => {
    const filters = readArchiveFilters("/blog", { sort: "oldest", year: "2026", type: "sermon", q: "  grace & mercy  " });
    const url = new URL(archiveHref("/blog", filters), "https://church.example");
    expect(readArchiveFilters("/blog", Object.fromEntries(url.searchParams))).toEqual({ ...filters, q: "grace & mercy" });
    expect(archiveHref("/sermons", readArchiveFilters("/sermons", { type: "question", q: "mercy" }))).toBe("/sermons");
  });

  it("rejects malformed options and bounds a shared search URL", () => {
    expect(readArchiveFilters("/blog", { sort: ["oldest"], type: "draft", year: "26", q: ["duplicate"] })).toEqual(defaults);
    expect(readArchiveFilters("/blog", { q: "a".repeat(200) }).q).toHaveLength(MAX_SEARCH_LENGTH);
    expect(archiveHref("/blog", defaults)).toBe("/blog");
  });
});

describe("sermon order", () => {
  const sermons = [
    { id: "a", preached_on: "2025-12-31", title: "Message 10" },
    { id: "b", preached_on: "2026-01-01", title: "Message 2" },
    { id: "c", preached_on: "2026-01-01", title: "A beginning" },
    { id: "d", preached_on: "2026-10-25", title: "Zion" },
  ];
  it.each<[ArchiveSort, string[], string[]]>([
    ["newest", ["October 2026", "January 2026", "December 2025"], ["d", "c", "b", "a"]],
    ["oldest", ["December 2025", "January 2026", "October 2026"], ["a", "c", "b", "d"]],
    ["title-asc", [""], ["c", "b", "a", "d"]],
    ["title-desc", [""], ["d", "a", "b", "c"]],
  ])("applies %s across the entire archive", (sort, labels, ids) => {
    const { groups } = sermonListing(sermons, { ...defaults, sort });
    expect(groups.map((g) => g.label)).toEqual(labels);
    expect(groups.flatMap((g) => g.items.map((s) => s.id))).toEqual(ids);
  });
});

describe("blog dates and search", () => {
  const sermon: BlogPost = {
    id: "s", kind: "sermon", slug: "light", title: "Walk in the light", description: "A message about hope.",
    question: "", published_at: "2026-10-27T20:00:00Z", pinned_at: null,
    sermon: { title: "Sunday evening", preacher: "TJ Bradbury", scripture: "John 8:12", preached_on: "2025-09-14" },
  };
  const question: BlogPost = {
    ...sermon, id: "q", kind: "question", slug: "trust", title: "Trust", description: "",
    question: "How can I have faith?", published_at: "2026-01-01T02:30:00Z", sermon: null,
  };
  const legacy: BlogPost = { ...sermon, id: "legacy", sermon: null };
  const posts = [sermon, question, legacy];

  it("uses the service date for sermons and the church's publication day for questions and unlinked posts", () => {
    const result = blogListing(posts, defaults, new Set());
    expect(result.years).toEqual(["2026", "2025"]);
    expect(result.posts.map((p) => [p.id, p.day, p.preached])).toEqual([
      ["legacy", "2026-10-27", false], ["q", "2025-12-31", false], ["s", "2025-09-14", true],
    ]);
  });

  it.each(["LIGHT", "hope", "sunday", "Bradbury", "john 8:12", "TJ light"])("finds sermon metadata for %s", (q) => {
    expect(blogListing(posts, { ...defaults, q, year: "2025", type: "sermon" }, new Set()).posts.map((p) => p.id)).toEqual(["s"]);
  });

  it("combines type and year with body matches or the question text", () => {
    const filters = { ...defaults, type: "question" as const, year: "2025" };
    expect(blogListing(posts, { ...filters, q: "FAITH?" }, new Set()).posts.map((p) => p.id)).toEqual(["q"]);
    expect(blogListing(posts, { ...filters, q: "forgiveness" }, new Set(["q", "s", "legacy"])).posts.map((p) => p.id)).toEqual(["q"]);
    expect(blogListing(posts, { ...filters, year: "2026", q: "faith" }, new Set(["q"])).posts).toEqual([]);
    expect(blogListing(posts, { ...filters, q: "!!!" }, new Set()).posts).toEqual([]);
  });
});
