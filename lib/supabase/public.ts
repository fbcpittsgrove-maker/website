import { createClient, type PostgrestSingleResponse } from "@supabase/supabase-js";

/**
 * Cookie-less anon client for the public site. Visitors' pages read only what
 * RLS shows `anon` (published content), and a signed-in member browsing the
 * site never has their own session — or its MFA state — change what renders.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function readPublicPages<T extends { id: string }>(
  name: string,
  readPage: (after: string | undefined) => PromiseLike<PostgrestSingleResponse<T[]>>,
): Promise<T[]> {
  const rows: T[] = [];
  let after: string | undefined;
  for (;;) {
    const { data, error } = await readPage(after);
    if (error) throw new Error(`${name} read failed — ${error.message}`);
    if (data.length === 0) return rows;
    rows.push(...data);
    after = data[data.length - 1].id;
  }
}
