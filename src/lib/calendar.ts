// Shared month-grid math + appointment status colors for the admin calendar
// views (general /appointments board and the per-patient chart's תורים tab)
// so both stay visually and behaviorally in sync.

import { Appointment } from "@/types";

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

export function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Full weeks (multiples of 7) covering the given month, including the
 * leading/trailing days of adjacent months needed to fill the grid. */
export function monthGridDays(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const gridStart = addDays(first, -startWeekday);
  return Array.from({ length: totalCells }, (_, i) => addDays(gridStart, i));
}

export const WEEKDAY_LABELS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export const APPOINTMENT_CHIP_TONE: Record<string, string> = {
  "ממתין לאישור הפניה": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "ממתין לקביעת מועד": "bg-teal-50 text-teal-700 border-teal-200",
  "ממתין להתחייבות": "bg-amber-50 text-amber-700 border-amber-200",
  "ממתין לתשלום מקדמה": "bg-amber-50 text-amber-700 border-amber-200",
  "מאושר": "bg-blue-50 text-blue-700 border-blue-200",
  "ממתין לתשלום יתרה": "bg-orange-50 text-orange-700 border-orange-200",
  "שולם במלואו": "bg-purple-50 text-purple-700 border-purple-200",
  "בוצע": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "בוטל": "bg-rose-50 text-rose-700 border-rose-200 line-through",
  "בוטל — יתרה לא שולמה": "bg-rose-50 text-rose-700 border-rose-200 line-through",
};

// ---------------------------------------------------------------------------
// Scheduling-conflict detection — used by the "new appointment" forms to warn
// when a provider is already booked at the requested time, and to suggest
// the next open slot that day.
// ---------------------------------------------------------------------------
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** The other appointment a new booking would overlap with for the same
 * provider on the same day, if any ("בוטל" appointments don't block).
 * Pass `excludeId` when checking an appointment being edited, so it doesn't
 * conflict with itself. */
export function findSchedulingConflict(
  appointments: Appointment[],
  providerId: string,
  date: string,
  time: string,
  durationMinutes: number,
  excludeId?: string,
  // §PRV-10 — when the booking is delivered by a person, pass their
  // ProviderProfile id so an overlap in ANY other context (their private
  // clinic, another unit) is also flagged, not just within this provider's
  // calendar.
  practitionerId?: string
): Appointment | undefined {
  if (!providerId || !date || !time) return undefined;
  const newStart = timeToMinutes(time);
  const newEnd = newStart + durationMinutes;
  return appointments.find((a) => {
    if (a.id === excludeId) return false;
    if (a.date !== date || a.status === "בוטל") return false;
    const sameContext = a.provider_id === providerId;
    const samePerson = !!practitionerId && a.practitioner_id === practitionerId;
    if (!sameContext && !samePerson) return false;
    const existingStart = timeToMinutes(a.time);
    const existingEnd = existingStart + a.duration_minutes;
    return newStart < existingEnd && existingStart < newEnd;
  });
}

const WORKDAY_START_MIN = 8 * 60;
const WORKDAY_END_MIN = 19 * 60;
const SLOT_STEP_MIN = 15;

/** First free slot for this provider, at or after the requested time,
 * within a standard 08:00–19:00 workday. */
export function suggestNextFreeSlot(
  appointments: Appointment[],
  providerId: string,
  date: string,
  time: string,
  durationMinutes: number,
  excludeId?: string
): string | undefined {
  let candidate = Math.max(timeToMinutes(time), WORKDAY_START_MIN);
  while (candidate + durationMinutes <= WORKDAY_END_MIN) {
    const candidateTime = minutesToTime(candidate);
    if (!findSchedulingConflict(appointments, providerId, date, candidateTime, durationMinutes, excludeId)) {
      return candidateTime;
    }
    candidate += SLOT_STEP_MIN;
  }
  return undefined;
}
