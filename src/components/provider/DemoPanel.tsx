"use client";

import { ReactNode } from "react";
import { Gamepad2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemoMode, setDemoMode } from "@/lib/demo";

/** The single visual wrapper for demo-only controls that live inside real
 * user-facing screens (simulating Ops/Healson actions the mock app has no
 * backoffice user for). Collapsed by default to a discreet toggle chip so the
 * product reads as production; opening it persists per browser — see
 * src/lib/demo.ts. When collapsed, the same transitions are performed the
 * real way from the admin portal. */
export function DemoPanel({
  description,
  children,
  className,
}: {
  description: string;
  children: ReactNode;
  className?: string;
}) {
  const demoMode = useDemoMode();

  if (!demoMode) {
    return (
      <div className={cn("flex justify-center", className)}>
        <button
          type="button"
          onClick={() => setDemoMode(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-1 text-[11px] text-slate-400 transition-colors hover:border-amber-300 hover:bg-amber-50/60 hover:text-amber-700"
        >
          <Gamepad2 className="h-3 w-3" /> מצב הדגמה
        </button>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-4 text-right", className)}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-amber-700">🎮 מצב הדגמה</p>
        <button
          type="button"
          onClick={() => setDemoMode(false)}
          className="text-[11px] text-amber-600 hover:underline"
        >
          הסתר
        </button>
      </div>
      <p className="mb-3 text-xs text-amber-700/80">{description}</p>
      {children}
    </div>
  );
}
