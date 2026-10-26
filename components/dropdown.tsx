"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type Option = { value: string; label: string; dot?: string; tone?: string };

/**
 * The shared custom dropdown — never a native <select> (its option popup
 * ignores styling and reads as broken next to the board's theme). Keyboard
 * nav, Esc, click-outside, and drop-up when near the viewport edge.
 */
export function Dropdown({
  value,
  onChange,
  options,
  ariaLabel,
  disabled,
  active,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  ariaLabel: string;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => {
      document.removeEventListener("pointerdown", away);
    };
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  const openList = () => {
    if (disabled) return;
    if (rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      setAbove(window.innerHeight - rect.bottom < 240);
    }
    setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const toggle = () => {
    if (disabled) return;
    if (open) setOpen(false);
    else openList();
  };

  const pick = (v: string) => {
    setOpen(false);
    onChange(v);
    buttonRef.current?.focus();
  };

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) openList();
    }
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((a) => Math.max(0, a - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const o = options[activeIndex];
      if (o) pick(o.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const label = useMemo(() => current?.label ?? value, [current, value]);

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        onKeyDown={onTriggerKey}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
          active ? "border-brand bg-brand-soft text-brand-deep" : "border-border bg-surface text-text hover:border-brand"
        }`}
      >
        {current?.dot && <span className={`h-2.5 w-2.5 rounded-full ${current.dot}`} />}
        <span className={current?.tone}>{label}</span>
        <span aria-hidden className="text-xs text-muted">▾</span>
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-activedescendant={`${listId}-opt-${activeIndex}`}
          onKeyDown={onListKey}
          className={`absolute z-30 min-w-44 rounded-lg border border-border bg-surface p-1.5 shadow-lg outline-none ${
            above ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } left-0`}
        >
          {options.map((o, i) => (
            <li key={o.value} id={`${listId}-opt-${i}`} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => pick(o.value)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  i === activeIndex ? "bg-inset" : ""
                } ${o.value === value ? "font-semibold text-ink" : "text-text hover:bg-inset"}`}
              >
                {o.dot && <span className={`h-2.5 w-2.5 rounded-full ${o.dot}`} />}
                <span className={o.tone}>{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
