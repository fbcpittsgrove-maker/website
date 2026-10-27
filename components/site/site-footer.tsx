import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { CHURCH, addressLine, directionsUrl } from "@/lib/church";

export function SiteFooter() {
  return (
    <footer className="bg-hero text-on-hero">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-3 md:px-6">
        <div>
          <div className="flex items-center gap-3">
            <BrandMark size={44} />
            <p className="font-display text-2xl font-semibold">{CHURCH.fullName}</p>
          </div>
          <p className="mt-3 text-sm opacity-75">{CHURCH.tagline}.</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-60">Service times</p>
          <dl className="mt-3 space-y-3 text-sm">
            {CHURCH.schedule.map(({ day, services }) => (
              <div key={day}>
                <dt className="font-semibold">{day}</dt>
                {services.map((s) => (
                  <dd key={s.label + s.time} className="opacity-80">
                    {s.time} · {s.label}
                  </dd>
                ))}
              </div>
            ))}
          </dl>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-60">Find us</p>
          <address className="mt-3 text-sm not-italic opacity-80">{addressLine()}</address>
          <div className="mt-4 flex flex-col gap-2 text-sm font-medium">
            <a href={directionsUrl()} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
              Get directions
            </a>
            <a href={CHURCH.facebook} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
              Facebook
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 text-xs opacity-60 md:px-6">
          <p>© {new Date().getFullYear()} {CHURCH.fullName}</p>
          <Link href="/login" className="hover:opacity-100">
            Staff sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
