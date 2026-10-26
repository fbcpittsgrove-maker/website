/** Interim mark — a plain cross until the church's own logo is supplied. */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="currentColor"
      role="img"
      aria-label="Faith Baptist Church of Pittsgrove"
      className={`shrink-0 ${className ?? "text-brand-ink"}`}
    >
      <path d="M28 6h8v16h14v8H36v28h-8V30H14v-8h14z" />
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
