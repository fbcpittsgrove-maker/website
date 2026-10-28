import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/site/json-ld";
import { PostBanner, VisitCta } from "@/components/site/post-parts";
import { ArticleMarkdown } from "@/lib/article-markdown";
import { formatDay } from "@/lib/content";
import { formatTimestamp } from "@/lib/posts";
import { publishedPost } from "@/lib/posts-server";
import { postGraph, postMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await publishedPost("question", (await params).slug);
  if (!post) notFound();
  return postMetadata({ ...post, kind: "question" });
}

export default async function QuestionPage({ params }: Props) {
  const post = await publishedPost("question", (await params).slug);
  if (!post) notFound();
  return (
    <>
      <JsonLd data={postGraph({ ...post, kind: "question" })} />
      <PostBanner eyebrow="Bible questions" title={post.title} />
      <article className="mx-auto max-w-3xl px-4 py-14 md:px-6">
        <ArticleMarkdown md={post.body_md} />

        {post.fromSermons.length > 0 && (
          <section aria-labelledby="from-sermons" className="mt-12 rounded-2xl border border-accent-line bg-accent-soft p-6">
            <h2 id="from-sermons" className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              From the preaching
            </h2>
            <ul className="mt-3 space-y-2">
              {post.fromSermons.map((s) => (
                <li key={s.slug}>
                  <Link href={`/sermons/${s.slug}`} className="font-display text-xl font-semibold text-ink hover:text-accent">
                    {s.title}
                  </Link>
                  <p className="text-sm text-muted">
                    Preached {formatDay(s.preached_on)}
                    {s.start_seconds !== null && ` · this answer starts at ${formatTimestamp(s.start_seconds)} in the recording`}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-10">
          <Link href="/questions" className="text-sm font-semibold text-accent hover:underline">
            ← All Bible questions
          </Link>
        </p>
        <VisitCta />
      </article>
    </>
  );
}
