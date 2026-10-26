import { getProfile, roleLabelFor } from "@/lib/auth/profile";
import { MfaPanel } from "@/components/mfa-panel";
import { PasswordCard } from "./password-card";

export default async function AccountPage() {
  const profile = await getProfile();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">{profile?.full_name ?? "Account"}</h1>
        <p className="mt-1 text-sm text-muted">
          {profile ? `${roleLabelFor(profile)} · ${profile.email}` : "No profile on file."}
        </p>
      </div>
      <MfaPanel />
      <PasswordCard />
    </div>
  );
}
