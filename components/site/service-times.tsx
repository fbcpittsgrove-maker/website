import { CHURCH } from "@/lib/church";

export function ServiceTimes({ tone = "light" }: { tone?: "light" | "card" }) {
  return (
    <div className={`grid gap-6 sm:grid-cols-2 ${tone === "card" ? "rounded-2xl border border-border bg-surface p-6 md:p-8" : ""}`}>
      {CHURCH.schedule.map(({ day, services }) => (
        <div key={day}>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{day}</p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2">
            {services.map((s) => (
              <div key={s.label + s.time} className="contents">
                <dt className="whitespace-nowrap font-display text-2xl font-semibold text-ink">{s.time}</dt>
                <dd className="text-text">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
