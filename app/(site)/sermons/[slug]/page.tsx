import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/site/json-ld";
import { PostBanner, QuestionCard, VisitCta } from "@/components/site/post-parts";
import { SectionHeading } from "@/components/site/section";
import { ArticleMarkdown } from "@/lib/article-markdown";
import { formatDay } from "@/lib/content";
import { publishedPost } from "@/lib/posts-server";
import { postGraph, postMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await publishedPost("sermon", (await params).slug);
  if (!post) notFound();
  return postMetadata({ ...post, kind: "sermon" });
}

export default async function SermonPostPage({ params }: Props) {
  const post = await publishedPost("sermon", (await params).slug);
  if (!post) notFound();
  const byline = post.sermon ? [post.sermon.preacher, post.sermon.scripture].filter(Boolean).join(" · ") : undefined;
  return (
    <>
      <JsonLd data={postGraph({ ...post, kind: "sermon" })} />
      <PostBanner eyebrow={post.sermon ? formatDay(post.sermon.preached_on) : "Sermon"} title={post.title} byline={byline} />
      <article className="mx-auto max-w-3xl px-4 py-14 md:px-6">
        <ArticleMarkdown md={post.body_md} />

        {post.questions.length > 0 && (
          <section aria-labelledby="questions" className="mt-14">
            <SectionHeading id="questions" eyebrow="Bible questions" title="Questions this sermon answers" />
            <div className="mt-6 grid gap-4">
              {post.questions.map((q) => (
                <QuestionCard key={q.slug} slug={q.slug} title={q.title} />
              ))}
            </div>
          </section>
        )}

        <VisitCta />
      </article>
    </>
  );
}
