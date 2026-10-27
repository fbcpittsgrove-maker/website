"use client";

import { useSyncExternalStore } from "react";
import { nextService } from "@/lib/next-service";

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 30_000);
  return () => clearInterval(id);
}

const minute = () => Math.floor(Date.now() / 60_000);

/** Glass card on the home hero counting down to the next service. The
 *  countdown depends on the visitor's clock, so the server renders the
 *  card's frame and the browser fills it in. */
export function NextServiceCard() {
  const now = useSyncExternalStore(subscribe, minute, () => null);
  const next = now === null ? null : nextService(new Date(now * 60_000));

  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-md md:justify-self-end">
      <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
        <span aria-hidden className="h-2 w-2 rounded-full bg-accent-line" />
        Next gathering
      </p>
      <p className="mt-3 min-h-[2.5rem] font-display text-3xl font-semibold leading-tight">{next?.label}</p>
      <p className="mt-4 flex min-h-[2.4rem] items-baseline justify-between gap-3 border-t border-white/20 pt-4">
        <span className="opacity-90">{next?.when}</span>
        <span className="text-sm font-semibold text-accent-line">{next?.until}</span>
      </p>
    </div>
  );
}
