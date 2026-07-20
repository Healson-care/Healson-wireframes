// Availability engine (§PRV-05) — the single place that knows how a
// location's week turns into bookable times.
//
// Everything reads a location's availability through `getWeeklySchedule()`
// rather than touching `Clinic.hours` directly: `hours` is the legacy
// one-range-per-day shape still present in seed data and in already-persisted
// localStorage stores, and is transparently up-converted here into the real
// shift-based model (multiple shifts per day, mid-shift breaks, per-shift slot
// length, per-shift service scoping, per-date exceptions).
//
// Nothing here is location-specific any more: a medical unit's מתקן (MRI 1) and
// its affiliated doctors each keep a week of their own in exactly the same
// shape, so every function below takes a `ScheduleHolder` — anything carrying a
// `schedule`/`schedule_exceptions` pair. `Clinic`, `ProviderFacility` and
// `AffiliatedDoctor` all satisfy it structurally.
import {
  ClinicHours,
  DayKey,
  DEFAULT_SLOT_MINUTES,
  ScheduleException,
  ScheduleShift,
  WeeklySchedule,
  emptyWeeklySchedule,
} from "@/types";

/** Anything that owns a weekly schedule: a location, a facility, a doctor. */
export interface ScheduleHolder {
  id: string;
  schedule?: WeeklySchedule;
  schedule_exceptions?: ScheduleException[];
  /** @deprecated legacy Clinic-only single-range-per-day hours */
  hours?: ClinicHours;
}

