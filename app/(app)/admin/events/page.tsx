import { ContentEditor } from "@/components/content-editor";
import { requireStaff } from "@/lib/auth/profile";
import { listContent } from "@/lib/content-server";

export const metadata = { title: "Events" };

export default async function AdminEventsPage() {
  await requireStaff();
  const rows = await listContent("events");
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Events</h1>
      <p className="mt-1 text-sm text-muted">Services, studies and special events. Times are church time (Eastern).</p>
      <ContentEditor kind="events" rows={rows} />
    </div>
  );
}
