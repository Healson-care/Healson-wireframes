"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One segment of the gate bar. The three gates read as a single instrument —
 * one surface, divided — rather than three loose pills, so the row says "this
 * is the search" at a glance the way a booking bar does.
 *
 * Each segment keeps the axis name visible above its value. That's what makes
 * the bar legible once it's full: "תחום · אורתופדיה" explains itself, where a
 * lone "אורתופדיה" would leave the reader to work out which question it
 * answered.
 */
export function GateTrigger({
  axis,
  value,
  active,
  muted,
  extra,
}: {
  axis: string;
  value: string;
  active: boolean;
  /**
   * The other gates left one possible answer here. Greyed, because there is
   * nothing to decide — but still open, so she can see what decided it and
   * undo her own choice from inside.
   */
  muted?: boolean;
  /** "+2" for the other selected values, when a gate holds several. */
  extra?: number;
}) {
  return (
    <span
      className={cn(
        "flex h-14 w-full items-center justify-between gap-1 px-2 text-right transition-colors sm:gap-1.5 sm:px-3",
        active ? "bg-[var(--brand-navy)]/10" : muted ? "bg-slate-100/70" : "hover:bg-white/60"
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            "truncate text-[10px] font-medium tracking-wide",
            muted && !active ? "text-slate-400" : "text-[var(--brand-navy)]/55"
          )}
        >
          {axis}
        </span>
        <span
          className={cn(
            "truncate text-xs font-semibold sm:text-[13px]",
            active ? "text-[var(--brand-navy)]" : muted ? "text-slate-400" : "text-[var(--brand-ink-soft)]"
          )}
        >
          {value}
          {!!extra && extra > 0 && <span className="font-normal text-slate-400"> +{extra}</span>}
        </span>
      </span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--brand-navy)]/40" />
    </span>
  );
}
