import { ContentEditor } from "@/components/content-editor";
import { requireStaff } from "@/lib/auth/profile";
import { listContent } from "@/lib/content-server";

export const metadata = { title: "Sermons" };

export default async function AdminSermonsPage() {
  await requireStaff();
  const rows = await listContent("sermons");
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Sermons</h1>
      <p className="mt-1 text-sm text-muted">Recent messages with links to the recording.</p>
      <ContentEditor kind="sermons" rows={rows} />
    </div>
  );
}
