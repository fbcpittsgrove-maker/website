import { CHURCH, addressLine } from "@/lib/church";
import { PUBLIC_PAGES, siteUrl } from "@/lib/seo";

/** Plain-language summary for AI answer engines (blog-engine 08: cheap
 *  insurance, kept accurate — every line comes from lib/church.ts). */
export function GET() {
  const base = siteUrl();
  const services = CHURCH.schedule.flatMap(({ day, services }) => services.map((s) => `${day} ${s.time} — ${s.label}`));
  const body = [
    `# ${CHURCH.fullName}`,
    "",
    `> ${CHURCH.tagline}, preaching from the ${CHURCH.bible}.`,
    "",
    "## Key facts",
    "",
    `- Address: ${addressLine()}`,
    `- Service times: ${services.join("; ")}`,
    `- Leaders: ${CHURCH.leaders.map((l) => `${l.title} ${l.name}`).join("; ")}`,
    `- Ministries: ${CHURCH.ministries.map((m) => m.name).join(", ")}`,
    ...(CHURCH.phone ? [`- Phone: ${CHURCH.phone}`] : []),
    ...(CHURCH.email ? [`- Email: ${CHURCH.email}`] : []),
    `- Facebook: ${CHURCH.facebook}`,
    `- Website: ${base}`,
    "",
    "## Pages",
    "",
    ...PUBLIC_PAGES.map((p) => `- [${p.name}](${base}${p.path}): ${p.description}`),
    "",
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
