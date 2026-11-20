import { CHURCH, addressLine } from "@/lib/church";
import { postPath } from "@/lib/posts";
import { publishedPostIndex } from "@/lib/posts-server";
import { PUBLIC_PAGES, siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = siteUrl();
  const { sermons, questions } = await publishedPostIndex();
  const postLines = (title: string, posts: typeof sermons) =>
    posts.length ? ["", `## ${title}`, "", ...posts.map((p) => `- [${p.title}](${base}${postPath(p.kind, p.slug)}): ${p.description}`)] : [];
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
    ...postLines("Bible questions", questions),
    ...postLines("Sermons", sermons),
    "",
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
