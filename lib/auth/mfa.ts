import type { SupabaseClient } from "@supabase/supabase-js";

export async function verifiedTotpFactor(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(`factor lookup failed: ${error.message}`);
  return data.totp[0] ?? null;
}

/** The gate asks the auth server for the factor list instead of reading the
 *  stored session: the cookie's user object is client-writable, so anyone
 *  holding a stolen password could otherwise delete `factors` from it and walk
 *  straight past the second step. `aal` comes from the verified JWT. */
export async function isMfaPending(supabase: SupabaseClient, currentLevel: unknown) {
  if (currentLevel === "aal2") return false;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(`user lookup failed: ${error.message}`);
  return (data.user?.factors ?? []).some(
    (factor) => factor.factor_type === "totp" && factor.status === "verified",
  );
}
