// The PATIENT-facing side of the same calendar surface the unit availability
// screen uses (src/lib/schedule-calendar.ts): where that one lays out a
// resource's recurring *availability*, this one lays out the concrete
// *appointments* booked into it — the provider's real working diary.
//
// The two share the geometry engine (packColumns / timeBounds / HOUR_PX) so a
// block at 09:00 lands on exactly the same pixel row in both, and a provider
// moving between "מתי אני פתוח" and "מי מגיע אליי" reads one visual language.
//
// What's different here: a block is a real event, not a template instance, so
// editing it changes THAT appointment only (never a weekly pattern), and the
// colour axis is the appointment STATUS rather than the מערך.
//
// Ownership (§PRV-10): exactly one calendar owns an event. A unit-owned
// appointment merely *delivered* by an affiliated doctor shows up in that
// doctor's own diary as a read-only reflection — visible so their day is
// honest, locked because rescheduling it belongs to the unit.
import { Appointment, AppointmentStatus, ScheduleShift, isCancelledAppointment } from "@/types";
import { isoDate } from "./calendar";
import { ScheduleHolder, minutesToTime, timeToMinutes } from "./schedule";
import { packColumns } from "./schedule-calendar";

// ---------------------------------------------------------------------------
// Status colours — the appointment calendar's colour axis
// ---------------------------------------------------------------------------
export interface StatusColor {
  /** legend dot / month bar */
  dot: string;
  /** month-cell chip */
  chip: string;
  /** time-grid block body */
  block: string;
  /** the block's leading accent rail */
  accent: string;
  /** selection / drag ring */
  ring: string;
}

// Same hues the rest of the app already uses for appointment status
// (APPOINTMENT_CHIP_TONE in lib/calendar.ts, APPOINTMENT_TONE in ui/Badge) —
// full static class strings, since Tailwind can't see composed names.
export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, StatusColor> = {
  // The referral queue is the one state that asks the UNIT to act, so it gets
  // its own hue rather than sharing "waiting for the patient" amber.
  "ממתין לאישור הפניה": {
    dot: "bg-indigo-500",
    chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
    block: "bg-indigo-50 border-indigo-200 text-indigo-900 hover:bg-indigo-100",
    accent: "bg-indigo-500",
    ring: "ring-indigo-500",
  },
  "ממתין להתחייבות": {
    dot: "bg-amber-400",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    block: "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100",
    accent: "bg-amber-400",
    ring: "ring-amber-400",
  },
  "ממתין לתשלום יתרה": {
    dot: "bg-orange-500",
    chip: "bg-orange-50 text-orange-700 border-orange-200",
    block: "bg-orange-50 border-orange-200 text-orange-900 hover:bg-orange-100",
    accent: "bg-orange-500",
    ring: "ring-orange-500",
  },
  "בוטל — יתרה לא שולמה": {
    dot: "bg-rose-400",
    chip: "bg-rose-50 text-rose-600 border-rose-200 line-through",
    block: "bg-rose-50/70 border-rose-200 text-rose-700 hover:bg-rose-100",
    accent: "bg-rose-400",
    ring: "ring-rose-400",
  },
  "ממתין לתשלום מקדמה": {
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    block: "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100",
    accent: "bg-amber-500",
    ring: "ring-amber-500",
  },
  "מאושר": {
    dot: "bg-blue-500",
    chip: "bg-blue-50 text-blue-700 border-blue-200",
    block: "bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100",
    accent: "bg-blue-500",
    ring: "ring-blue-500",
  },
  "שולם במלואו": {
    dot: "bg-purple-500",
    chip: "bg-purple-50 text-purple-700 border-purple-200",
    block: "bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100",
    accent: "bg-purple-500",
    ring: "ring-purple-500",
  },
  "בוצע": {
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    block: "bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100",
    accent: "bg-emerald-500",
    ring: "ring-emerald-500",
  },
  "בוטל": {
    dot: "bg-rose-400",
    chip: "bg-rose-50 text-rose-600 border-rose-200 line-through",
    block: "bg-rose-50/70 border-rose-200 text-rose-700 hover:bg-rose-100",
    accent: "bg-rose-400",
    ring: "ring-rose-400",
  },
};

// ---------------------------------------------------------------------------
// Lanes — the columns a day can be split into
// ---------------------------------------------------------------------------
/** A calendar "column identity" — one queue this provider's day is split into.
 *
 * For a unit that's an עמדה (MRI 1 / ד"ר כהן). For a solo provider it's one of
 * the two contexts they work in, which is exactly the distinction that has to
 * be obvious at a glance:
 *   • a מרפאה of their own — their queue, their hours, they manage it;
 *   • a יחידה they're affiliated with — the unit's queue, shown here so the day
 *     is honest, but read-only (`readOnly`). */
