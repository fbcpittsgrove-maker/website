import Image from "next/image";
import { PageBanner, SectionHeading } from "@/components/site/section";
import { ServiceTimes } from "@/components/site/service-times";
import { TextUs } from "@/components/site/text-us";
import { CHURCH, addressLine, directionsUrl } from "@/lib/church";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/visit");

const EXPECT = [
  {
    title: "A warm welcome",
    body: "Someone will be glad to greet you at the door and help you find your way.",
  },
  {
    title: "Bible preaching",
    body: `Our services center on the preaching of God’s Word from the ${CHURCH.bible}.`,
  },
  {
    title: "Classes for every age",
    body: "Sunday School at 9:45 AM has classes for kindergarten through 3rd grade, 4th–5th grade, teens, adult ladies and adult men.",
  },
  {
    title: "Come as you are",
    body: "Whether this is your first time in church or you have been coming for years, you are welcome here.",
  },
];

export default function VisitPage() {
  return (
    <>
      <PageBanner
        eyebrow="New here?"
        title="Plan Your Visit"
        intro="We would love to have you worship with us. Here is everything you need for your first Sunday."
      />

      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 md:grid-cols-2 md:px-6">
        <div>
          <SectionHeading eyebrow="When" title="Service Times" />
          <div className="mt-8">
            <ServiceTimes tone="card" />
          </div>
        </div>
        <div>
          <SectionHeading eyebrow="Where" title="Finding Us" />
          <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="relative aspect-[4/3]">
              <Image
                src={CHURCH.exteriorImage}
                alt="The front of Faith Baptist Church, a white building with burgundy doors and a paved drive"
                fill
                sizes="(min-width: 768px) 560px, 100vw"
                className="object-cover object-[50%_45%]"
              />
            </div>
            <div className="p-6 md:p-8">
              <p className="font-display text-2xl font-semibold text-ink">{CHURCH.fullName}</p>
              <address className="mt-2 not-italic text-text">{addressLine()}</address>
              <a
                href={directionsUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-block rounded-full bg-action px-6 py-3 font-semibold text-on-brand hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Get Directions
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <SectionHeading eyebrow="Your first visit" title="What to Expect" />
          <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {EXPECT.map((e) => (
              <div key={e.title}>
                <p className="font-display text-2xl font-semibold text-ink">{e.title}</p>
                <p className="mt-2 text-text">{e.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {CHURCH.phone && (
        <section aria-labelledby="text-us" className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <SectionHeading id="text-us" eyebrow="Need a ride or have a question?" title="Send Us a Text" />
          <p className="mt-3 max-w-2xl text-text">
            The church bus can pick you up. Tap a button and your phone starts the message for you.
          </p>
          <div className="mt-6">
            <TextUs kinds={["bus", "visit", "pastor"]} />
          </div>
        </section>
      )}
    </>
  );
}
