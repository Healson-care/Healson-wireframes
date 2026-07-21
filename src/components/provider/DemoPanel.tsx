"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The single visual wrapper for demo-only controls that live inside real
 * user-facing screens (simulating Ops/Healson actions the mock app has no
 * backoffice user for). Keeping them in one clearly-bounded, consistently
 * styled panel makes it obvious they are not part of the product flow — and
 * gives one place to hide them all behind a flag later. */
export function DemoPanel({
  description,
  children,
  className,
}: {
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-4 text-right", className)}>
      <p className="mb-1 text-xs font-semibold text-amber-700">🎮 מצב הדגמה</p>
      <p className="mb-3 text-xs text-amber-700/80">{description}</p>
      {children}
    </div>
  );
}
