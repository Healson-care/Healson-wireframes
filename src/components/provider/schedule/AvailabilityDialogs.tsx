"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { DAY_LABELS } from "@/lib/medical-tree";
import { ShiftForm, newShift } from "@/components/provider/AvailabilitySection";
import { DAY_KEYS, dayKeyForDate, getWeeklySchedule } from "@/lib/schedule";
import { ConsultationType, DayKey, ScheduleShift } from "@/types";
import { CalendarBlock, CalendarLane, formatMin } from "@/lib/schedule-calendar";

/** The create/edit shift dialogs behind every availability calendar — a unit's
 * עמדות and a solo provider's מרפאות edit the same WeeklySchedule shape, so they
 * share one pair of dialogs and only the noun changes (`laneLabel`). */
export function CreateAvailabilityDialog({
  open,
  state,
  lanes,
  services,
  laneLabel,
  defaultLaneId,
  onClose,
  onCreate,
}: {
  open: boolean;
  state: { date: Date; startMin: number } | null;
  lanes: CalendarLane[];
  services: ConsultationType[];
  laneLabel: string;
  defaultLaneId?: string;
  onClose: () => void;
  onCreate: (laneId: string, dayKey: DayKey, shift: ScheduleShift) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="הוספת זמינות" className="max-w-lg">
      {state && (
        <CreateBody
          state={state}
          lanes={lanes}
          services={services}
          laneLabel={laneLabel}
          defaultLaneId={defaultLaneId}
          onCreate={onCreate}
        />
      )}
    </Dialog>
  );
}

function CreateBody({
  state,
  lanes,
  services,
  laneLabel,
  defaultLaneId,
  onCreate,
}: {
  state: { date: Date; startMin: number };
  lanes: CalendarLane[];
  services: ConsultationType[];
  laneLabel: string;
  defaultLaneId?: string;
  onCreate: (laneId: string, dayKey: DayKey, shift: ScheduleShift) => void;
}) {
  const initialLane = (defaultLaneId && lanes.find((l) => l.id === defaultLaneId)?.id) || lanes[0]?.id || "";
  const [laneId, setLaneId] = useState(initialLane);
  const [dayKey, setDayKey] = useState<DayKey>(dayKeyForDate(state.date));

  const lane = lanes.find((l) => l.id === laneId);
  const existing = lane ? getWeeklySchedule(lane)[dayKey] ?? [] : [];
  const base = newShift(existing);
  // Seed the clicked start time — the calendar's whole point is that where you
  // click is where the shift begins.
  const initial: ScheduleShift = {
    ...base,
    start: formatMin(state.startMin),
    end: formatMin(state.startMin + 60),
  };
  const laneServices = lane ? services.filter((s) => lane.service_ids.includes(s.id)) : services;

  if (lanes.length === 0) {
    return (
      <p className="rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-text">
        אין {laneLabel} עם לו״ז עצמאי להוספת זמינות. {laneLabel} העוקבות אחרי לו״ז משותף נערכות בלשונית ‚לו״זים
        משותפים‘.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {lanes.length > 1 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">{laneLabel}</span>
            <select
              value={laneId}
              onChange={(e) => setLaneId(e.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {lanes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.service_array ? ` · ${l.service_array}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">יום בשבוע</span>
          <select
            value={dayKey}
            onChange={(e) => setDayKey(e.target.value as DayKey)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {DAY_KEYS.map((d) => (
              <option key={d} value={d}>
                {DAY_LABELS[d]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="rounded-lg bg-info-bg px-3 py-2 text-xs leading-relaxed text-info-text">
        הזמינות תתווסף לכל יום {DAY_LABELS[dayKey]} בלו״ז (תבנית שבועית חוזרת). ליום בודד — השתמשו בחריגת תאריך.
      </p>

      <ShiftForm
        key={`${laneId}-${dayKey}`}
        initial={initial}
        services={laneServices}
        serviceScopeLabel={`כל הפריטים של ה${laneLabel}`}
        saveLabel="הוספת זמינות"
        onSave={(shift) => onCreate(laneId, dayKey, shift)}
      />
    </div>
  );
}

export function EditAvailabilityDialog({
  block,
  services,
  laneLabel,
  onClose,
  onSave,
  onDelete,
}: {
  block: CalendarBlock | null;
  services: ConsultationType[];
  laneLabel: string;
  onClose: () => void;
  onSave: (shift: ScheduleShift) => void;
  onDelete: () => void;
}) {
  return (
    <Dialog open={!!block} onClose={onClose} title="עריכת זמינות" className="max-w-lg">
      {block && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-slate-800">{block.laneName}</p>
              <p className="text-xs text-slate-500">
                {block.deptName} · כל יום {DAY_LABELS[block.dayKey]}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-danger hover:bg-danger-bg">
              <Trash2 className="h-4 w-4" /> מחיקה
            </Button>
          </div>
          <ShiftForm
            key={block.key}
            initial={block.shift}
            services={services}
            serviceScopeLabel={`כל הפריטים של ה${laneLabel}`}
            saveLabel="שמירת שינויים"
            onSave={onSave}
          />
        </div>
      )}
    </Dialog>
  );
}
