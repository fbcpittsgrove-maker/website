"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireOwner, type Profile } from "@/lib/auth/profile";
import { sendEmail } from "@/lib/email/send";
import { base, button, heading, paragraph } from "@/lib/email/templates";
import { logActivity } from "@/lib/activity";
import { reportAndFail } from "@/lib/issues";
import type { Role } from "@/lib/auth/roles";

const ROLES: Role[] = ["admin", "editor"];

type Result = { ok: true } | { ok: false; error: string };

function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SITE_URL is not set");
  return url;
}

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/** Owner rows are protected: a non-owner admin must not change an owner's
 *  role, password, active state or delete them. Returns an error result when
 *  the actor isn't allowed to touch this target. */
async function refuseOwnerTarget(admin: AdminClient, userId: string, actor: Profile): Promise<Result | null> {
  if (actor.is_owner) return null;
  const { data, error } = await admin.from("profiles").select("is_owner").eq("id", userId).single();
  if (error) {
    return reportAndFail(
      { source: "server_action", route: "admin.users.readTarget", message: error.message, errorCode: error.code, userId: actor.id },
      "Couldn't read that user.",
    );
  }
  if (data?.is_owner) return { ok: false, error: "Only an owner can change an owner's account." };
  return null;
}

/**
 * The ONLY thing that sends invite email: generateLink -> token_hash ->
 * /auth/confirm interstitial, mailed via the email funnel. The dashboard's
 * invite button stays unused forever. The created auth user is rolled back
 * if the mail send fails — no orphaned credentials.
 */
export async function inviteUser(
  email: string,
  role: Role,
  fullName: string,
): Promise<Result> {
  const actor = await requireAdmin();
  if (!ROLES.includes(role)) return { ok: false, error: "Unknown role." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Server is missing its Supabase keys." };

  // A re-invite of an email that already has a profile row: handle_new_user
  // only re-keys the row's id, so the invite's role lands here.
  const { data: existing, error: existingError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingError) {
    return reportAndFail(
      { source: "server_action", route: "admin.users.inviteUser", message: existingError.message, errorCode: existingError.code, userId: actor.id },
      "Couldn't check for an existing user.",
    );
  }
  if (existing) {
    const protectedTarget = await refuseOwnerTarget(admin, existing.id, actor);
    if (protectedTarget) return protectedTarget;
    const { error: rekeyError } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", existing.id);
    if (rekeyError) {
      return reportAndFail(
        { source: "server_action", route: "admin.users.inviteUser", message: rekeyError.message, errorCode: rekeyError.code, userId: actor.id },
        "Couldn't update the existing user for this invite.",
      );
    }
  }

  // Record the invite BEFORE creating the auth user: handle_new_user reads
  // this row on the auth-users insert to set the profile's role and mark the
  // invite accepted. Creating the user first leaves the invite pending forever.
  const { data: inviteRow, error: inviteError } = await admin
    .from("invites")
    .insert({ email, role, invited_by: actor.id })
    .select("id")
    .single();
  if (inviteError) {
    return reportAndFail(
      {
        source: "server_action",
        route: "admin.users.inviteUser",
        message: inviteError.message,
        errorCode: inviteError.code,
      },
      "Couldn't record the invite.",
    );
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: { full_name: fullName || email } },
  });
  if (error) {
    await admin.from("invites").delete().eq("id", inviteRow.id);
    return reportAndFail(
      {
        source: "server_action",
        route: "admin.users.inviteUser",
        message: error.message,
        errorCode: error.code,
      },
      `Couldn't create that invite: ${error.message}`,
    );
  }

  const link = `${siteUrl()}/auth/confirm?token_hash=${data.properties.hashed_token}&type=invite&next=/update-password`;
  const sent = await sendEmail({
    to: email,
    trigger: "invite",
    subject: "You're invited to the Faith Baptist Church website admin",
    html: base(
      heading("Welcome") +
        paragraph(
          `${actor.full_name || "Someone"} has set you up to help run the Faith Baptist Church of Pittsgrove website.`,
        ) +
        button(link, "Accept the invite") +
        paragraph("The link opens a confirmation page — one click there finishes it."),
      "Your church website invite",
    ),
  });
  if (!sent.ok) {
    await admin.from("profiles").delete().eq("id", data.user.id);
    await admin.auth.admin.deleteUser(data.user.id);
    await admin.from("invites").delete().eq("id", inviteRow.id);
    return { ok: false, error: sent.skipped ? "Email is switched off, so the invite wasn't sent — nobody was created." : "The invite email failed to send — nobody was created." };
  }

  await logActivity(actor.id, "user_invited", { email, role });
  return { ok: true };
}

