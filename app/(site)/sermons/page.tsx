import Link from "next/link";
import { ArchiveControls } from "@/components/site/archive-controls";
import { FeaturedLinks } from "@/components/site/post-parts";
import { PageBanner } from "@/components/site/section";
import { SermonCard } from "@/components/site/sermon-card";
import { readArchiveFilters, sermonListing, type ArchiveParams } from "@/lib/archive";
import { publicSermonArchive } from "@/lib/content-server";
import { publishedPosts } from "@/lib/posts-server";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/sermons");

export default async function SermonsPage({ searchParams }: { searchParams: Promise<ArchiveParams> }) {
  const [params, all, questions] = await Promise.all([
    searchParams,
    publicSermonArchive(),
    publishedPosts("question", 1),
  ]);
  const filters = readArchiveFilters("/sermons", params);
  const { years, groups, count } = sermonListing(all, filters);
  return (
    <>
      <PageBanner eyebrow="Preaching" title="Sermons" intro="Messages preached at Faith Baptist Church." />
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <ArchiveControls path="/sermons" filters={filters} years={years} />
        {filters.sort === "newest" && !filters.year && (
          <FeaturedLinks heading="Featured Messages"
            links={all.map((s) => ({ href: `#sermon-${s.id}`, title: s.title, pinnedAt: s.pinnedAt }))} />
        )}
        <p role="status" className="mb-6 text-sm text-muted">
          {count ? `${count} ${count === 1 ? "sermon" : "sermons"}` : all.length ? "No sermons match this year." : "Sermons will be posted here soon."}
        </p>
        {groups.map(({ month, label, items }) => (
          <div key={month} className="mb-10">
            {label && <h2 className="mb-4 font-display text-3xl font-semibold text-ink">{label}</h2>}
            <ul className="grid gap-6 md:grid-cols-2">
              {items.map((s) => (
                <li key={s.id} id={`sermon-${s.id}`} className="scroll-mt-24">
                  <SermonCard sermon={s} postSlug={s.postSlug} featured={!!s.pinnedAt} />
                </li>
              ))}
            </ul>
          </div>
        ))}
        {questions.length > 0 && (
          <p className="mt-10 text-text">
            Have a question about the Bible?{" "}
            <Link href="/questions" className="font-semibold text-accent hover:underline">
              Read answers drawn from our preaching →
            </Link>
          </p>
        )}
      </section>
    </>
  );
}
