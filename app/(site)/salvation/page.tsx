import Link from "next/link";
import { PageBanner } from "@/components/site/section";
import { pageMetadata } from "@/lib/seo";
import { TEXT_MESSAGES, textHref } from "@/lib/text-us";

export const metadata = pageMetadata("/salvation");

/** Steven Bradbury's "The Bible Way to Heaven", word for word (Oct 2026).
 *  Scripture is the church's own KJV wording — edit here only with his OK. */
const STEPS: { title: string; verses: { ref: string; text: string }[]; body: string }[] = [
  {
    title: "Recognize your condition.",
    verses: [{ ref: "Romans 3:23", text: "For all have sinned, and come short of the glory of God." }],
    body: "No one is good enough to go to Heaven on his own merit. No matter how much good we do, we still fall short.",
  },
  {
    title: "Realize the penalty for sin.",
    verses: [{ ref: "Romans 6:23", text: "For the wages of sin is death . . . ." }],
    body: "Just as there are wages for good, there is punishment for wrong. The penalty for our sin is eternal death in a place called Hell.",
  },
  {
    title: "Recognize where sin came from.",
    verses: [
      {
        ref: "Romans 5:12",
        text: "Wherefore, as by one man sin entered into the world, and death by sin; and so death passed upon all men, for that all have sinned:",
      },
    ],
    body: "We have been born with a sin nature, which has been passed down from Adam to every generation.",
  },
  {
    title: "Believe Christ died for you and rose again.",
    verses: [{ ref: "Romans 5:8", text: "But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us." }],
    body: "Christ’s great love for us was shown when He died on the Cross to pay our debt. God loves you.",
  },
  {
    title: "Trust Christ alone as your Saviour.",
    verses: [
      { ref: "Romans 6:23", text: ". . . but the gift of God is eternal life through Jesus Christ our Lord." },
      { ref: "Romans 10:13", text: "For whosoever shall call upon the name of the Lord shall be saved." },
    ],
    body: "Everlasting life is a gift purchased by the blood of Jesus and offered freely to those who call upon Him by faith. Do you believe the above points? If so, consider telling God that you do in this prayer:",
  },
  {
    title: "Claim God’s promise for salvation.",
    verses: [
      {
        ref: "Romans 10:9-10",
        text: "That if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved. For with the heart man believeth unto righteousness; and with the mouth confession is made unto salvation.",
      },
    ],
    body: "",
  },
];

const PRAYER =
  "Dear Jesus, I know I’m a sinner. Please forgive me for my sins, and come into my life. I am trusting You, and You alone, to save me and give me eternal life. I accept Your gift of salvation. Thank You, Jesus. Amen.";

export default function SalvationPage() {
  return (
    <>
      <PageBanner
        eyebrow="Good news"
        title="The Bible Way to Heaven"
        intro="You can know 100% for sure that you will spend eternity in Heaven."
      />

      <article className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        <p className="text-lg leading-relaxed text-text">
          We would like to share some good news with you. God loves you so much that He made a way for you to go to Heaven when you
          die. If you’re not sure, you will find the following truths helpful in understanding this important subject.
        </p>

        <ol className="mt-12 space-y-12">
          {STEPS.map((step, i) => (
            <li key={step.title} className="grid gap-4 sm:grid-cols-[3.5rem_minmax(0,1fr)]">
              <span
                aria-hidden
                className="grid h-12 w-12 place-items-center rounded-full bg-action font-display text-2xl font-semibold text-on-brand"
              >
                {i + 1}
              </span>
              <div>
                <h2 className="font-display text-3xl font-semibold leading-tight text-ink">
                  <span className="sr-only">{i + 1}. </span>
                  {step.title}
                </h2>
                {step.verses.map((v) => (
                  <blockquote
                    key={v.ref + v.text}
                    className="mt-4 border-l-4 border-accent bg-accent-soft px-5 py-4 font-display text-xl leading-snug text-ink"
                  >
                    “{v.text}”
                    <footer className="mt-2 font-sans text-sm font-semibold not-italic text-accent">{v.ref}</footer>
                  </blockquote>
                ))}
                {step.body && <p className="mt-4 text-lg leading-relaxed text-text">{step.body}</p>}
              </div>
            </li>
          ))}
        </ol>

        <section aria-labelledby="prayer" className="hero-ground mt-14 rounded-2xl px-6 py-10 text-on-hero md:px-10">
          <h2 id="prayer" className="text-xs font-semibold uppercase tracking-[0.28em] opacity-70">
            A prayer you can pray
          </h2>
          <p className="mt-4 font-display text-2xl leading-snug md:text-3xl">{PRAYER}</p>
        </section>

        <aside className="mt-12 rounded-2xl border border-border bg-surface p-8">
          <span aria-hidden className="rule-accent mb-4" />
          <h2 className="font-display text-3xl font-semibold text-ink">Did you pray that prayer?</h2>
          <p className="mt-3 text-text">
            We would love to hear from you, answer your questions and help you take your next step. Come worship with us this Sunday.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={textHref("saved")}
              className="rounded-full bg-action px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:hidden"
            >
              {TEXT_MESSAGES.saved.label}
            </a>
            <Link
              href="/contact"
              className="hidden rounded-full bg-action px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:inline-block"
            >
              Let us know
            </Link>
            <Link
              href="/visit"
              className="rounded-full border border-border-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Plan your visit
            </Link>
          </div>
        </aside>
      </article>
    </>
  );
}
