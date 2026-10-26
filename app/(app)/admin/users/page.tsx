import { requireAdmin } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { UsersPanel } from "./users-panel";

export default async function AdminUsersPage() {
  const actor = await requireAdmin();
  const admin = createAdminClient();
  if (!admin) throw new Error("Users: admin client is not configured");

  const [profilesRes, invitesRes] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, role, active, is_owner, created_at").order("created_at", { ascending: true }),
    admin.from("invites").select("id, email, role, expires_at, created_at").is("accepted_at", null).order("created_at", { ascending: false }),
  ]);
  if (profilesRes.error) throw new Error("Admin Users: profiles read failed — " + profilesRes.error.message);
  if (invitesRes.error) throw new Error("Admin Users: invites read failed — " + invitesRes.error.message);
  const { data: profiles } = profilesRes;
  const { data: invites } = invitesRes;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Users</h1>
      <p className="mt-1 text-sm text-muted">
        Invite people, set roles and passwords, activate or deactivate.
      </p>
      <UsersPanel
        profiles={profiles ?? []}
        invites={invites ?? []}
        isOwner={actor.is_owner}
      />
    </div>
  );
}