export async function setUserRole(userId: string, role: Role): Promise<Result> {
  const actor = await requireAdmin();
  if (!ROLES.includes(role)) return { ok: false, error: "Unknown role." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Server is missing its Supabase keys." };
  const protectedTarget = await refuseOwnerTarget(admin, userId, actor);
  if (protectedTarget) return protectedTarget;
  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) {
    return reportAndFail(
      { source: "server_action", route: "admin.users.setUserRole", message: error.message, errorCode: error.code },
      "Couldn't change that role.",
    );
  }
  await logActivity(actor.id, "user_role_changed", { userId, role });
  return { ok: true };
}

export async function setUserPassword(userId: string, password: string): Promise<Result> {
  const actor = await requireAdmin();
  if (password.length < 8) return { ok: false, error: "At least 8 characters." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Server is missing its Supabase keys." };
  const protectedTarget = await refuseOwnerTarget(admin, userId, actor);
  if (protectedTarget) return protectedTarget;
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) {
    return reportAndFail(
      { source: "server_action", route: "admin.users.setUserPassword", message: error.message, errorCode: error.code },
      `Couldn't set the password: ${error.message}`,
    );
  }
  await logActivity(actor.id, "user_password_set", { userId });
  return { ok: true };
}

export async function setUserActive(userId: string, active: boolean): Promise<Result> {
  const actor = await requireAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Server is missing its Supabase keys." };
  const protectedTarget = await refuseOwnerTarget(admin, userId, actor);
  if (protectedTarget) return protectedTarget;
  const { error } = await admin.from("profiles").update({ active }).eq("id", userId);
  if (error) {
    return reportAndFail(
      { source: "server_action", route: "admin.users.setUserActive", message: error.message, errorCode: error.code },
      "Couldn't change that user's status.",
    );
  }
  await logActivity(actor.id, active ? "user_activated" : "user_deactivated", { userId });
  return { ok: true };
}

export async function deleteUser(userId: string): Promise<Result> {
  const actor = await requireAdmin();
  if (userId === actor.id) return { ok: false, error: "You can't delete yourself." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Server is missing its Supabase keys." };
  const protectedTarget = await refuseOwnerTarget(admin, userId, actor);
  if (protectedTarget) return protectedTarget;
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return reportAndFail(
      { source: "server_action", route: "admin.users.deleteUser", message: error.message, errorCode: error.code },
      "Couldn't delete that user.",
    );
  }
  await admin.from("profiles").delete().eq("id", userId);
  await logActivity(actor.id, "user_deleted", { userId });
  return { ok: true };
}

/** Lost-phone rescue: wipe a user's authenticator factors. Owner-only, and
 *  every reset lands in the activity feed. */
export async function resetUserMfa(userId: string): Promise<Result> {
  const actor = await requireOwner();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Server is missing its Supabase keys." };
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error) {
    return reportAndFail(
      { source: "server_action", route: "admin.users.resetUserMfa", message: error.message, errorCode: error.code },
      "Couldn't read that user's factors.",
    );
  }
  for (const factor of data.factors ?? []) {
    const { error: delError } = await admin.auth.admin.mfa.deleteFactor({
      userId,
      id: factor.id,
    });
    if (delError) {
      return reportAndFail(
        { source: "server_action", route: "admin.users.resetUserMfa", message: delError.message, errorCode: delError.code },
        "Couldn't remove a factor.",
      );
    }
  }
  await logActivity(actor.id, "user_mfa_reset", { userId });
  return { ok: true };
}
