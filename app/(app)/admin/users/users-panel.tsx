"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteUser,
  inviteUser,
  resetUserMfa,
  setUserActive,
  setUserPassword,
  setUserRole,
} from "./actions";
import { ROLE_LABEL, type Role } from "@/lib/auth/roles";

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  active: boolean;
  is_owner: boolean;
  created_at: string;
};

type InviteRow = {
  id: string;
  email: string;
  role: Role;
  expires_at: string;
  created_at: string;
};

export function UsersPanel({
  profiles,
  invites,
  isOwner,
}: {
  profiles: ProfileRow[];
  invites: InviteRow[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: Promise<{ ok: boolean; error?: string }>, okMessage: string, onSuccess?: () => void) {
    startTransition(async () => {
      setError(null);
      setNotice(null);
      const result = await action;
      if (!result.ok) {
        setError(result.error ?? "That didn't work.");
      } else {
        setNotice(okMessage);
        onSuccess?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-6 space-y-8">
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">Invite someone</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_140px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            const invited = email;
            run(
              inviteUser(email, role, fullName),
              `Invite sent to ${invited}.`,
              () => {
                setEmail("");
                setFullName("");
              },
            );
          }}
        >
          <input
            type="email"
            required
            aria-label="Email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-border-strong bg-inset px-3 py-2 text-sm text-ink outline-none focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
          <input
            type="text"
            aria-label="Full name"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="rounded-lg border border-border-strong bg-inset px-3 py-2 text-sm text-ink outline-none focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
          <select
            value={role}
            aria-label="Role"
            onChange={(e) => setRole(e.target.value as Role)}
            className="rounded-lg border border-border-strong bg-inset px-3 py-2 text-sm text-ink outline-none focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-action px-4 py-2 text-sm font-semibold text-on-brand hover:bg-action-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Invite
          </button>
        </form>
        {notice && (
          <p className="mt-3 rounded-lg border border-ok-line bg-ok-soft px-4 py-2.5 text-sm text-ok">
            {notice}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-bad-line bg-bad-soft px-4 py-2.5 text-sm text-bad">
            {error}
          </p>
        )}
      </section>

      {invites.length > 0 && (
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted">
            Pending invites
          </h2>
          <ul className="mt-2 space-y-2">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded-lg border border-warn-line bg-warn-soft px-4 py-2.5 text-sm"
              >
                <span className="font-medium text-ink">{inv.email}</span>
                <span className="text-xs text-warn">
                  {ROLE_LABEL[inv.role]} · expires {new Date(inv.expires_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted">
          People
        </h2>
        <ul className="mt-2 space-y-2">
          {profiles.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-border bg-surface px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-semibold text-ink">{p.full_name}</span>
                  <span className="ml-2 text-sm text-muted">{p.email}</span>
                  {p.is_owner && (
                    <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-deep">
                      Owner
                    </span>
                  )}
                  {!p.active && (
                    <span className="ml-2 rounded-full bg-bad-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bad">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={p.role}
                    disabled={pending || p.is_owner}
                    aria-label={`Role for ${p.email}`}
                    onChange={(e) =>
                      run(setUserRole(p.id, e.target.value as Role), "Role updated.")
                    }
                    className="rounded-lg border border-border-strong bg-inset px-2 py-1.5 text-xs text-ink outline-none focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
                  >
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    disabled={pending || p.is_owner}
                    onClick={() =>
                      run(
                        setUserActive(p.id, !p.active),
                        p.active ? "Deactivated." : "Activated.",
                      )
                    }
                    className="rounded-lg border border-border-strong px-3 py-1.5 text-xs font-medium text-text hover:bg-inset disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    {p.active ? "Deactivate" : "Activate"}
                  </button>
                  <ManageMenu
                    pending={pending}
                    isOwner={isOwner}
                    isOwnerTarget={p.is_owner}
                    onSetPassword={() => {
                      const pw = window.prompt(`New password for ${p.email} (min 8 chars):`);
                      if (pw) run(setUserPassword(p.id, pw), "Password set.");
                    }}
                    onResetMfa={() => {
                      if (window.confirm(`Reset two-factor for ${p.email}? They can enroll again from their account page.`))
                        run(resetUserMfa(p.id), "Two-factor reset.");
                    }}
                    onDelete={() => {
                      if (window.confirm(`Delete ${p.email}? This cannot be undone.`))
                        run(deleteUser(p.id), "User deleted.");
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ManageMenu({
  pending,
  isOwner,
  isOwnerTarget,
  onSetPassword,
  onResetMfa,
  onDelete,
}: {
  pending: boolean;
  isOwner: boolean;
  isOwnerTarget: boolean;
  onSetPassword: () => void;
  onResetMfa: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = [
    { label: "Set password", disabled: pending || (isOwnerTarget && !isOwner), onPick: onSetPassword },
    { label: "Reset 2FA", disabled: pending || !isOwner, onPick: onResetMfa },
    { label: "Delete", disabled: pending || isOwnerTarget, onPick: onDelete, danger: true },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-lg border border-border-strong px-3 py-1.5 text-xs font-medium text-text hover:bg-inset disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Manage ▾
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1.5 w-44 rounded-xl border border-border bg-surface p-1 shadow-lg">
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onPick();
              }}
              className={`block w-full rounded-lg px-3 py-1.5 text-left text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 ${it.danger ? "text-bad hover:bg-bad-soft" : "text-text hover:bg-inset"}`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
