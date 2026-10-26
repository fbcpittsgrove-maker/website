import Image from "next/image";
import Link from "next/link";
import { EventList } from "@/components/site/event-list";
import { SectionHeading } from "@/components/site/section";
import { SermonCard } from "@/components/site/sermon-card";
import { ServiceTimes } from "@/components/site/service-times";
import { CHURCH, addressLine, directionsUrl } from "@/lib/church";
import { publicAnnouncements, publicEvents, publicSermons } from "@/lib/content-server";

export default async function HomePage() {
  const [events, sermons, announcements] = await Promise.all([publicEvents(4), publicSermons(1), publicAnnouncements(3)]);
  const pastor = CHURCH.leaders[0];

  return (
    <>
      <section className={`relative isolate overflow-hidden text-on-hero ${CHURCH.heroImage ? "bg-hero" : "hero-ground"}`}>
        {CHURCH.heroImage && (
          <>
            <Image src={CHURCH.heroImage} alt="" fill priority sizes="100vw" className="-z-10 object-cover object-[50%_62%]" />
            <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-hero/90 via-hero/70 to-hero/30" />
          </>
        )}
        <div className="mx-auto max-w-6xl px-4 py-24 md:px-6 md:py-36">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] opacity-75">Pittsgrove, New Jersey</p>
          <h1 className="mt-4 max-w-3xl font-display text-6xl font-semibold leading-[1.02] md:text-8xl">Welcome Home</h1>
          <p className="mt-6 max-w-xl text-lg opacity-90 md:text-xl">
            {CHURCH.tagline}, preaching from the {CHURCH.bible}. Come as you are — we would love to meet you.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/visit"
              className="rounded-full bg-action px-7 py-3.5 font-semibold text-on-brand transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-hero"
            >
              Plan Your Visit
            </Link>
            <a
              href={directionsUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/40 px-7 py-3.5 font-semibold transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-hero"
            >
              Get Directions
            </a>
          </div>
        </div>
      </section>

      <section aria-labelledby="times" className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[1fr_2fr] md:px-6">
          <div>
            <SectionHeading id="times" eyebrow="Join us" title="Service Times" />
            <p className="mt-3 text-sm text-muted">{addressLine()}</p>
          </div>
          <ServiceTimes />
        </div>
      </section>

      {announcements.length > 0 && (
        <section aria-labelledby="news" className="mx-auto max-w-6xl px-4 pt-16 md:px-6">
          <SectionHeading id="news" eyebrow="This week" title="Announcements" />
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {announcements.map((a) => (
              <li key={a.id} className="rounded-2xl border border-accent-line bg-accent-soft p-6">
                <p className="font-display text-xl font-semibold text-ink">{a.title}</p>
                {a.body && <p className="mt-2 whitespace-pre-line text-sm text-text">{a.body}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto grid max-w-6xl gap-14 px-4 py-16 md:grid-cols-2 md:px-6">
        <div aria-labelledby="events">
          <SectionHeading id="events" eyebrow="Coming up" title="Upcoming Events" />
          <div className="mt-8">
            <EventList events={events} empty="No upcoming events are listed right now." />
          </div>
          <Link href="/events" className="mt-6 inline-block font-semibold text-accent hover:underline">
            All events →
          </Link>
        </div>
        <div aria-labelledby="sermon">
          <SectionHeading id="sermon" eyebrow="Listen again" title="Latest Sermon" />
          <div className="mt-8">
            {sermons[0] ? <SermonCard sermon={sermons[0]} /> : <p className="text-muted">Sermons will be posted here soon.</p>}
          </div>
          <Link href="/sermons" className="mt-6 inline-block font-semibold text-accent hover:underline">
            All sermons →
          </Link>
        </div>
      </section>

      <section aria-labelledby="life" className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading id="life" eyebrow="Church family" title="Life at Faith Baptist" />
          <Link href="/ministries" className="font-semibold text-accent hover:underline">
            Our ministries →
          </Link>
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {CHURCH.gallery.map((photo) => (
            <li key={photo.src} className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-inset">
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(min-width: 768px) 280px, 50vw"
                className="object-cover transition-transform duration-500 hover:scale-[1.03]"
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center md:px-6">
          <p className="font-display text-3xl font-medium italic leading-snug text-ink md:text-4xl">
            “For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not
            perish, but have everlasting life.”
          </p>
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.24em] text-accent">John 3:16</p>
          {pastor && (
            <p className="mt-10 text-muted">
              {pastor.title} {pastor.name} and the church family look forward to worshipping with you.{" "}
              <Link href="/about" className="font-semibold text-accent hover:underline">
                Meet our pastors
              </Link>
            </p>
          )}
        </div>
      </section>
    </>
  );
}
