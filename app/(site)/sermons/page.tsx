import { PageBanner } from "@/components/site/section";
import { SermonCard } from "@/components/site/sermon-card";
import { publicSermons } from "@/lib/content-server";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/sermons");

export default async function SermonsPage() {
  const sermons = await publicSermons();
  return (
    <>
      <PageBanner eyebrow="Preaching" title="Sermons" intro="Messages preached at Faith Baptist Church." />
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        {sermons.length === 0 ? (
          <p className="text-muted">Sermons will be posted here soon.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {sermons.map((s) => (
              <SermonCard key={s.id} sermon={s} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
