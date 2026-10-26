import { createAdminClient } from "@/lib/supabase/admin";

/** Counts one hit against `key` and says whether it is still inside `limit`
 *  for the current fixed window. Service-role RPC — throttle_hit() is revoked
 *  from every client role. */
export async function underLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  const { data, error } = await admin.rpc("throttle_hit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(`throttle check failed: ${error.message}`);
  return data === true;
}

/** First hop of x-forwarded-for — what Vercel sets to the caller's address. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}
