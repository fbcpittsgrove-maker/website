"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteContent, saveContent } from "@/app/(app)/admin/content-actions";
import {
  CONTENT_FIELDS,
  CONTENT_LABEL,
  formValues,
  formatDay,
  formatEventWhen,
  type ContentKind,
  type ContentRow,
} from "@/lib/content";

const INPUT =
  "w-full rounded-lg border border-border-strong bg-inset px-3 py-2 text-sm text-ink outline-none focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

function str(row: ContentRow, key: string): string {
  const v = row[key];
  return typeof v === "string" ? v : "";
}

function summary(kind: ContentKind, row: ContentRow): string {
  if (kind === "events") return [formatEventWhen(str(row, "starts_at"), str(row, "ends_at") || null), str(row, "location")].filter(Boolean).join(" · ");
  if (kind === "sermons") return [formatDay(str(row, "preached_on")), str(row, "preacher"), str(row, "scripture")].filter(Boolean).join(" · ");
  const from = str(row, "starts_on");
  const until = str(row, "ends_on");
  if (from && until) return `${formatDay(from)} – ${formatDay(until)}`;
  if (from) return `From ${formatDay(from)}`;
  if (until) return `Until ${formatDay(until)}`;
  return "No end date";
}

/** One editor for every content kind, rendered from CONTENT_FIELDS: a list
 *  with inline edit, a create form, and two-step delete. */
export function ContentEditor({ kind, rows }: { kind: ContentKind; rows: ContentRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = CONTENT_LABEL[kind];

  function submit(id: string | null, form: HTMLFormElement) {
    const data = new FormData(form);
    const values: Record<string, unknown> = {};
    for (const field of CONTENT_FIELDS[kind]) {
      values[field.name] = field.type === "checkbox" ? data.get(field.name) === "on" : (data.get(field.name) ?? "");
    }
    startTransition(async () => {
      setError(null);
      const result = await saveContent(kind, id, values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      setError(null);
      const result = await deleteContent(kind, id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirmDelete(null);
      router.refresh();
    });
  }

  function editorFor(id: string | null, row: ContentRow | null) {
    const initial = formValues(kind, row);
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(id, e.currentTarget);
        }}
        className="grid gap-4 sm:grid-cols-2"
      >
        {CONTENT_FIELDS[kind].map((field) => {
          const fieldId = `${kind}-${id ?? "new"}-${field.name}`;
          if (field.type === "checkbox") {
            return (
              <label key={field.name} htmlFor={fieldId} className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
                <input id={fieldId} name={field.name} type="checkbox" defaultChecked={initial[field.name] === true} className="h-4 w-4 accent-brand" />
                {field.label}
              </label>
            );
          }
          const wide = field.type === "textarea" || field.name === "title";
          return (
            <div key={field.name} className={wide ? "sm:col-span-2" : undefined}>
              <label htmlFor={fieldId} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                {field.label}
                {field.required && <span aria-hidden> *</span>}
              </label>
              {field.type === "textarea" ? (
                <textarea id={fieldId} name={field.name} rows={5} defaultValue={String(initial[field.name] ?? "")} className={INPUT} />
              ) : (
                <input
                  id={fieldId}
                  name={field.name}
                  required={field.required}
                  type={field.type === "datetime" ? "datetime-local" : field.type === "url" ? "url" : field.type === "date" ? "date" : "text"}
                  defaultValue={String(initial[field.name] ?? "")}
                  className={INPUT}
                />
              )}
              {field.hint && <p className="mt-1 text-xs text-muted">{field.hint}</p>}
            </div>
          );
        })}
        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-action px-4 py-2 text-sm font-semibold text-on-brand hover:bg-action-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {pending ? "Saving…" : id ? "Save changes" : `Add ${label.singular}`}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setError(null);
            }}
            className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-ink hover:bg-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {error && (
        <p role="alert" className="rounded-lg border border-bad-line bg-bad-soft px-4 py-2.5 text-sm text-bad">
          {error}
        </p>
      )}

      {editing === "new" ? (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">New {label.singular}</h2>
          {editorFor(null, null)}
        </section>
      ) : (
        <button
          onClick={() => {
            setEditing("new");
            setError(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-action px-4 py-2 text-sm font-semibold text-on-brand hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add {label.singular}
        </button>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong px-4 py-8 text-center text-sm text-muted">
          No {label.plural.toLowerCase()} yet.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {rows.map((row) => (
            <li key={row.id} className="p-4">
              {editing === row.id ? (
                editorFor(row.id, row)
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                      {str(row, "title")}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          row.published ? "bg-ok-soft text-ok" : "bg-inset text-muted"
                        }`}
                      >
                        {row.published ? "On the website" : "Draft"}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-muted">{summary(kind, row)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditing(row.id);
                        setConfirmDelete(null);
                        setError(null);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-border-strong px-3 py-1.5 text-xs font-medium text-ink hover:bg-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      Edit
                    </button>
                    {confirmDelete === row.id ? (
                      <button
                        disabled={pending}
                        onClick={() => remove(row.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-bad px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        Delete for good?
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(row.id)}
                        aria-label={`Delete ${str(row, "title")}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-border-strong px-3 py-1.5 text-xs font-medium text-bad hover:bg-bad-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
