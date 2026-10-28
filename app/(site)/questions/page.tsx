import { PageBanner } from "@/components/site/section";
import { QuestionCard } from "@/components/site/post-parts";
import { publishedPosts } from "@/lib/posts-server";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/questions");

export default async function QuestionsPage() {
  const questions = await publishedPosts("question");
  return (
    <>
      <PageBanner
        eyebrow="From the preaching"
        title="Bible Questions"
        intro="Plain answers to questions people often ask, taken from the sermons preached at Faith Baptist Church and the King James Bible."
      />
      <section className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        {questions.length === 0 ? (
          <p className="text-muted">Answers will be posted here soon.</p>
        ) : (
          <div className="grid gap-4">
            {questions.map((q) => (
              <QuestionCard key={q.id} slug={q.slug} title={q.title} description={q.description} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
