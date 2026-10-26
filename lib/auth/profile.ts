import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL, type Role } from "@/lib/auth/roles";

export { ROLE_LABEL, type Role };

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  active: boolean;
  /** Platform owner (The Software Effect) — sees /admin/issues and
   *  /admin/diagnostics. Orthogonal to `role`: the client's admin
   *  runs the business, owners run the software. */
  is_owner: boolean;
  /** Raw per-user prefs jsonb — parse with lib/nav.ts helpers, never trust. */
  ui_prefs: unknown;
};

/** Current user's profile, or null when signed out / no profile row. Cached
 *  per request so the layout and the page don't each re-run auth + the lookup. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, active, is_owner, ui_prefs")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Profile read failed — ${error.message}`);
  return (data as Profile) ?? null;
});

/** What to call someone on screen. Owners build and own the software — they
 *  aren't part of the client's org chart, so they never read as Admin. */
export function roleLabelFor(profile: Pick<Profile, "role" | "is_owner">): string {
  return profile.is_owner ? "Owner" : ROLE_LABEL[profile.role];
}

export class NotAuthorizedError extends Error {}

/** Any active signed-in member (admin or editor). */
export async function requireStaff(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile || !profile.active) {
    throw new NotAuthorizedError("You don't have access to do that.");
  }
  return profile;
}

/** Same, but for owner-only surfaces (issue log, diagnostics). RLS enforces it too. */
export async function requireOwner(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile || !profile.active || !profile.is_owner) {
    throw new NotAuthorizedError("You don't have access to do that.");
  }
  return profile;
}

/** Admin pages gate: client admin OR owner. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile || !profile.active || (profile.role !== "admin" && !profile.is_owner)) {
    throw new NotAuthorizedError("You don't have access to do that.");
  }
  return profile;
}
