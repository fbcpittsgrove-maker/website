import { PageBanner, SectionHeading } from "@/components/site/section";
import { CHURCH } from "@/lib/church";

export const metadata = { title: "About" };

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
            Our desire is to see people come to know Jesus Christ as their Saviour, and to grow together as a church
            family in Pittsgrove and the surrounding communities.
          </p>
        </div>
      </section>

      <section aria-labelledby="pastors" className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <SectionHeading id="pastors" eyebrow="Leadership" title="Our Pastors" />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {CHURCH.leaders.map((l) => (
              <article key={l.name} className="rounded-2xl border border-border bg-bg p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{l.title}</p>
                <h3 className="mt-2 font-display text-3xl font-semibold text-ink">{l.name}</h3>
                {l.bio && <p className="mt-3 text-text">{l.bio}</p>}
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
