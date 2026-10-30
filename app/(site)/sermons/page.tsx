import Link from "next/link";
import { PageBanner, SectionHeading } from "@/components/site/section";
import { SermonCard } from "@/components/site/sermon-card";
import { publicSermons } from "@/lib/content-server";
import { pinnedPosts, publishedPosts, sermonPostSlugs } from "@/lib/posts-server";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/sermons");

export default async function SermonsPage() {
  const [all, slugs, questions, pinned] = await Promise.all([
    publicSermons(),
    sermonPostSlugs(),
    publishedPosts("question", 1),
    pinnedPosts("sermon"),
  ]);
  const pinnedIds = new Set(pinned.map((p) => p.sermon!.id));
  const sermons = all.filter((s) => !pinnedIds.has(s.id));
  return (
    <>
      <PageBanner eyebrow="Preaching" title="Sermons" intro="Messages preached at Faith Baptist Church." />
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        {pinned.length > 0 && (
          <div aria-labelledby="featured" className="mb-14">
            <SectionHeading id="featured" eyebrow="Start here" title="Featured Messages" />
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              {pinned.map((p) => (
                <SermonCard key={p.id} sermon={p.sermon!} postSlug={p.slug} featured />
              ))}
            </div>
          </div>
        )}
        {pinned.length > 0 && sermons.length > 0 && <SectionHeading eyebrow="Preaching" title="All Sermons" />}
        {all.length === 0 ? (
          <p className="text-muted">Sermons will be posted here soon.</p>
        ) : (
          <div className={`grid gap-6 md:grid-cols-2 ${pinned.length > 0 ? "mt-8" : ""}`}>
            {sermons.map((s) => (
              <SermonCard key={s.id} sermon={s} postSlug={slugs.get(s.id)} />
            ))}
          </div>
        )}
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
