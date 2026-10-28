import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { EventList } from "@/components/site/event-list";
import { NextServiceCard } from "@/components/site/next-service-card";
import { SectionHeading } from "@/components/site/section";
import { SermonCard } from "@/components/site/sermon-card";
import { ServiceTimes } from "@/components/site/service-times";
import { CHURCH, addressLine, directionsUrl } from "@/lib/church";
import { publicAnnouncements, publicEvents, publicSermons } from "@/lib/content-server";
import { sermonPostSlugs } from "@/lib/posts-server";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/");

/** Mosaic tile shapes, in gallery order: a tall lead photo, two squares,
 *  then a wide closer. */
const TILE = ["col-span-2 md:col-span-1 md:row-span-2", "", "", "col-span-2"];

/** The hero photo, art-directed: the wide shot from tablets up, the tall
 *  shot on phones. The browser downloads only the one it shows. */
function HeroPhoto({ wide, tall }: { wide: string; tall: string }) {
  const common = { alt: "", fill: true, sizes: "100vw", quality: 85, fetchPriority: "high" as const };
  const { srcSet: wideSrcSet } = getImageProps({ ...common, src: wide }).props;
  const { props } = getImageProps({ ...common, src: tall });
  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={wideSrcSet} />
      <img {...props} alt="" className="-z-10 object-cover object-[50%_60%]" />
    </picture>
  );
}

export default async function HomePage() {
  const [events, sermons, announcements, sermonSlugs] = await Promise.all([
    publicEvents(4),
    publicSermons(1),
    publicAnnouncements(3),
    sermonPostSlugs(),
  ]);
  const pastor = CHURCH.leaders[0];

  return (
    <>
      <section
        className={`relative isolate flex min-h-[min(92vh,880px)] items-end overflow-hidden text-on-hero ${CHURCH.heroImage ? "bg-hero" : "hero-ground"}`}
      >
        {CHURCH.heroImage && (
          <>
            <HeroPhoto {...CHURCH.heroImage} />
            <div aria-hidden className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-hero/75 via-hero/30 to-transparent md:block" />
            <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-hero/75 via-hero/35 to-hero/90" />
          </>
        )}
        <div className="mx-auto grid w-full max-w-6xl items-end gap-10 px-4 pb-14 pt-36 md:grid-cols-2 md:px-6 md:pb-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Pittsgrove, New Jersey</p>
            <h1 className="mt-4 font-display text-6xl font-semibold leading-[0.95] md:text-8xl">
              Welcome <em className="font-medium">home.</em>
            </h1>
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
          <NextServiceCard />
        </div>
      </section>

      <section aria-labelledby="times" className="bg-hero text-on-hero">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1fr_2fr] md:px-6 md:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">Join us</p>
            <h2 id="times" className="mt-1 font-display text-4xl font-semibold leading-tight md:text-5xl">
              Service Times
            </h2>
            <p className="mt-4 opacity-75">{addressLine()}</p>
            <a
              href={directionsUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-semibold text-gold hover:underline"
            >
              Get directions →
            </a>
          </div>
          <div className="flex flex-col gap-8">
            <ServiceTimes tone="hero" />
            <Link
              href="/visit"
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/15 bg-white/5 px-6 py-5 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-hero"
            >
              <span>
                <span className="block font-semibold">First time visiting?</span>
                <span className="block text-sm opacity-70">Here&apos;s what to expect.</span>
              </span>
              <ArrowRight aria-hidden className="h-5 w-5 text-gold" />
            </Link>
          </div>
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

      <section aria-labelledby="life" className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading id="life" eyebrow="Church family" title="Life at Faith Baptist" />
          <Link href="/ministries" className="font-semibold text-accent hover:underline">
            Our ministries →
          </Link>
        </div>
        <ul className="mt-8 grid auto-rows-[200px] grid-cols-2 gap-3 md:auto-rows-[240px] md:grid-cols-3 md:gap-4">
          {CHURCH.gallery.map((photo, i) => (
            <li key={photo.src} className={`relative overflow-hidden rounded-2xl bg-inset ${TILE[i] ?? ""}`}>
              <figure className="h-full">
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(min-width: 768px) 560px, 100vw"
                  className="object-cover transition-transform duration-500 hover:scale-[1.03]"
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-hero/85 to-transparent px-5 pb-4 pt-12 text-sm font-medium text-on-hero">
                  {photo.caption}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>

      <section className="hero-ground text-on-hero">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-20 text-center md:px-6 md:py-28">
          <BrandMark size={56} />
          <blockquote className="mt-8 font-display text-3xl font-medium italic leading-snug md:text-5xl md:leading-tight">
            “For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not
            perish, but have everlasting life.”
          </blockquote>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.24em] text-gold">John 3:16</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-16 md:grid-cols-2 md:px-6 md:py-20">
        <div aria-labelledby="events" className="flex flex-col rounded-2xl border border-border bg-surface p-7 md:p-10">
          <SectionHeading id="events" eyebrow="Coming up" title="Upcoming Events" />
          <div className="mt-8">
            <EventList events={events} empty="No upcoming events are listed right now." />
          </div>
          <Link href="/events" className="mt-auto inline-block pt-6 font-semibold text-accent hover:underline">
            All events →
          </Link>
        </div>
        <div aria-labelledby="sermon" className="flex flex-col rounded-2xl border border-border bg-surface p-7 md:p-10">
          <SectionHeading id="sermon" eyebrow="Listen again" title="Latest Sermon" />
          <div className="mt-8">
            {sermons[0] ? <SermonCard sermon={sermons[0]} postSlug={sermonSlugs.get(sermons[0].id)} /> : <p className="text-muted">Sermons will be posted here soon.</p>}
          </div>
          <Link href="/sermons" className="mt-auto inline-block pt-6 font-semibold text-accent hover:underline">
            All sermons →
          </Link>
        </div>
      </section>

      {pastor && (
        <section aria-labelledby="pastor" className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 md:grid-cols-2 md:gap-16 md:px-6">
          {pastor.image && pastor.imageAlt && (
            <div className="relative aspect-[4/5] max-h-[560px] overflow-hidden rounded-2xl bg-inset">
              <Image src={pastor.image} alt={pastor.imageAlt} fill sizes="(min-width: 768px) 560px, 100vw" className="object-cover object-[50%_30%]" />
            </div>
          )}
          <div>
            <span aria-hidden className="rule-accent mb-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">From our pastor</p>
            <h2 id="pastor" className="mt-3 font-display text-4xl font-medium leading-tight text-ink md:text-5xl">
              {pastor.title} {pastor.name} and the church family look forward to worshiping with you.
            </h2>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/about"
                className="rounded-full bg-action px-6 py-3 font-semibold text-on-brand transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Meet our pastors
              </Link>
              <Link
                href="/contact"
                className="rounded-full border border-border-strong px-6 py-3 font-semibold text-ink transition-colors hover:bg-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Get in touch
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
