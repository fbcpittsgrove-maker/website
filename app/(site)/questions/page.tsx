import { PageBanner } from "@/components/site/section";
import { QuestionCard } from "@/components/site/post-parts";
import { pinnedPosts, publishedPosts } from "@/lib/posts-server";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/questions");

export default async function QuestionsPage() {
  const [all, pinned] = await Promise.all([publishedPosts("question"), pinnedPosts("question")]);
  const pinnedIds = new Set(pinned.map((p) => p.id));
  const questions = all.filter((q) => !pinnedIds.has(q.id));
  return (
    <>
      <PageBanner
        eyebrow="From the preaching"
        title="Bible Questions"
        intro="Plain answers to questions people often ask, taken from the sermons preached at Faith Baptist Church and the King James Bible."
      />
      <section className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        {all.length === 0 ? (
          <p className="text-muted">Answers will be posted here soon.</p>
        ) : (
          <div className="grid gap-4">
            {pinned.map((q) => (
              <QuestionCard key={q.id} slug={q.slug} title={q.title} description={q.description} featured />
            ))}
            {questions.map((q) => (
              <QuestionCard key={q.id} slug={q.slug} title={q.title} description={q.description} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
