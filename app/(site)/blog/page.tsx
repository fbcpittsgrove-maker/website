import { ArchiveControls } from "@/components/site/archive-controls";
import { PageBanner } from "@/components/site/section";
import { BlogCard, FeaturedLinks } from "@/components/site/post-parts";
import { blogListing, readArchiveFilters, type ArchiveParams } from "@/lib/archive";
import { postPath } from "@/lib/posts";
import { publicBlogArchive } from "@/lib/posts-server";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/blog");

export default async function BlogPage({ searchParams }: { searchParams: Promise<ArchiveParams> }) {
  const filters = readArchiveFilters("/blog", await searchParams);
  const archive = await publicBlogArchive(filters.q);
  const { posts, years } = blogListing(archive.posts, filters, archive.bodyMatches);
  return (
    <>
      <PageBanner
        eyebrow="Read & reflect"
        title="Blog"
        intro="Sermon posts and plain answers to Bible questions, written from the preaching at Faith Baptist Church and the King James Bible."
      />
      <section className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        <ArchiveControls path="/blog" filters={filters} years={years} />
        {filters.sort === "newest" && !filters.q && !filters.year && !filters.type && (
          <FeaturedLinks heading="Featured posts" links={posts.map((p) => ({
            href: postPath(p.kind, p.slug), title: p.title, pinnedAt: p.pinned_at,
          }))} />
        )}
        <p role="status" className="mb-6 text-sm text-muted">
          {posts.length ? `${posts.length} ${posts.length === 1 ? "post" : "posts"}`
            : archive.posts.length ? "No posts match your search or filters." : "Posts will be shared here soon."}
        </p>
        {posts.length > 0 && (
          <div className="grid gap-4">
            {posts.map((p) => (
              <BlogCard
                key={p.id}
                kind={p.kind}
                slug={p.slug}
                title={p.title}
                description={p.description}
                day={p.day}
                dateLabel={p.preached ? "Preached" : "Published"}
                featured={!!p.pinned_at}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
