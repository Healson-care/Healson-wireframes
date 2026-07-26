"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Misc";
import { cn } from "@/lib/utils";
import { addMonths, isoDate, monthGridDays, WEEKDAY_LABELS } from "@/lib/calendar";
import { formatShift, shiftsForDate, timeToMinutes } from "@/lib/schedule";
import { UnitResource } from "@/lib/unit-resources";
import { Appointment, ServiceArray } from "@/types";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  MonitorCog,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";

// A fixed palette keyed by position, so a מערך keeps the same colour across the
// month grid, the legend and the day detail. Deliberately not derived from the
// מערך type — two different מערכים of the same type in different branches must
// still be told apart.
const ARRAY_COLORS = [
  { dot: "bg-sky-500", chip: "bg-sky-50 text-sky-700 border-sky-200", bar: "bg-sky-400" },
  { dot: "bg-violet-500", chip: "bg-violet-50 text-violet-700 border-violet-200", bar: "bg-violet-400" },
  { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700 border-amber-200", bar: "bg-amber-400" },
  { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "bg-emerald-400" },
  { dot: "bg-rose-500", chip: "bg-rose-50 text-rose-700 border-rose-200", bar: "bg-rose-400" },
  { dot: "bg-teal-500", chip: "bg-teal-50 text-teal-700 border-teal-200", bar: "bg-teal-400" },
  { dot: "bg-indigo-500", chip: "bg-indigo-50 text-indigo-700 border-indigo-200", bar: "bg-indigo-400" },
];
const NO_ARRAY_COLOR = { dot: "bg-slate-400", chip: "bg-slate-50 text-slate-600 border-slate-200", bar: "bg-slate-300" };

/**
 * The unit's coverage יומן — the landing view of זמינות.
 *
 * The question this answers is NOT "what is booked" (that's /provider/appointments)
 * but "when are we actually open, and where are the holes". A unit with six
 * מערכים and twenty עמדות cannot answer that from a list of weekly grids, which
 * is why availability opened on an editor before: you could edit any single
 * לו״ז but never see the shape of the week.
 *
 * Each day shows a coloured bar per מערך that has at least one open עמדה, so
 * gaps (a Thursday nobody covers) and overlaps read at a glance. Clicking a day
 * expands every עמדה open on it, with its hours.
 */
export function UnitCoverageCalendar({
  resources,
  arrays,
  branchNames,
  appointments = [],
}: {
  resources: UnitResource[];
  arrays: ServiceArray[];
  branchNames: Map<string, string>;
  appointments?: Appointment[];
}) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(() => isoDate(new Date()));

  const colorFor = (arrayId?: string) => {
    if (!arrayId) return NO_ARRAY_COLOR;
    const i = arrays.findIndex((a) => a.id === arrayId);
    return i < 0 ? NO_ARRAY_COLOR : ARRAY_COLORS[i % ARRAY_COLORS.length];
  };
  const arrayName = (arrayId?: string) =>
    arrays.find((a) => a.id === arrayId)?.name ?? "ללא מערך";

  const days = useMemo(() => monthGridDays(anchor), [anchor]);
  const activeResources = useMemo(() => resources.filter((r) => r.is_active), [resources]);

  /** For a date: which עמדות are open, and their shifts. */
  const openOn = useMemo(() => {
    const map = new Map<string, { resource: UnitResource; shifts: ReturnType<typeof shiftsForDate> }[]>();
    days.forEach((d) => {
      const iso = isoDate(d);
      const entries = activeResources
        .map((resource) => ({ resource, shifts: shiftsForDate(resource, iso) }))
        .filter((e) => e.shifts.length > 0);
      map.set(iso, entries);
    });
    return map;
  }, [days, activeResources]);

  const monthLabel = anchor.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
  const todayIso = isoDate(new Date());

  // Which מערכים actually appear this month — the legend shouldn't list a מערך
  // that has no coverage at all.
  const arraysThisMonth = useMemo(() => {
    const seen = new Set<string | undefined>();
    openOn.forEach((entries) => entries.forEach((e) => seen.add(e.resource.service_array_id)));
    return arrays.filter((a) => seen.has(a.id));
  }, [openOn, arrays]);
  const hasUnassigned = useMemo(() => {
    let found = false;
    openOn.forEach((entries) => entries.forEach((e) => {
      if (!e.resource.service_array_id) found = true;
    }));
    return found;
  }, [openOn]);

  if (activeResources.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock className="h-10 w-10" />}
        title="אין עדיין עמדות פעילות"
        description="הוסיפו עמדות למערכים של היחידה, והגדירו להן לו״ז — היומן ימלא את עצמו."
      />
    );
  }

  const selectedEntries = selected ? openOn.get(selected) ?? [] : [];
  const selectedDate = selected ? new Date(selected) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Month header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {/* RTL: "previous" points right. */}
          <Button variant="outline" size="sm" onClick={() => setAnchor(addMonths(anchor, -1))} aria-label="חודש קודם">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <p className="min-w-[9rem] text-center text-sm font-semibold text-slate-900">{monthLabel}</p>
          <Button variant="outline" size="sm" onClick={() => setAnchor(addMonths(anchor, 1))} aria-label="חודש הבא">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setAnchor(new Date());
            setSelected(todayIso);
          }}
        >
          היום
        </Button>
      </div>

      {/* Legend — the colour key for the whole view. */}
      {(arraysThisMonth.length > 0 || hasUnassigned) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-600">
          {arraysThisMonth.map((a) => (
            <span key={a.id} className="flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-full", colorFor(a.id).dot)} />
              {a.name}
              <span className="text-slate-400">· {branchNames.get(a.branch_id) ?? "—"}</span>
            </span>
          ))}
          {hasUnassigned && (
            <span className="flex items-center gap-1.5 text-warning-text">
              <span className={cn("h-2.5 w-2.5 rounded-full", NO_ARRAY_COLOR.dot)} />
              ללא מערך
            </span>
          )}
        </div>
      )}

      {/* Month grid */}
      <Card className="p-2 sm:p-3">
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="pb-1 text-center text-[11px] font-semibold text-slate-400">
              {d}
            </div>
          ))}
          {days.map((d) => {
            const iso = isoDate(d);
            const entries = openOn.get(iso) ?? [];
            const inMonth = d.getMonth() === anchor.getMonth();
            const isToday = iso === todayIso;
            const isSelected = iso === selected;
            // One bar per distinct מערך covering the day.
            const arrayIds = [...new Set(entries.map((e) => e.resource.service_array_id))];
            const booked = appointments.filter((a) => a.date === iso && a.status !== "בוטל").length;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelected(iso)}
                className={cn(
                  "flex min-h-[4.25rem] flex-col gap-1 rounded-lg border p-1.5 text-right transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : entries.length > 0
                    ? "border-slate-200 bg-white hover:border-primary/40"
                    : "border-slate-100 bg-slate-50/60 hover:border-slate-300",
                  !inMonth && "opacity-40"
                )}
              >
                <span className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      isToday
                        ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white"
                        : "text-slate-700"
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {booked > 0 && <span className="text-[9px] text-slate-400">{booked} תורים</span>}
                </span>
                {entries.length === 0 ? (
                  inMonth && <span className="text-[9px] text-slate-300">ללא כיסוי</span>
                ) : (
                  <span className="flex flex-col gap-0.5">
                    {arrayIds.slice(0, 3).map((id) => (
                      <span key={id ?? "none"} className={cn("h-1 rounded-full", colorFor(id).bar)} />
                    ))}
                    {arrayIds.length > 3 && (
                      <span className="text-[9px] leading-none text-slate-400">+{arrayIds.length - 3}</span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Day detail — every עמדה open on the selected date. */}
      {selectedDate && (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">
              {selectedDate.toLocaleDateString("he-IL", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <Badge tone={selectedEntries.length > 0 ? "green" : "warning"}>
              {selectedEntries.length > 0 ? `${selectedEntries.length} עמדות פתוחות` : "ללא כיסוי"}
            </Badge>
          </div>

          {selectedEntries.length === 0 ? (
            <p className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2.5 text-xs leading-relaxed text-warning-text">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              אף עמדה אינה פתוחה ביום זה — לא ייווצרו תורים. אם זה לא מכוון, בדקו את לוחות הזמנים בלשונית
              ‚מערכים ועמדות‘.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Grouped by מערך, which is how the unit thinks about coverage. */}
              {[...new Set(selectedEntries.map((e) => e.resource.service_array_id))].map((arrayId) => {
                const group = selectedEntries.filter((e) => e.resource.service_array_id === arrayId);
                const color = colorFor(arrayId);
                return (
                  <div key={arrayId ?? "none"} className="rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", color.dot)} />
                      <p className="text-sm font-semibold text-slate-900">{arrayName(arrayId)}</p>
                      <span className="text-[11px] text-slate-400">{group.length} עמדות</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {group.map(({ resource, shifts }) => (
                        <div key={resource.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <span className="flex items-center gap-1.5 text-sm text-slate-800">
                            {resource.kind === "facility" ? (
                              <MonitorCog className="h-3.5 w-3.5 text-slate-400" />
                            ) : (
                              <Stethoscope className="h-3.5 w-3.5 text-info-text" />
                            )}
                            {resource.name}
                            {(resource.capacity ?? 1) > 1 && (
                              <span className="text-[11px] text-slate-400">×{resource.capacity}</span>
                            )}
                          </span>
                          <span className="flex flex-wrap gap-1">
                            {[...shifts]
                              .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
                              .map((s) => (
                                <span
                                  key={s.id}
                                  dir="ltr"
                                  className={cn("rounded border px-1.5 py-0.5 text-[11px] font-medium", color.chip)}
                                >
                                  {formatShift(s)}
                                </span>
                              ))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
