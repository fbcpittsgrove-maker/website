import { ContentEditor } from "@/components/content-editor";
import { requireStaff } from "@/lib/auth/profile";
import { listContent } from "@/lib/content-server";

export const metadata = { title: "Announcements" };

export default async function AdminAnnouncementsPage() {
  await requireStaff();
  const rows = await listContent("announcements");
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Announcements</h1>
      <p className="mt-1 text-sm text-muted">Short notices for the homepage, with optional show dates.</p>
      <ContentEditor kind="announcements" rows={rows} />
    </div>
  );
}
