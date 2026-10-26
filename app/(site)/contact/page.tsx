import { PageBanner } from "@/components/site/section";
import { CHURCH, addressLine, directionsUrl } from "@/lib/church";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  const rows = [
    { label: "Address", value: addressLine(), href: directionsUrl() },
    ...(CHURCH.phone ? [{ label: "Phone", value: CHURCH.phone, href: `tel:${CHURCH.phone.replace(/[^\d+]/g, "")}` }] : []),
    ...(CHURCH.email ? [{ label: "Email", value: CHURCH.email, href: `mailto:${CHURCH.email}` }] : []),
    { label: "Facebook", value: "Message us on Facebook", href: CHURCH.facebook },
  ];
  return (
    <>
      <PageBanner eyebrow="Get in touch" title="Contact Us" intro="We would be glad to hear from you." />
      <section className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        <dl className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {rows.map((r) => {
            const external = r.href.startsWith("http");
            return (
              <div key={r.label} className="flex flex-col gap-1 p-6 sm:flex-row sm:items-baseline sm:gap-6">
                <dt className="w-28 shrink-0 text-xs font-semibold uppercase tracking-[0.24em] text-accent">{r.label}</dt>
                <dd>
                  <a
                    href={r.href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    className="font-display text-2xl font-semibold text-ink underline-offset-4 hover:underline"
                  >
                    {r.value}
                  </a>
                </dd>
              </div>
            );
          })}
        </dl>
      </section>
    </>
  );
}
