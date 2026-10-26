import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getProfile, roleLabelFor } from "@/lib/auth/profile";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.active) redirect("/login?error=deactivated");

  return (
    <AppShell
      role={profile.role}
      isOwner={profile.is_owner}
      userName={profile.full_name}
      userRole={roleLabelFor(profile)}
    >
      {children}
    </AppShell>
  );
}
