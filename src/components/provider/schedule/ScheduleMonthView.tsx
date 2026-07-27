"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { isoDate, monthGridDays, WEEKDAY_LABELS } from "@/lib/calendar";
import { shiftsForDate } from "@/lib/schedule";
import { Appointment } from "@/types";
import { CalendarLane, deptColor, NO_DEPT } from "@/lib/schedule-calendar";

/** Month coverage grid — the "where are the holes" overview. Each day shows one
 * colour bar per department (מערך) with an open עמדה, so gaps and overlaps read
 * at a glance. Clicking a day drills into the day view. */
export function ScheduleMonthView({
  anchor,
  lanes,
  deptOrder,
  appointments = [],
  onPickDay,
}: {
  anchor: Date;
  lanes: CalendarLane[];
  deptOrder: string[];
  appointments?: Appointment[];
  onPickDay: (date: Date) => void;
}) {
  const days = useMemo(() => monthGridDays(anchor), [anchor]);
  const todayIso = isoDate(new Date());

  /** For each date: the distinct departments with at least one open עמדה. */
  const deptsByDay = useMemo(() => {
    const map = new Map<string, { deptId: string; count: number }[]>();
    for (const d of days) {
      const iso = isoDate(d);
      const counts = new Map<string, number>();
      for (const lane of lanes) {
        if (!lane.is_active) continue;
        if (shiftsForDate(lane, iso).length === 0) continue;
        const dept = lane.service_array_id ?? NO_DEPT;
        counts.set(dept, (counts.get(dept) ?? 0) + 1);
      }
      map.set(
        iso,
        [...counts.entries()].map(([deptId, count]) => ({ deptId, count }))
      );
    }
    return map;
  }, [days, lanes]);

  const bookedByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) {
      if (a.status === "בוטל") continue;
      map.set(a.date, (map.get(a.date) ?? 0) + 1);
    }
    return map;
  }, [appointments]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:p-3">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="pb-1 text-center text-[11px] font-semibold text-slate-400">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const iso = isoDate(d);
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = iso === todayIso;
          const depts = deptsByDay.get(iso) ?? [];
          const booked = bookedByDay.get(iso) ?? 0;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPickDay(d)}
              className={cn(
                "flex min-h-[4.75rem] flex-col gap-1 rounded-lg border p-1.5 text-start transition-colors",
                depts.length > 0
                  ? "border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm"
                  : "border-slate-100 bg-slate-50/60 hover:border-slate-300",
                isToday && "border-primary ring-1 ring-primary",
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
              {depts.length === 0 ? (
                inMonth && <span className="text-[9px] text-slate-300">ללא כיסוי</span>
              ) : (
                <span className="flex flex-col gap-0.5">
                  {depts.slice(0, 4).map((x) => (
                    <span
                      key={x.deptId}
                      className={cn("h-1.5 rounded-full", deptColor(x.deptId, deptOrder).bar)}
                    />
                  ))}
                  {depts.length > 4 && (
                    <span className="text-[9px] leading-none text-slate-400">+{depts.length - 4}</span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
