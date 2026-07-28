"use client";

import { useSyncExternalStore } from "react";

/** Demo mode controls the 🎮 panels that simulate Ops actions inside real
 * user-facing screens. Off by default so the product reads as production.
 * Two ways to enable:
 *  - at runtime, via the small "מצב הדגמה" toggle rendered where a panel
 *    would appear (persisted in localStorage, per browser);
 *  - for a whole environment, with NEXT_PUBLIC_DEMO_MODE=1 (forces it on).
 * Status transitions are always available the "real" way via the admin portal. */

const STORAGE_KEY = "healson-demo-mode";
const EVENT = "healson-demo-mode";

const ENV_FORCED =
  process.env.NEXT_PUBLIC_DEMO_MODE === "1" || process.env.NEXT_PUBLIC_DEMO_MODE === "true";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): boolean {
  return ENV_FORCED || localStorage.getItem(STORAGE_KEY) === "1";
}

export function useDemoMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => ENV_FORCED);
}

export function setDemoMode(on: boolean) {
  if (on) localStorage.setItem(STORAGE_KEY, "1");
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(EVENT));
}
