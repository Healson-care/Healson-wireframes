"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { isoDate, monthGridDays, WEEKDAY_LABELS } from "@/lib/calendar";
import { Appointment } from "@/types";
import { APPOINTMENT_STATUS_COLORS } from "@/lib/appointment-calendar";

/** Month overview of the diary — "which days are full, which are empty".
 * Each cell lists its first few appointments (time + patient) coloured by
 * status; clicking a day drills into that day's board. */
export function AppointmentMonthView({
  anchor,
  appointments,
  onPickDay,
}: {
  anchor: Date;
  appointments: Appointment[];
  onPickDay: (date: Date) => void;
}) {
  const days = useMemo(() => monthGridDays(anchor), [anchor]);
  const todayIso = isoDate(new Date());

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const arr = map.get(a.date) ?? [];
      arr.push(a);
      map.set(a.date, arr);
    }
    for (const [, arr] of map) arr.sort((x, y) => x.time.localeCompare(y.time));
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
          const dayAppointments = byDay.get(iso) ?? [];
          const active = dayAppointments.filter((a) => a.status !== "בוטל");
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPickDay(d)}
              className={cn(
                "flex min-h-[5.5rem] flex-col gap-1 rounded-lg border p-1.5 text-start transition-colors",
                dayAppointments.length > 0
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
                {active.length > 0 && (
                  <span className="text-[9px] font-medium text-slate-400">{active.length} תורים</span>
                )}
              </span>
              {dayAppointments.length === 0 ? (
                inMonth && <span className="text-[9px] text-slate-300">אין תורים</span>
              ) : (
                <span className="flex flex-col gap-0.5">
                  {dayAppointments.slice(0, 3).map((a) => (
                    <span
                      key={a.id}
                      className={cn(
                        "flex items-center gap-1 truncate rounded border px-1 py-[1px] text-[9px] font-medium",
                        APPOINTMENT_STATUS_COLORS[a.status].chip
                      )}
                    >
                      <span dir="ltr" className="tabular-nums opacity-80">
                        {a.time}
                      </span>
                      <span className="truncate">{a.client_name}</span>
                    </span>
                  ))}
                  {dayAppointments.length > 3 && (
                    <span className="text-[9px] leading-none text-slate-400">
                      +{dayAppointments.length - 3} נוספים
                    </span>
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