export interface ApptLane {
  id: string;
  name: string;
  subtitle?: string;
  kind: "facility" | "doctor" | "self" | "unit";
  /** A retired עמדה is never offered for new bookings, but still gets a column
   * on days where it already holds appointments — so nothing silently vanishes. */
  isActive: boolean;
  /** Another calendar owns this queue (a unit a solo provider works in): its
   * column is visible but accepts no bookings and no drops. */
  readOnly?: boolean;
  /** Services this lane can deliver — narrows the item picker when booking. */
  serviceIds: string[];
  /** §PRV-10 — the delivering person, for the cross-context conflict guard. */
  practitionerId?: string;
  arrayId?: string;
  arrayName?: string;
  branchId?: string;
  /** Where this lane's opened hours come from — the עמדה itself for a unit, the
   * provider's מרפאות for a solo diary. Read with shiftsForDate so date
   * exceptions are already applied. */
  scheduleHolders?: ScheduleHolder[];
}

/** Fallback lane for a solo provider with no locations recorded at all. */
export const SELF_LANE = "__self__";
/** Where appointments with no queue recorded land (a unit booking predating the
 * resource model, or an old booking with no clinic_id), so nothing is ever
 * silently dropped from the day. */
export const UNASSIGNED_LANE = "__unassigned__";

/** Which column an appointment belongs to.
 *
 * Unit  → the עמדה that serves it.
 * Solo  → the מרפאה it was booked at, or — when another calendar owns the event
 *         — the unit that owns it, so a unit's shift never reads as clinic work. */
