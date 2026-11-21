"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { Dropdown } from "@/components/dropdown";
import { ARCHIVE_SORTS, archiveHref, MAX_SEARCH_LENGTH, readArchiveFilters, type ArchiveFilters, type ArchiveParams, type ArchivePath } from "@/lib/archive";

const labelClass = "mb-1.5 block text-sm font-semibold text-ink";

export function ArchiveControls({ path, filters, years }: { path: ArchivePath; filters: ArchiveFilters; years: string[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const blog = path === "/blog";
  const yearOptions = filters.year && !years.includes(filters.year) ? [filters.year, ...years] : years;
  const currentUrl = archiveHref(path, filters);

  function navigate(change: ArchiveParams = {}) {
    const next = readArchiveFilters(path, { ...filters, q: input.current?.value ?? "", ...change });
    const href = archiveHref(path, next);
    if (href !== currentUrl) startTransition(() => router.push(href, { scroll: false }));
  }

  return (
    <form action={path} method="get" aria-label={blog ? "Find blog posts" : "Browse sermons"} aria-busy={pending}
      className="mb-6 border-b border-border pb-6"
      onSubmit={(event) => { event.preventDefault(); navigate(); }}>
      {blog && (
        <div className="mb-4">
          <label htmlFor="archive-search" className={labelClass}>Search the blog</label>
          <div className="flex max-w-xl gap-2">
            <input key={filters.q} ref={input} id="archive-search" type="search" name="q" defaultValue={filters.q}
              maxLength={MAX_SEARCH_LENGTH} readOnly={pending} placeholder="Title, keyword, or Scripture"
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-ink focus-visible:outline-2 focus-visible:outline-brand" />
            <button type="submit" disabled={pending}
              className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-on-brand hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50">
              Search
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div>
          <span className={labelClass}>Sort by</span>
          <Dropdown value={filters.sort} options={[...ARCHIVE_SORTS]} disabled={pending}
            ariaLabel={`Sort by, ${ARCHIVE_SORTS.find((s) => s.value === filters.sort)?.label}`}
            onChange={(sort) => navigate({ sort })} />
        </div>
        {blog && (
          <div>
            <span className={labelClass}>Post type</span>
            <Dropdown value={filters.type} disabled={pending} ariaLabel={`Post type, ${filters.type || "all posts"}`}
              options={[{ value: "", label: "All posts" }, { value: "sermon", label: "Sermons" }, { value: "question", label: "Bible questions" }]}
              onChange={(type) => navigate({ type })} />
          </div>
        )}
        <div>
          <span className={labelClass}>Year</span>
          <Dropdown value={filters.year} disabled={pending} ariaLabel={`Year, ${filters.year || "all years"}`}
            options={[{ value: "", label: "All years" }, ...yearOptions.map((year) => ({ value: year, label: year }))]}
            onChange={(year) => navigate({ year })} />
        </div>
        {currentUrl !== path && (
          <Link href={path} scroll={false} onClick={() => { if (input.current) input.current.value = ""; }}
            className="py-2 text-sm font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            Clear all
          </Link>
        )}
      </div>
      {filters.sort !== "newest" && <input type="hidden" name="sort" value={filters.sort} />}
      {filters.type && <input type="hidden" name="type" value={filters.type} />}
      {filters.year && <input type="hidden" name="year" value={filters.year} />}
    </form>
  );
}
