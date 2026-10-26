import { CHURCH } from "@/lib/church";

export function ServiceTimes({ tone = "light" }: { tone?: "light" | "card" }) {
  return (
    <div className={`grid gap-6 sm:grid-cols-2 ${tone === "card" ? "rounded-2xl border border-border bg-surface p-6 md:p-8" : ""}`}>
      {CHURCH.schedule.map(({ day, services }) => (
        <div key={day}>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{day}</p>
          <ul className="mt-3 space-y-2">
            {services.map((s) => (
              <li key={s.label + s.time} className="flex items-baseline gap-3">
                <span className="w-20 shrink-0 font-display text-2xl font-semibold text-ink">{s.time.replace(" ", " ")}</span>
                <span className="text-text">{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