export function laneIdForAppointment(
  a: Appointment,
  opts: { isUnit: boolean; ownerId: string; defaultLaneId?: string }
): string {
  if (opts.isUnit) return a.resource_id ?? UNASSIGNED_LANE;
  if (a.provider_id !== opts.ownerId) return a.provider_id ?? UNASSIGNED_LANE;
  return a.clinic_id ?? opts.defaultLaneId ?? UNASSIGNED_LANE;
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------
export interface ApptBlock {
  key: string;
  appt: Appointment;
  laneId: string;
  /** Display name of the lane — shown on the block when the column itself
   * isn't already a lane (i.e. in week view, where a column is a date). */
  laneName?: string;
  /** Tailwind class for the block's leading rail. The rail carries WHERE the
   * appointment happens (which מרפאה / יחידה / מערך) while the fill carries its
   * status — two independent questions, two independent channels. */
  railClass?: string;
  date: string; // yyyy-MM-dd
  startMin: number;
  endMin: number;
  status: AppointmentStatus;
  /** This calendar owns the event (vs. a read-only reflection of another
   * context's booking) — only an owner may reschedule or cancel. */
  owned: boolean;
  /** Grid-editable: owned, and not already cancelled. */
  editable: boolean;
  // Filled by packColumns:
  col: number;
  colCount: number;
}

export function buildApptBlocks(
  appointments: Appointment[],
  dates: Date[],
  opts: {
    ownerId: string;
    isUnit: boolean;
    laneNames?: Map<string, string>;
    /** Lane for an own-booking with no location recorded (a provider with a
     * single מרפאה — then it's unambiguous). */
    defaultLaneId?: string;
    railClassFor?: (laneId: string) => string | undefined;
  }
): ApptBlock[] {
  const wanted = new Set(dates.map(isoDate));
  const blocks: ApptBlock[] = [];
  for (const a of appointments) {
    if (!wanted.has(a.date)) continue;
    const startMin = timeToMinutes(a.time);
    // A zero/absent duration would render as an invisible sliver — floor it at
    // the slot granularity so every booking is clickable.
    const endMin = startMin + Math.max(15, a.duration_minutes || 0);
    const owned = a.provider_id === opts.ownerId;
    const laneId = laneIdForAppointment(a, {
      isUnit: opts.isUnit,
      ownerId: opts.ownerId,
      defaultLaneId: opts.defaultLaneId,
    });
    blocks.push({
      key: a.id,
      appt: a,
      laneId,
      laneName: opts.laneNames?.get(laneId),
      railClass: opts.railClassFor?.(laneId),
      date: a.date,
      startMin,
      endMin,
      status: a.status,
      owned,
      editable: owned && !isCancelledAppointment(a.status),
      col: 0,
      colCount: 1,
    });
  }
  return blocks;
}

/** Group blocks by grid column and column-pack each group, so overlapping
 * appointments in the same column sit side by side. */
export function groupAndPack(
  blocks: ApptBlock[],
  columnKeyOf: (b: ApptBlock) => string
): Map<string, ApptBlock[]> {
  const byColumn = new Map<string, ApptBlock[]>();
  for (const b of blocks) {
    const key = columnKeyOf(b);
    const arr = byColumn.get(key) ?? [];
    arr.push(b);
    byColumn.set(key, arr);
  }
  for (const [, arr] of byColumn) packColumns(arr);
  return byColumn;
}

// ---------------------------------------------------------------------------
// Conflicts
// ---------------------------------------------------------------------------
/** Where an appointment is being placed. `resourceId` is set for a unit (each
 * עמדה is its own queue); `contextId` is the owning provider for a solo diary. */
export interface ConflictTarget {
  contextId: string;
  resourceId?: string;
  /** §PRV-10 — the delivering person, if any. */
  practitionerId?: string;
  date: string;
  startMin: number;
  durationMin: number;
  excludeId?: string;
}

/** The appointment a placement would collide with, if any.
 *
 * Two independent axes, either of which is a real conflict:
 *   • the QUEUE — the same עמדה (unit) or the same diary (solo) is already busy;
 *   • the PERSON — the delivering human is booked in ANY other context at that
 *     time (their private clinic, another unit). Cancelled bookings never block. */
export function findApptConflict(
  appointments: Appointment[],
  target: ConflictTarget
): Appointment | undefined {
  const endMin = target.startMin + target.durationMin;
  return appointments.find((a) => {
    if (a.id === target.excludeId) return false;
    if (a.date !== target.date || isCancelledAppointment(a.status)) return false;
    const sameQueue = target.resourceId
      ? a.resource_id === target.resourceId
      : a.provider_id === target.contextId && !a.resource_id;
    const samePerson = !!target.practitionerId && a.practitioner_id === target.practitionerId;
    if (!sameQueue && !samePerson) return false;
    const otherStart = timeToMinutes(a.time);
    const otherEnd = otherStart + Math.max(15, a.duration_minutes || 0);
    return target.startMin < otherEnd && otherStart < endMin;
  });
}

/** A one-line, human explanation of a collision, for the toast that rejects a
 * drag or a booking. */
export function conflictMessage(conflict: Appointment, target: ConflictTarget): string {
  const person = !!target.practitionerId && conflict.practitioner_id === target.practitionerId;
  const sameQueue = target.resourceId
    ? conflict.resource_id === target.resourceId
    : conflict.provider_id === target.contextId;
  const who = `${conflict.client_name} · ${conflict.time}`;
  if (!sameQueue && person) return `נותן/ת השירות כבר משובץ/ת בהקשר אחר בשעה זו (${who}).`;
  return `קיים תור חופף בשעה זו (${who}).`;
}

// ---------------------------------------------------------------------------
// Open hours — the shifts the provider opened, drawn UNDER the appointments
// ---------------------------------------------------------------------------
// The diary is only readable if you can see the frame it sits in: which hours
// were opened for booking, where the breaks are, and which appointments fell
// outside all of it. These turn the availability model (weekly shifts + date
// exceptions, resolved by shiftsForDate) into plain painted bands.
export interface OpenBand {
  startMin: number;
  endMin: number;
  /** The shift's own label ("משמרת בוקר") — only kept for a single-lane column,
   * since a merged band belongs to several lanes at once. */
  label?: string;
  breaks?: { startMin: number; endMin: number; label?: string }[];
}

export function bandsForShifts(shifts: ScheduleShift[]): OpenBand[] {
  return shifts
    .map((s) => ({
      startMin: timeToMinutes(s.start),
      endMin: timeToMinutes(s.end),
      label: s.label,
      breaks: (s.breaks ?? []).map((b) => ({
        startMin: timeToMinutes(b.start),
        endMin: timeToMinutes(b.end),
        label: b.label,
      })),
    }))
    .sort((a, b) => a.startMin - b.startMin);
}

/** Union of overlapping bands — used when one column shows several lanes at
 * once (a week column, or a solo provider with two clinics open in parallel):
 * the column is "open" if ANY lane is. Labels and breaks are dropped on merge,
 * because they belong to one lane and would be a lie for the union. */
export function mergeBands(bands: OpenBand[]): OpenBand[] {
  const sorted = [...bands].sort((a, b) => a.startMin - b.startMin);
  const out: OpenBand[] = [];
  for (const band of sorted) {
    const last = out[out.length - 1];
    if (last && band.startMin <= last.endMin) {
      if (band.endMin > last.endMin) last.endMin = band.endMin;
      // Two lanes merged into one band — no single label/breaks apply anymore.
      last.label = undefined;
      last.breaks = undefined;
    } else {
      out.push({ ...band, breaks: band.breaks ? [...band.breaks] : undefined });
    }
  }
  return out;
}

/** True when [startMin, endMin) fits inside a single open band (breaks are not
 * treated as closed — a booking that spans a coffee break is a scheduling
 * choice, not an error). */
export function isInsideBands(bands: OpenBand[], startMin: number, endMin: number): boolean {
  return bands.some((b) => startMin >= b.startMin && endMin <= b.endMin);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
export function timeRangeLabel(startMin: number, endMin: number): string {
  return `${minutesToTime(startMin)}–${minutesToTime(endMin)}`;
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} דק׳`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} שע׳` : `${h}:${String(m).padStart(2, "0")} שע׳`;
}