export const DAY_KEYS: DayKey[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, minutes));
  const h = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const m = (clamped % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function dayKeyForDate(date: Date): DayKey {
  return DAY_KEYS[date.getDay()];
}

/** The location's weekly shifts — from `schedule` when present, otherwise
 * derived from the legacy `hours` record (one shift per open day). */
export function getWeeklySchedule(clinic?: ScheduleHolder): WeeklySchedule {
  if (!clinic) return emptyWeeklySchedule();
  if (clinic.schedule) {
    // Guard against a partially-shaped object persisted by an older build.
    const schedule = emptyWeeklySchedule();
    DAY_KEYS.forEach((d) => {
      schedule[d] = clinic.schedule?.[d] ?? [];
    });
    return schedule;
  }
  const schedule = emptyWeeklySchedule();
  DAY_KEYS.forEach((d) => {
    const range = clinic.hours?.[d];
    if (range) {
      schedule[d] = [{ id: `${clinic.id}_${d}_legacy`, start: range[0], end: range[1] }];
    }
  });
  return schedule;
}

/** Mirror of a schedule in the legacy `hours` shape (earliest start → latest
 * end per day), kept in sync on every save so any screen still reading
 * `Clinic.hours` keeps showing something truthful. */
export function scheduleToLegacyHours(schedule: WeeklySchedule): ClinicHours {
  return DAY_KEYS.reduce((acc, d) => {
    const shifts = schedule[d] ?? [];
    if (shifts.length === 0) {
      acc[d] = null;
    } else {
      const start = shifts.reduce((min, s) => (timeToMinutes(s.start) < timeToMinutes(min) ? s.start : min), shifts[0].start);
      const end = shifts.reduce((max, s) => (timeToMinutes(s.end) > timeToMinutes(max) ? s.end : max), shifts[0].end);
      acc[d] = [start, end];
    }
    return acc;
  }, {} as ClinicHours);
}

/** Writes a schedule onto a schedule holder. A `Clinic` also gets its legacy
 * `hours` mirror refreshed; holders that never had one (facilities, doctors)
 * don't grow the deprecated field. */
export function withSchedule<T extends ScheduleHolder>(holder: T, schedule: WeeklySchedule): T {
  const next = { ...holder, schedule } as T;
  return "hours" in holder ? ({ ...next, hours: scheduleToLegacyHours(schedule) } as T) : next;
}

export function findException(clinic: ScheduleHolder | undefined, date: string): ScheduleException | undefined {
  return (clinic?.schedule_exceptions ?? []).find((e) => e.date === date);
}

/** Shifts actually in effect on a concrete date: a date exception (closed, or
 * a replacement set of shifts) wins over the weekly schedule. Returns an
 * empty array when the location is closed that day. */
export function shiftsForDate(clinic: ScheduleHolder | undefined, date: string): ScheduleShift[] {
  if (!clinic) return [];
  const exception = findException(clinic, date);
  if (exception) return exception.closed ? [] : exception.shifts ?? [];
  const [y, m, d] = date.split("-").map(Number);
  const dayKey = dayKeyForDate(new Date(y, (m || 1) - 1, d || 1));
  return getWeeklySchedule(clinic)[dayKey] ?? [];
}

function overlapsBreak(startMin: number, endMin: number, shift: ScheduleShift): boolean {
  return (shift.breaks ?? []).some((b) => {
    const bs = timeToMinutes(b.start);
    const be = timeToMinutes(b.end);
    return startMin < be && endMin > bs;
  });
}

/** Start times generated by one shift, skipping any slot that would run into
 * a break. `durationMinutes` (the booked service's length) defaults to the
 * shift's own slot length. */
export function slotTimesForShift(shift: ScheduleShift, durationMinutes?: number): string[] {
  const step = shift.slot_minutes || DEFAULT_SLOT_MINUTES;
  const length = durationMinutes && durationMinutes > 0 ? durationMinutes : step;
  const startMin = timeToMinutes(shift.start);
  const endMin = timeToMinutes(shift.end);
  const times: string[] = [];
  for (let t = startMin; t + length <= endMin; t += step) {
    if (overlapsBreak(t, t + length, shift)) continue;
    times.push(minutesToTime(t));
  }
  return times;
}

/** True when the shift can host the given service — a shift with no
 * `service_ids` is open to every service offered at the location. */
export function shiftOffersService(shift: ScheduleShift, serviceId?: string): boolean {
  if (!serviceId) return true;
  const ids = shift.service_ids ?? [];
  return ids.length === 0 || ids.includes(serviceId);
}

/** All bookable start times at a location on a date, de-duplicated and sorted
 * — the shift-aware replacement for the old "one range → slots" helper. */
export function slotTimesForDate(
  clinic: ScheduleHolder | undefined,
  date: string,
  opts: { serviceId?: string; durationMinutes?: number } = {}
): string[] {
  const times = new Set<string>();
  shiftsForDate(clinic, date)
    .filter((s) => shiftOffersService(s, opts.serviceId))
    .forEach((s) => slotTimesForShift(s, opts.durationMinutes).forEach((t) => times.add(t)));
  return [...times].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
}

/** Any bookable time at all this week — used by the onboarding checklist and
 * the "no availability configured" dashboard alert. */
export function hasAnyAvailability(clinic: ScheduleHolder): boolean {
  const schedule = getWeeklySchedule(clinic);
  return DAY_KEYS.some((d) => (schedule[d] ?? []).length > 0);
}

export function totalWeeklyHours(clinic: ScheduleHolder): number {
  const schedule = getWeeklySchedule(clinic);
  return DAY_KEYS.reduce((sum, d) => {
    return (
      sum +
      (schedule[d] ?? []).reduce((daySum, s) => {
        const gross = timeToMinutes(s.end) - timeToMinutes(s.start);
        const breaks = (s.breaks ?? []).reduce((b, br) => b + (timeToMinutes(br.end) - timeToMinutes(br.start)), 0);
        return daySum + Math.max(0, gross - breaks);
      }, 0)
    );
  }, 0) / 60;
}

export function formatShift(shift: ScheduleShift): string {
  return `${shift.start}–${shift.end}`;
}

/** Validation shared by the editor and any programmatic save: shifts must be
 * non-empty ranges, must not overlap each other, and breaks must sit inside
 * their own shift. Returns a Hebrew message, or null when the day is valid. */
export function validateDayShifts(shifts: ScheduleShift[]): string | null {
  const sorted = [...shifts].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  for (const shift of sorted) {
    const start = timeToMinutes(shift.start);
    const end = timeToMinutes(shift.end);
    if (end <= start) return `שעת הסיום ${shift.end} חייבת להיות אחרי שעת ההתחלה ${shift.start}`;
    for (const br of shift.breaks ?? []) {
      const bs = timeToMinutes(br.start);
      const be = timeToMinutes(br.end);
      if (be <= bs) return `הפסקה ${br.start}–${br.end} אינה טווח תקין`;
      if (bs < start || be > end) return `ההפסקה ${br.start}–${br.end} חורגת מהמשמרת ${formatShift(shift)}`;
    }
  }
  for (let i = 1; i < sorted.length; i++) {
    if (timeToMinutes(sorted[i].start) < timeToMinutes(sorted[i - 1].end)) {
      return `המשמרות ${formatShift(sorted[i - 1])} ו-${formatShift(sorted[i])} חופפות`;
    }
  }
  return null;
}
