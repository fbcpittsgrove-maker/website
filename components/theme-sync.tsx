"use client";

import { useEffect } from "react";

/**
 * Client backstop for the theme. Next's not-found and error boundaries
 * client-render the tree from scratch: the inline script's `data-theme`
 * attribute is wiped, so those pages would flash the default (light) theme.
 * This re-applies the stored choice in an effect on every mount.
 */
export function ThemeSync() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem("fbc-pittsgrove-theme");
      if (stored === "dark" || stored === "light") {
        document.documentElement.dataset.theme = stored;
      }
    } catch {
      // no storage — keep the default
    }
  }, []);
  return null;
}
