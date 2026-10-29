import Image from "next/image";
import { PageBanner } from "@/components/site/section";
import { CHURCH, type Ministry } from "@/lib/church";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/ministries");

export default function MinistriesPage() {
  const ministries: readonly Ministry[] = CHURCH.ministries;
  return (
    <>
      <PageBanner eyebrow="Get involved" title="Ministries" intro="Ways to grow in the faith and serve alongside the church family." />
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <div className="grid gap-6 md:grid-cols-2">
          {ministries.map((m) => (
            <article key={m.name} className="overflow-hidden rounded-2xl border border-border bg-surface">
              {m.image && (
                <div className="relative aspect-[16/9]">
                  <Image src={m.image} alt={m.imageAlt ?? ""} fill sizes="(min-width: 768px) 560px, 100vw" className="object-cover" />
                </div>
              )}
              <div className="p-8">
                {m.when && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-accent">{m.when}</p>}
                <h2 className="font-display text-3xl font-semibold text-ink">{m.name}</h2>
                <p className="mt-3 text-text">{m.blurb}</p>
                {m.classes && (
                  <ul className="mt-5 divide-y divide-border-soft border-y border-border-soft">
                    {m.classes.map((c) => (
                      <li key={c.name} className="flex items-baseline justify-between gap-4 py-2.5">
                        <span>
                          <span className="font-semibold text-ink">{c.name} class</span>
                          {c.teacher && <span className="block text-sm text-muted">Taught by {c.teacher}</span>}
                        </span>
                        {c.who && <span className="text-right text-sm text-muted">{c.who}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
