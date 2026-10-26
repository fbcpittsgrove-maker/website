"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem("fbc-pittsgrove-theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // no storage
  }
  return "light";
}

/** Light/dark toggle. Persists to localStorage and flips the root attribute.
 *  The default (no stored value) is light. `sm` is the borderless 32px form
 *  for the sidebar header; `md` the bordered 44px control everywhere else. */
export function ThemeToggle({ size = "md" }: { size?: "md" | "sm" }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light");

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("fbc-pittsgrove-theme", next);
    } catch {
      // no storage
    }
    for (const notify of listeners) notify();
  }

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={theme === "dark"}
      aria-label="Dark mode"
      className={`inline-flex items-center justify-center rounded-lg text-muted transition-colors hover:bg-inset hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        size === "sm" ? "h-8 w-8" : "h-11 w-11 border border-border"
      }`}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
}
