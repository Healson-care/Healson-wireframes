// Calendar geometry + color model for the unit availability calendar
// (/provider/profile/availability). This module is pure: it turns the unit's
// resources (עמדות) and their weekly schedules into the concrete, dated,
// laid-out blocks the time-grid renders, and back — it never touches the store.
//
// The availability model is a RECURRING WEEKLY TEMPLATE (WeeklySchedule =
// shifts per weekday) per resource, plus one-off date exceptions. So a block on
// "Tuesday the 14th" is really an instance of the schedule's Tuesday shift —
// editing it edits every Tuesday. Blocks that come from a date exception (a
// closed day / special hours) or from a resource that follows a shared לו״ז are
// shown for an honest timeline but are not grid-editable (origin/editable
// below); those are edited in their dedicated surfaces.
import { DayKey, ScheduleShift, WeeklySchedule, emptyWeeklySchedule } from "@/types";
import { UnitResource } from "@/lib/unit-resources";
import {
  DAY_KEYS,
  dayKeyForDate,
  findException,
  minutesToTime,
  shiftsForDate,
  timeToMinutes,
  validateDayShifts,
} from "@/lib/schedule";
import { addDays, isoDate } from "@/lib/calendar";

// ---------------------------------------------------------------------------
// Department (מערך) colour palette
// ---------------------------------------------------------------------------
// Keyed by position so a מערך keeps the same colour across the legend, the
// time-grid blocks and the month coverage bars. Every class is a full static
// string (Tailwind can't see dynamically-built class names).
export interface DeptColor {
  /** legend / month bar dot */
  dot: string;
  /** month coverage bar */
  bar: string;
  /** day-detail time chip */
  chip: string;
  /** time-grid block body */
  block: string;
  /** the block's leading accent rail */
  accent: string;
  /** selection ring for a picked block */
  ring: string;
}

export const DEPARTMENT_COLORS: DeptColor[] = [
  {
    dot: "bg-sky-500",
    bar: "bg-sky-400",
    chip: "bg-sky-50 text-sky-700 border-sky-200",
    block: "bg-sky-50 border-sky-200 text-sky-900 hover:bg-sky-100",
    accent: "bg-sky-500",
    ring: "ring-sky-500",
  },
  {
    dot: "bg-violet-500",
    bar: "bg-violet-400",
    chip: "bg-violet-50 text-violet-700 border-violet-200",
    block: "bg-violet-50 border-violet-200 text-violet-900 hover:bg-violet-100",
    accent: "bg-violet-500",
    ring: "ring-violet-500",
  },
  {
    dot: "bg-amber-500",
    bar: "bg-amber-400",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    block: "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100",
    accent: "bg-amber-500",
    ring: "ring-amber-500",
  },
  {
    dot: "bg-emerald-500",
    bar: "bg-emerald-400",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    block: "bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100",
    accent: "bg-emerald-500",
    ring: "ring-emerald-500",
  },
  {
    dot: "bg-rose-500",
    bar: "bg-rose-400",
    chip: "bg-rose-50 text-rose-700 border-rose-200",
    block: "bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100",
    accent: "bg-rose-500",
    ring: "ring-rose-500",
  },
  {
    dot: "bg-teal-500",
    bar: "bg-teal-400",
    chip: "bg-teal-50 text-teal-700 border-teal-200",
    block: "bg-teal-50 border-teal-200 text-teal-900 hover:bg-teal-100",
    accent: "bg-teal-500",
    ring: "ring-teal-500",
  },
  {
    dot: "bg-indigo-500",
    bar: "bg-indigo-400",
    chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
    block: "bg-indigo-50 border-indigo-200 text-indigo-900 hover:bg-indigo-100",
    accent: "bg-indigo-500",
    ring: "ring-indigo-500",
  },
  {
    dot: "bg-fuchsia-500",
    bar: "bg-fuchsia-400",
    chip: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    block: "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-900 hover:bg-fuchsia-100",
    accent: "bg-fuchsia-500",
    ring: "ring-fuchsia-500",
  },
  {
    dot: "bg-cyan-500",
    bar: "bg-cyan-400",
    chip: "bg-cyan-50 text-cyan-700 border-cyan-200",
    block: "bg-cyan-50 border-cyan-200 text-cyan-900 hover:bg-cyan-100",
    accent: "bg-cyan-500",
    ring: "ring-cyan-500",
  },
  {
    dot: "bg-lime-500",
    bar: "bg-lime-400",
    chip: "bg-lime-50 text-lime-700 border-lime-200",
    block: "bg-lime-50 border-lime-200 text-lime-900 hover:bg-lime-100",
    accent: "bg-lime-500",
    ring: "ring-lime-500",
  },
];

export const NO_DEPARTMENT_COLOR: DeptColor = {
  dot: "bg-slate-400",
  bar: "bg-slate-300",
  chip: "bg-slate-50 text-slate-600 border-slate-200",
  block: "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100",
  accent: "bg-slate-400",
  ring: "ring-slate-500",
};

/** Sentinel department id for resources not linked to any מערך. */
export const NO_DEPT = "__none__";

