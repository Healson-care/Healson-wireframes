"use client";

import { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { CalendarView, VIEW_LABELS, rangeLabel, shiftAnchor } from "@/lib/schedule-calendar";

/** Range stepper + current-range title, shared by every calendar in the portal
 * (availability and appointments) so navigation feels identical everywhere.
 * RTL: the right chevron steps BACK. */
export function CalendarNav({
  view,
  anchor,
  onAnchorChange,
  subtitle,
}: {
  view: CalendarView;
  anchor: Date;
  onAnchorChange: (next: Date) => void;
  /** Optional second line under the range label (e.g. "12 תורים"). */
  subtitle?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
        <Button variant="ghost" size="sm" aria-label="הקודם" onClick={() => onAnchorChange(shiftAnchor(view, anchor, -1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <button
          type="button"
          onClick={() => onAnchorChange(new Date())}
          className="focus-ring rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          היום
        </button>
        <Button variant="ghost" size="sm" aria-label="הבא" onClick={() => onAnchorChange(shiftAnchor(view, anchor, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
      <div>
        <p className="min-w-[8rem] text-sm font-bold text-slate-900">{rangeLabel(view, anchor)}</p>
        {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

/** יום / שבוע / חודש switch. */
export function ViewSwitch({ view, onChange }: { view: CalendarView; onChange: (v: CalendarView) => void }) {
  return (
    <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
      {(Object.keys(VIEW_LABELS) as CalendarView[]).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "focus-ring rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
            view === v ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
          )}
        >
          {VIEW_LABELS[v]}
        </button>
      ))}
    </div>
  );
}
