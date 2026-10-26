"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { base, button, heading, paragraph } from "@/lib/email/templates";
import { reportIssue } from "@/lib/issues";
import { clientIp, underLimit } from "@/lib/auth/throttle";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Resets one address may ask for per hour, and one caller may ask for in
 *  total — the mail provider is the thing being protected. */
const PER_EMAIL_PER_HOUR = 3;
const PER_IP_PER_HOUR = 10;

/**
 * Self-serve password reset. The invite path with type swapped to recovery:
 * generateLink -> token_hash -> /auth/confirm interstitial -> /update-password.
 * NEVER resetPasswordForEmail — that mails Supabase's one-shot ConfirmationURL
 * through the built-in mailer, the exact scanner-vulnerable shape this exists
 * to kill.
 *
 * The response is uniform whether or not the email has an account — no
 * account-existence leak. The lookup and the send run in `after()`, once the
 * response is on its way, so the round-trip time is the same for both cases
 * and a throttled request is indistinguishable from a served one.
 */
export async function requestPasswordReset(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Mail is not configured yet — ask an admin." };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is not set");

  const address = email.trim();
  if (!EMAIL_SHAPE.test(address)) return { ok: false, error: "Enter a valid email address." };

  const ip = clientIp(await headers());
  const withinIp = await underLimit(`reset:ip:${ip}`, PER_IP_PER_HOUR, 3600);
  const withinEmail = await underLimit(
    `reset:email:${address.toLowerCase()}`,
    PER_EMAIL_PER_HOUR,
    3600,
  );
  if (!withinIp || !withinEmail) return { ok: true };

  after(async () => {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: address,
    });
    if (error) {
      // Unknown email is the common case; log everything else.
      if (!/not found/i.test(error.message)) {
        void reportIssue({
          source: "server_action",
          route: "forgot-password.requestPasswordReset",
          message: error.message,
          errorCode: error.code,
        });
      }
      return;
    }

    const link = `${siteUrl}/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=/update-password`;
    await sendEmail({
      to: address,
      trigger: "password_reset",
      subject: "Reset your church website password",
      html: base(
        heading("Reset your password") +
          paragraph("Someone asked for a password reset for this account. If that was you:") +
          button(link, "Choose a new password") +
          paragraph("If it wasn&apos;t you, ignore this — your password stays as it is."),
        "Your password reset link",
      ),
    });
  });

  return { ok: true };
}
