"use client";

import { useMemo, useState } from "react";
import { BellRing, Clock } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { buildMonth, MonthDay } from "@/lib/scheduling";
import { cn } from "@/lib/utils";
import { Appointment, ProviderProfile } from "@/types";

const WEEKDAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const MAX_MONTHS_AHEAD = 2;

function dayStatus(day: MonthDay): "available" | "full" | "none" {
  if (day.isPast || day.slots.length === 0) return "none";
  return day.slots.some((s) => s.available) ? "available" : "full";
}

export function SlotPicker({
  provider,
  appointments,
  onSelectSlot,
  onJoinWaitlist,
}: {
  provider: ProviderProfile;
  appointments: Appointment[];
  onSelectSlot: (date: string, time: string, label: string) => void;
  // date/time/label are omitted for a general "any time works" request.
  onJoinWaitlist: (date?: string, time?: string, label?: string) => void;
}) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pendingSlot, setPendingSlot] = useState<{ date: string; time: string; label: string } | null>(null);

  const monthDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const monthDays = useMemo(() => buildMonth(provider, appointments, monthDate), [provider, appointments, monthDate]);

  // Naturally resets when the month changes — a selected date string from a
  // different month simply won't match anything in this month's day list.
  const selectedDay = monthDays.find((d) => d.date === selectedDate) ?? null;

  function dateLabel(date: string) {
    return new Date(date).toLocaleDateString("he-IL", { weekday: "long", day: "2-digit", month: "2-digit" });
  }

  const leadingBlanks = monthDays.length > 0 ? monthDays[0].weekday : 0;

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">בחרו תאריך ושעה</h2>
        <p className="text-slate-500 text-sm mt-1">
          זמינות אצל {provider.title} {provider.display_name}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="sm" onClick={() => setMonthOffset((o) => o - 1)} disabled={monthOffset === 0}>
            חודש קודם
          </Button>
          <span className="text-sm font-semibold text-slate-800">
            {monthDate.toLocaleDateString("he-IL", { month: "long", year: "numeric" })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonthOffset((o) => o + 1)}
            disabled={monthOffset >= MAX_MONTHS_AHEAD}
          >
            חודש הבא
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="text-center text-[11px] font-medium text-slate-400">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {monthDays.map((day) => {
            const status = dayStatus(day);
            const isSelected = selectedDate === day.date;
            return (
              <button
                key={day.date}
                disabled={status === "none"}
                onClick={() => setSelectedDate(day.date)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-sm font-medium transition-colors",
                  status === "none" && "text-slate-300 cursor-default",
                  status !== "none" && !isSelected && "text-slate-700 hover:bg-slate-100",
                  isSelected && "bg-primary text-white"
                )}
              >
                {day.dayOfMonth}
                {status !== "none" && (
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      status === "available" && (isSelected ? "bg-white" : "bg-emerald-500"),
                      status === "full" && (isSelected ? "bg-white/60" : "bg-slate-300")
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 mt-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> יש תורים פנויים
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-300" /> כל התורים תפוסים
          </span>
        </div>
      </div>

      <button
        onClick={() => onJoinWaitlist()}
        className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <BellRing className="h-3.5 w-3.5" /> לא מצאתם שעה מתאימה? הצטרפות כללית לרשימת המתנה
      </button>

      <div className="mt-5">
        {!selectedDay ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-400">
            בחרו תאריך בלוח למעלה כדי לראות שעות פנויות
          </div>
        ) : selectedDay.slots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-400">
            אין זמינות ביום זה — נסו לבחור תאריך אחר
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {selectedDay.slots.map((slot) =>
              slot.available ? (
                <button
                  key={slot.time}
                  onClick={() => setPendingSlot({ date: selectedDay.date, time: slot.time, label: dateLabel(selectedDay.date) })}
                  className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4" /> {slot.time}
                  </span>
                  <span className="text-xs font-normal opacity-70">לקביעת תור</span>
                </button>
              ) : (
                <button
                  key={slot.time}
                  onClick={() => onJoinWaitlist(selectedDay.date, slot.time, dateLabel(selectedDay.date))}
                  title="הצטרפות לרשימת המתנה עבור מועד זה"
                  className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-400 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                >
                  <span className="flex items-center gap-2 line-through decoration-slate-300 group-hover:no-underline">
                    <Clock className="h-4 w-4" /> {slot.time}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-normal">
                    <BellRing className="h-3.5 w-3.5" /> הצטרפות לרשימת המתנה
                  </span>
                </button>
              )
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingSlot}
        onClose={() => setPendingSlot(null)}
        title="אישור קביעת תור"
        description={pendingSlot ? `לקבוע תור ב-${pendingSlot.label} בשעה ${pendingSlot.time}?` : undefined}
        confirmLabel="כן, קבע תור"
        onConfirm={() => {
          if (pendingSlot) onSelectSlot(pendingSlot.date, pendingSlot.time, pendingSlot.label);
        }}
      />
    </div>
  );
}