/** Stable colour for a department, by its position in the ordered dept list. */
export function deptColor(deptId: string | undefined, order: string[]): DeptColor {
  if (!deptId || deptId === NO_DEPT) return NO_DEPARTMENT_COLOR;
  const i = order.indexOf(deptId);
  return i < 0 ? NO_DEPARTMENT_COLOR : DEPARTMENT_COLORS[i % DEPARTMENT_COLORS.length];
}

// ---------------------------------------------------------------------------
// Lanes — a resource flattened for the calendar
// ---------------------------------------------------------------------------
export interface CalendarLane extends UnitResource {
  /** A lane is grid-editable only when it owns its schedule inline (no shared
   * לו״ז). Shared-לו״ז lanes are shown but edited in the shared tab. */
  editable: boolean;
}

export function toLanes(resources: UnitResource[]): CalendarLane[] {
  return resources.map((r) => ({ ...r, editable: !r.schedule_id }));
}

// ---------------------------------------------------------------------------
// View range
// ---------------------------------------------------------------------------
export type CalendarView = "day" | "week" | "month";

export const VIEW_LABELS: Record<CalendarView, string> = {
  day: "יום",
  week: "שבוע",
  month: "חודש",
};

/** First day (Sunday) of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -d.getDay());
}

/** The concrete dates a day/week view spans (month uses monthGridDays). */
export function rangeDays(view: CalendarView, anchor: Date): Date[] {
  if (view === "day") return [new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())];
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function shiftAnchor(view: CalendarView, anchor: Date, dir: 1 | -1): Date {
  if (view === "day") return addDays(anchor, dir);
  if (view === "week") return addDays(anchor, dir * 7);
  return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
}

/** Header label for the current range. */
export function rangeLabel(view: CalendarView, anchor: Date): string {
  if (view === "month") return anchor.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
  if (view === "day")
    return anchor.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
  const days = rangeDays("week", anchor);
  const a = days[0];
  const b = days[6];
  const sameMonth = a.getMonth() === b.getMonth();
  const left = a.toLocaleDateString("he-IL", { day: "numeric", month: sameMonth ? undefined : "short" });
  const right = b.toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
  return `${left} – ${right}`;
}

// ---------------------------------------------------------------------------
// Blocks — a dated, laid-out instance of a shift
// ---------------------------------------------------------------------------
export interface CalendarBlock {
  /** Unique per render. */
  key: string;
  laneId: string;
  laneName: string;
  laneKind: "facility" | "doctor";
  deptId: string; // NO_DEPT when unassigned
  deptName: string;
  date: string; // yyyy-MM-dd
  dayKey: DayKey;
  shift: ScheduleShift;
  startMin: number;
  endMin: number;
  origin: "weekly" | "exception";
  /** Weekly-origin block on an inline lane — the only kind the grid can edit. */
  editable: boolean;
  // Filled by packColumns:
  col: number;
  colCount: number;
}

/** Build every block a set of lanes contributes across the given dates. */
export function buildBlocks(lanes: CalendarLane[], dates: Date[]): CalendarBlock[] {
  const blocks: CalendarBlock[] = [];
  for (const date of dates) {
    const iso = isoDate(date);
    const dayKey = dayKeyForDate(date);
    for (const lane of lanes) {
      const exception = findException(lane, iso);
      const origin: "weekly" | "exception" = exception ? "exception" : "weekly";
      const shifts = shiftsForDate(lane, iso);
      for (const shift of shifts) {
        blocks.push({
          key: `${lane.id}__${iso}__${shift.id}`,
          laneId: lane.id,
          laneName: lane.name,
          laneKind: lane.kind,
          deptId: lane.service_array_id ?? NO_DEPT,
          deptName: lane.service_array ?? "ללא מערך",
          date: iso,
          dayKey,
          shift,
          startMin: timeToMinutes(shift.start),
          endMin: timeToMinutes(shift.end),
          origin,
          editable: lane.editable && origin === "weekly",
          col: 0,
          colCount: 1,
        });
      }
    }
  }
  return blocks;
}

/** The minimum shape column packing needs — availability blocks and the
 * appointment calendar's blocks (src/lib/appointment-calendar.ts) both satisfy
 * it, so the two calendars share one layout engine. */
export interface PackableBlock {
  startMin: number;
  endMin: number;
  col: number;
  colCount: number;
}

/** Greedy interval-graph column packing so overlapping blocks on one day sit
 * side by side (a shared timeline where parallel capacity reads at a glance).
 * Mutates and returns the same block objects with col/colCount set. */
export function packColumns<T extends PackableBlock>(dayBlocks: T[]): T[] {
  const sorted = [...dayBlocks].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  let cluster: T[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const colEnds: number[] = [];
    for (const it of cluster) {
      let placed = false;
      for (let c = 0; c < colEnds.length; c++) {
        if (it.startMin >= colEnds[c]) {
          it.col = c;
          colEnds[c] = it.endMin;
          placed = true;
          break;
        }
      }
      if (!placed) {
        it.col = colEnds.length;
        colEnds.push(it.endMin);
      }
    }
    const count = Math.max(1, colEnds.length);
    for (const it of cluster) it.colCount = count;
    cluster = [];
  };

  for (const it of sorted) {
    if (cluster.length > 0 && it.startMin >= clusterEnd) flush();
    clusterEnd = cluster.length === 0 ? it.endMin : Math.max(clusterEnd, it.endMin);
    cluster.push(it);
  }
  flush();
  return sorted;
}

