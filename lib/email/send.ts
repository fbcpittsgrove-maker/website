import { createAdminClient } from "@/lib/supabase/admin";
import { reportIssue } from "@/lib/issues";

/**
 * The ONLY place in the codebase that talks to the mail provider. Owns the
 * from address and the API key, never throws into the caller — a failed
 * notification must not fail the action that triggered it.
 */

type SendInput = {
  to: string;
  subject: string;
  html: string;
  /** Trigger key for the per-trigger kill-switch gate, e.g. "invite". */
  trigger: string;
};

let gateCache: { at: number; master: boolean; triggers: Record<string, boolean> } | null =
  null;

/** Kill switch + per-trigger gates. Fails OPEN: a settings-read error must
 *  never silently swallow password resets. */
export async function isEnabled(trigger: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return true;

  if (!gateCache || Date.now() - gateCache.at > 60_000) {
    const { data, error } = await admin
      .from("email_settings")
      .select("value")
      .eq("key", "gates")
      .maybeSingle();
    if (error) {
      void reportIssue({
        source: "server_action",
        route: "email.isEnabled",
        message: error.message,
        errorCode: error.code,
      });
      return true;
    }
    const value = (data?.value ?? {}) as {
      master?: boolean;
      triggers?: Record<string, boolean>;
    };
    gateCache = {
      at: Date.now(),
      master: value.master !== false,
      triggers: value.triggers ?? {},
    };
  }

  return gateCache.master && gateCache.triggers[trigger] !== false;
}

/** Admin toggles clear the cache so the next send sees it without waiting
 *  out the TTL. */
export function clearEmailGateCache() {
  gateCache = null;
}

/** Where a mail to `address` actually lands: the dev redirect inbox off
 *  production, the address itself on production. */
export function effectiveRecipient(address: string): string {
  const isProd = process.env.VERCEL_ENV === "production";
  const redirect = process.env.EMAIL_DEV_REDIRECT;
  return !isProd && redirect ? redirect : address;
}

export async function sendEmail(
  input: SendInput,
): Promise<{ ok: boolean; id?: string; skipped?: boolean }> {
  const enabled = await isEnabled(input.trigger);
  if (!enabled) {
    void reportIssue({
      source: "server_action",
      route: "email.sendEmail",
      message: `mail skipped by gate "${input.trigger}" for ${input.to}`,
    });
    return { ok: true, skipped: true };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    void reportIssue({
      source: "server_action",
      route: "email.sendEmail",
      message: `${!apiKey ? "RESEND_API_KEY" : "RESEND_FROM"} is not set`,
      detail: { trigger: input.trigger },
    });
    return { ok: false };
  }

  // Dev guard: outside production every recipient is rewritten, with the real
  // address prefixed into the subject — a dev test must never reach the
  // client's real inbox. Without a redirect target, fail closed.
  const isProd = process.env.VERCEL_ENV === "production";
  const redirect = process.env.EMAIL_DEV_REDIRECT;
  if (!isProd && !redirect) {
    void reportIssue({
      source: "server_action",
      route: "email.sendEmail",
      message: `refusing to send to ${input.to} outside production with no EMAIL_DEV_REDIRECT`,
      detail: { trigger: input.trigger },
    });
    return { ok: false };
  }
  const to = effectiveRecipient(input.to);
  const subject = !isProd ? `[for ${input.to}] ${input.subject}` : input.subject;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html: input.html }),
    });
    if (!res.ok) {
      const body = await res.text();
      void reportIssue({
        source: "server_action",
        route: "email.sendEmail",
        message: `resend ${res.status}: ${body.slice(0, 500)}`,
        detail: { trigger: input.trigger, to },
      });
      return { ok: false };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    void reportIssue({
      source: "server_action",
      route: "email.sendEmail",
      message: err instanceof Error ? err.message : String(err),
      detail: { trigger: input.trigger, to },
    });
    return { ok: false };
  }
}
