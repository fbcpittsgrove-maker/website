import { LOGO, SEAL } from "@/lib/logo";

/** The church seal (lib/logo.ts). Solid gold rather than the gradient so
 *  several marks on one page never share a gradient id. */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  const { navy, gold } = LOGO;
  return (
    <svg
      width={size}
      height={size}
      viewBox={LOGO.viewBox}
      role="img"
      aria-label="Faith Baptist Church of Pittsgrove"
      className={`shrink-0 ${className ?? ""}`}
    >
      <circle cx="260" cy="262" r="174" fill={gold} />
      <circle cx="260" cy="262" r="165" fill={navy} />
      {SEAL.stems.map((d) => (
        <path key={d} d={d} fill="none" stroke={gold} strokeWidth="3.2" strokeLinecap="round" />
      ))}
      {SEAL.leaves.map((t) => (
        <path key={t} d={SEAL.leaf} transform={t} fill={gold} />
      ))}
      <path d={SEAL.cross} fill={gold} />
      <path d={SEAL.bibleBase} fill={gold} />
      <path d={SEAL.pageLeft} fill={gold} stroke={navy} strokeWidth="1.6" strokeLinejoin="round" />
      <path d={SEAL.pageRight} fill={gold} stroke={navy} strokeWidth="1.6" strokeLinejoin="round" />
      {SEAL.lines.map((d) => (
        <path key={d} d={d} fill="none" stroke={navy} strokeOpacity=".55" strokeWidth="1.4" strokeLinecap="round" />
      ))}
      <path d={SEAL.spine} stroke={navy} strokeWidth="2" />
    </svg>
  );
}

export function BrandLockup({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className ?? "text-ink"}`}>
      <BrandMark size={size === "lg" ? 48 : 32} />
      <div className="text-left leading-tight">
        <div className={`font-semibold ${size === "lg" ? "text-2xl" : "text-base"}`}>Faith Baptist Church</div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted">of Pittsgrove</div>
      </div>
    </div>
  );
}