/** Blocks grouped by date, each group column-packed. */
export function layoutByDate(blocks: CalendarBlock[]): Map<string, CalendarBlock[]> {
  const byDate = new Map<string, CalendarBlock[]>();
  for (const b of blocks) {
    const arr = byDate.get(b.date) ?? [];
    arr.push(b);
    byDate.set(b.date, arr);
  }
  for (const [, arr] of byDate) packColumns(arr);
  return byDate;
}

// ---------------------------------------------------------------------------
// Time-axis bounds
// ---------------------------------------------------------------------------
export const DEFAULT_DAY_START_HOUR = 7;
export const DEFAULT_DAY_END_HOUR = 20;
export const HOUR_PX = 56;
export const SNAP_MIN = 15;
export const MIN_BLOCK_MIN = 15;

/** Hour window to render: the default working window, expanded to include any
 * block that falls outside it, clamped to [0, 24]. */
export function timeBounds(blocks: { startMin: number; endMin: number }[]): {
  startMin: number;
  endMin: number;
} {
  let startHour = DEFAULT_DAY_START_HOUR;
  let endHour = DEFAULT_DAY_END_HOUR;
  for (const b of blocks) {
    startHour = Math.min(startHour, Math.floor(b.startMin / 60));
    endHour = Math.max(endHour, Math.ceil(b.endMin / 60));
  }
  return { startMin: Math.max(0, startHour) * 60, endMin: Math.min(24, endHour) * 60 };
}

export function snap(min: number, step = SNAP_MIN): number {
  return Math.round(min / step) * step;
}

export function clampMin(min: number, lo = 0, hi = 24 * 60): number {
  return Math.max(lo, Math.min(hi, min));
}

export function formatMin(min: number): string {
  return minutesToTime(clampMin(min));
}

// ---------------------------------------------------------------------------
// Weekly-schedule edits (pure) — the grid produces a new WeeklySchedule, the
// caller persists it against the right lane record.
// ---------------------------------------------------------------------------
export type ScheduleMutation =
  | { ok: true; schedule: WeeklySchedule }
  | { ok: false; error: string };

export function addShiftToDay(weekly: WeeklySchedule, dayKey: DayKey, shift: ScheduleShift): WeeklySchedule {
  const next = { ...weekly };
  next[dayKey] = [...(weekly[dayKey] ?? []), shift].sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
  );
  return next;
}

export function replaceShiftInDay(
  weekly: WeeklySchedule,
  dayKey: DayKey,
  shift: ScheduleShift
): WeeklySchedule {
  const next = { ...weekly };
  next[dayKey] = (weekly[dayKey] ?? [])
    .map((s) => (s.id === shift.id ? shift : s))
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  return next;
}

export function removeShiftFromDay(weekly: WeeklySchedule, dayKey: DayKey, shiftId: string): WeeklySchedule {
  const next = { ...weekly };
  next[dayKey] = (weekly[dayKey] ?? []).filter((s) => s.id !== shiftId);
  return next;
}

/** Move a shift by `deltaMin` and/or to another weekday. Returns the new
 * schedule, or an error string when the result would be invalid (overlap /
 * inverted range) so the caller can reject the drag and revert. */
export function moveShift(
  weekly: WeeklySchedule,
  fromDay: DayKey,
  toDay: DayKey,
  shift: ScheduleShift,
  deltaMin: number
): ScheduleMutation {
  const start = clampMin(timeToMinutes(shift.start) + deltaMin);
  const dur = timeToMinutes(shift.end) - timeToMinutes(shift.start);
  const end = clampMin(start + dur);
  const moved: ScheduleShift = { ...shift, start: minutesToTime(start), end: minutesToTime(end) };
  let next = removeShiftFromDay(weekly, fromDay, shift.id);
  next = addShiftToDay(next, toDay, moved);
  const problem = validateDayShifts(next[toDay] ?? []);
  if (problem) return { ok: false, error: problem };
  return { ok: true, schedule: next };
}

/** Resize a shift's end (keeps start), enforcing a minimum length. */
export function resizeShiftEnd(
  weekly: WeeklySchedule,
  dayKey: DayKey,
  shift: ScheduleShift,
  newEndMin: number
): ScheduleMutation {
  const start = timeToMinutes(shift.start);
  const end = clampMin(Math.max(newEndMin, start + MIN_BLOCK_MIN));
  const resized: ScheduleShift = { ...shift, end: minutesToTime(end) };
  const next = replaceShiftInDay(weekly, dayKey, resized);
  const problem = validateDayShifts(next[dayKey] ?? []);
  if (problem) return { ok: false, error: problem };
  return { ok: true, schedule: next };
}

export { emptyWeeklySchedule, DAY_KEYS };
