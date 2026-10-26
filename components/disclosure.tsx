"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";

/**
 * Saved information reads compact; a form appears only on Edit or Add. Every
 * form rendered inside one of these calls `useDisclosure().close()` after a
 * successful save, so the compact view comes straight back. Outside a
 * disclosure the hook is a no-op, so a form works standalone too.
 */

type Ctx = { open: boolean; setOpen: (open: boolean) => void };
const DisclosureContext = createContext<Ctx | null>(null);

export function useDisclosure() {
  const ctx = useContext(DisclosureContext);
  return { open: ctx?.open ?? true, close: () => ctx?.setOpen(false) };
}

export type Fact = { label: string; value: ReactNode };

const GHOST =
  "rounded-lg px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:bg-inset hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export function FactsGrid({ facts }: { facts: Fact[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {facts.map((f) => (
        <div key={f.label}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{f.label}</dt>
          <dd className="mt-0.5 text-sm text-ink">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A card of saved facts with an Edit button that swaps the form in. */
export function EditCard({
  title,
  facts,
  children,
  canEdit = true,
  editLabel = "Edit",
  footer,
}: {
  title: string;
  facts: Fact[];
  children: ReactNode;
  canEdit?: boolean;
  editLabel?: string;
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DisclosureContext.Provider value={{ open, setOpen }}>
      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted">{title}</h2>
          {canEdit && (
            <button type="button" onClick={() => setOpen(!open)} className={GHOST}>
              {open ? "Cancel" : editLabel}
            </button>
          )}
        </div>
        <div className="mt-3">{open ? children : <FactsGrid facts={facts} />}</div>
        {footer}
      </section>
    </DisclosureContext.Provider>
  );
}

/** One row in a list: a compact summary with Edit that opens the form beneath it. */
export function EditRow({
  summary,
  children,
  canEdit = true,
  className,
}: {
  summary: ReactNode;
  children: ReactNode;
  canEdit?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DisclosureContext.Provider value={{ open, setOpen }}>
      <div className={className ?? "rounded-lg border border-border bg-inset px-3 py-2"}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">{summary}</div>
          {canEdit && (
            <button type="button" onClick={() => setOpen(!open)} className={GHOST}>
              {open ? "Cancel" : "Edit"}
            </button>
          )}
        </div>
        {open && <div className="mt-3">{children}</div>}
      </div>
    </DisclosureContext.Provider>
  );
}

/** A "+ Add …" pill; clicking it reveals the form in a card. */
export function AddButton({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {label}
      </button>
    );
  }
  return (
    <DisclosureContext.Provider value={{ open, setOpen }}>
      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{label}</p>
          <button type="button" onClick={() => setOpen(false)} className={GHOST}>
            Cancel
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </section>
    </DisclosureContext.Provider>
  );
}
