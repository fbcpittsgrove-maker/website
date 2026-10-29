import Image from "next/image";
import { PageBanner, SectionHeading } from "@/components/site/section";
import { CHURCH } from "@/lib/church";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/about");

export default function AboutPage() {
  return (
    <>
      <PageBanner eyebrow="About us" title="Who We Are" intro={`${CHURCH.tagline}.`} />

      <section className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        <SectionHeading eyebrow="What we believe" title="Built on the Word" />
        <div className="mt-6 space-y-4 text-lg leading-relaxed text-text">
          <p>
            {CHURCH.fullName} is an independent Baptist church. We read, preach and teach from the {CHURCH.bible}, and
            we hold it to be the inspired Word of God.
          </p>
          <p>
            Our desire is to see people come to know Jesus Christ as their Savior, and to grow together as a church
            family in Pittsgrove and the surrounding communities.
          </p>
        </div>
      </section>

      <section aria-labelledby="pastors" className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <SectionHeading id="pastors" eyebrow="Leadership" title="Our Pastors" />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {CHURCH.leaders.map((l) => (
              <article key={l.name} className="overflow-hidden rounded-2xl border border-border bg-bg">
                {l.image && l.imageAlt && (
                  <div className="relative aspect-[4/3] bg-inset">
                    <Image src={l.image} alt={l.imageAlt} fill sizes="(min-width: 768px) 560px, 100vw" className="object-cover object-[50%_25%]" />
                  </div>
                )}
                <div className="p-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{l.title}</p>
                  <h3 className="mt-2 font-display text-3xl font-semibold text-ink">{l.name}</h3>
                  {l.bio && <p className="mt-3 text-text">{l.bio}</p>}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="workers" className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <SectionHeading id="workers" eyebrow="Serving with us" title="Teachers & Workers" />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CHURCH.workers.map((w) => (
            <article key={w.name} className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="relative aspect-[4/5] bg-inset">
                <Image src={w.image} alt={w.imageAlt} fill sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
              </div>
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{w.role}</p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-ink">{w.name}</h3>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
