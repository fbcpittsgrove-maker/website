import { PageBanner } from "@/components/site/section";
import { BlogCard } from "@/components/site/post-parts";
import { blogPosts } from "@/lib/posts-server";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/blog");

export default async function BlogPage() {
  const posts = await blogPosts();
  return (
    <>
      <PageBanner
        eyebrow="Read & reflect"
        title="Blog"
        intro="Sermon posts and plain answers to Bible questions, written from the preaching at Faith Baptist Church and the King James Bible."
      />
      <section className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        {posts.length === 0 ? (
          <p className="text-muted">Posts will be shared here soon.</p>
        ) : (
          <div className="grid gap-4">
            {posts.map((p) => (
              <BlogCard
                key={p.id}
                kind={p.kind}
                slug={p.slug}
                title={p.title}
                description={p.description}
                preachedOn={p.kind === "sermon" ? p.sermon?.preached_on : undefined}
                featured={!!p.pinned_at}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
