import { utcToChurchLocal } from "@/lib/content";
import type { PostKind } from "@/lib/posts";
import type { BlogPost } from "@/lib/posts-server";

export const ARCHIVE_SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
] as const;

export type ArchivePath = "/sermons" | "/blog";
export type ArchiveParams = Record<string, string | string[] | undefined>;
export type ArchiveSort = (typeof ARCHIVE_SORTS)[number]["value"];
export type ArchiveFilters = { sort: ArchiveSort; year: string; type: PostKind | ""; q: string };
export const MAX_SEARCH_LENGTH = 160;

export function readArchiveFilters(path: ArchivePath, params: ArchiveParams): ArchiveFilters {
  const sort = ARCHIVE_SORTS.find((option) => option.value === params.sort)?.value ?? "newest";
  const year = typeof params.year === "string" && /^\d{4}$/.test(params.year) ? params.year : "";
  const type = path === "/blog" && (params.type === "sermon" || params.type === "question") ? params.type : "";
  const q = path === "/blog" && typeof params.q === "string" ? params.q.trim().slice(0, MAX_SEARCH_LENGTH).trimEnd() : "";
  return { sort, year, type, q };
}

export function archiveHref(path: ArchivePath, filters: ArchiveFilters): string {
  const params = new URLSearchParams();
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.year) params.set("year", filters.year);
  if (path === "/blog" && filters.type) params.set("type", filters.type);
  if (path === "/blog" && filters.q) params.set("q", filters.q);
  return params.size ? `${path}?${params}` : path;
}

const titles = new Intl.Collator("en-US", { numeric: true, sensitivity: "base" });
const months = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

function archiveYears(days: string[]): string[] {
  return [...new Set(days.map((day) => day.slice(0, 4)))].sort().reverse();
}

function sortArchive<T extends { id: string; title: string; day: string }>(items: T[], sort: ArchiveSort): T[] {
  return [...items].sort((a, b) => {
    const title = titles.compare(a.title, b.title);
    const day = a.day.localeCompare(b.day);
    if (sort === "title-asc" || sort === "title-desc") {
      return (sort === "title-asc" ? title : -title) || -day || a.id.localeCompare(b.id);
    }
    return (sort === "oldest" ? day : -day) || title || a.id.localeCompare(b.id);
  });
}

export function sermonListing<T extends { id: string; title: string; preached_on: string }>(sermons: T[], filters: ArchiveFilters) {
  const dated = sermons.map((sermon) => ({ ...sermon, day: sermon.preached_on }));
  const matches = dated.filter((s) => !filters.year || s.day.startsWith(filters.year));
  const sorted = sortArchive(matches, filters.sort);
  const byDate = filters.sort === "newest" || filters.sort === "oldest";
  const groups = new Map<string, typeof sorted>();
  for (const sermon of sorted) {
    const month = byDate ? sermon.day.slice(0, 7) : "";
    const group = groups.get(month);
    if (group) group.push(sermon);
    else groups.set(month, [sermon]);
  }
  return {
    years: archiveYears(dated.map((sermon) => sermon.day)),
    count: sorted.length,
    groups: Array.from(groups, ([month, items]) => ({
      month,
      label: month ? months.format(new Date(`${month}-01T00:00:00Z`)) : "",
      items,
    })),
  };
}

function searchable(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/['’]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function blogListing(posts: BlogPost[], filters: ArchiveFilters, bodyMatches: ReadonlySet<string>) {
  const dated = posts.map((post) => {
    const preached = post.kind === "sermon" && post.sermon?.preached_on;
    return { ...post, day: preached || utcToChurchLocal(post.published_at).slice(0, 10), preached: !!preached };
  });
  const words = searchable(filters.q).split(" ").filter(Boolean);
  const matches = dated.filter((post) => {
    if (filters.year && !post.day.startsWith(filters.year)) return false;
    if (filters.type && post.kind !== filters.type) return false;
    if (!filters.q || bodyMatches.has(post.id)) return true;
    const text = searchable([post.title, post.description, post.question, post.sermon?.title,
      post.sermon?.preacher, post.sermon?.scripture].join(" "));
    return words.length > 0 && words.every((word) => text.includes(word));
  });
  return { years: archiveYears(dated.map((post) => post.day)), posts: sortArchive(matches, filters.sort) };
}
