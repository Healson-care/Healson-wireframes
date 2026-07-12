"use client";

import { Clock } from "lucide-react";
import { DaySlots } from "@/lib/scheduling";
import { ProviderProfile } from "@/types";

export function SlotPicker({
  provider,
  days,
  activeDayIdx,
  onDayChange,
  onSelectSlot,
  onJoinWaitlist,
}: {
  provider: ProviderProfile;
  days: DaySlots[];
  activeDayIdx: number;
  onDayChange: (idx: number) => void;
  onSelectSlot: (date: string, time: string, label: string) => void;
  onJoinWaitlist: (date: string, time: string, label: string) => void;
}) {
  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">בחרו תאריך ושעה</h2>
        <p className="text-slate-500 text-sm mt-1">
          זמינות אצל {provider.title} {provider.display_name}
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {days.map((d, i) => (
          <button
            key={d.date}
            onClick={() => onDayChange(i)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeDayIdx === i ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
      {days[activeDayIdx].slots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-400">
          אין זמינות ביום זה — נסו לבחור תאריך אחר
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {days[activeDayIdx].slots.map((slot) =>
            slot.available ? (
              <button
                key={slot.time}
                onClick={() => onSelectSlot(days[activeDayIdx].date, slot.time, days[activeDayIdx].label)}
                className="rounded-xl border px-3 py-2.5 text-sm font-medium transition-all border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:-translate-y-0.5"
              >
                {slot.time}
              </button>
            ) : (
              <button
                key={slot.time}
                onClick={() => onJoinWaitlist(days[activeDayIdx].date, slot.time, days[activeDayIdx].label)}
                title="הצטרפות לרשימת המתנה עבור מועד זה"
                className="group flex flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-400 transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                <span className="line-through decoration-slate-300 group-hover:no-underline">{slot.time}</span>
                <span className="flex items-center gap-1 text-[9px] font-normal opacity-0 group-hover:opacity-100">
                  <Clock className="h-2.5 w-2.5" /> הצטרפות להמתנה
                </span>
              </button>
            )
          )}
        </div>
      )}
      <div className="flex items-center gap-3 mt-5 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-emerald-100 border border-emerald-200" /> פנוי
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-slate-100 border border-slate-200" /> תפוס · לחצו להצטרפות לרשימת המתנה
        </span>
      </div>
    </div>
  );
}
