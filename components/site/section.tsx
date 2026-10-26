/** Page banner for inner pages: navy ground, serif title, burgundy rule. */
export function PageBanner({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <section className="hero-ground text-on-hero">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] opacity-70">{eyebrow}</p>
        <h1 className="mt-3 font-display text-5xl font-semibold leading-[1.05] md:text-6xl">{title}</h1>
        {intro && <p className="mt-5 max-w-2xl text-lg opacity-85">{intro}</p>}
      </div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, id }: { eyebrow?: string; title: string; id?: string }) {
  return (
    <div>
      <span aria-hidden className="rule-accent mb-4" />
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{eyebrow}</p>}
      <h2 id={id} className="mt-1 font-display text-4xl font-semibold leading-tight text-ink">
        {title}
      </h2>
    </div>
  );
}
