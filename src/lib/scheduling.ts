// Real slot availability generator shared by every booking flow (§/book and
// the client personal-area booking flow both call this once a provider is
// picked). Slots are derived from the provider's primary clinic/location's
// weekly hours (patients don't pick a location today, so that's the
// authoritative calendar), minus any blocked dates and any time already
// taken by an existing, non-cancelled appointment.
import { Appointment, Clinic, DayKey, ProviderProfile } from "@/types";

export interface DaySlots {
  date: string;
  label: string;
  slots: { time: string; available: boolean }[];
}

const DAY_KEYS: DayKey[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const SLOT_STEP_MINUTES = 30;

function primaryLocation(provider: ProviderProfile): Clinic | undefined {
  return provider.clinic_locations.find((c) => c.is_primary) ?? provider.clinic_locations[0];
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function slotsForRange(start: string, end: string): string[] {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  const times: string[] = [];
  for (let t = startMin; t + SLOT_STEP_MINUTES <= endMin; t += SLOT_STEP_MINUTES) {
    times.push(minutesToTime(t));
  }
  return times;
}

export function buildDays(provider: ProviderProfile, appointments: Appointment[], daysAhead = 6): DaySlots[] {
  const location = primaryLocation(provider);
  const blockedDates = new Set((provider.blocked_dates ?? []).map((b) => b.date));
  const occupied = new Set(
    appointments
      .filter((a) => a.provider_id === provider.id && a.status !== "בוטל")
      .map((a) => `${a.date}T${a.time}`)
  );

  // Saturday (שבת) is never bookable, so it's skipped entirely rather than
  // shown as a day with no slots — the day picker keeps advancing until it
  // has collected `daysAhead` real (non-Saturday) options.
  const days: DaySlots[] = [];
  for (let dayOffset = 1; days.length < daysAhead; dayOffset++) {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    const dayKey = DAY_KEYS[d.getDay()];
    if (dayKey === "saturday") continue;

    const date = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("he-IL", { weekday: "short", day: "2-digit", month: "2-digit" });
    const range = location?.hours[dayKey];
    const isBlocked = blockedDates.has(date);

    const times = !range || isBlocked ? [] : slotsForRange(range[0], range[1]);
    const slots = times.map((time) => ({
      time,
      available: !occupied.has(`${date}T${time}`),
    }));

    days.push({ date, label, slots });
  }
  return days;
}

export interface MonthDay {
  date: string; // yyyy-MM-dd
  dayOfMonth: number;
  weekday: number; // 0 (Sunday) .. 6 (Saturday) — matches Date#getDay()
  isPast: boolean; // today or earlier — never bookable
  slots: { time: string; available: boolean }[];
}

// Every calendar day in the given month (unlike buildDays, which only
// collects the next N *available* business days) — the date grid needs every
// day present so it can render a blank/no-indicator cell for days the
// provider doesn't work, distinct from a grey "fully booked" cell.
export function buildMonth(provider: ProviderProfile, appointments: Appointment[], monthDate: Date): MonthDay[] {
  const location = primaryLocation(provider);
  const blockedDates = new Set((provider.blocked_dates ?? []).map((b) => b.date));
  const occupied = new Set(
    appointments
      .filter((a) => a.provider_id === provider.id && a.status !== "בוטל")
      .map((a) => `${a.date}T${a.time}`)
  );

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: MonthDay[] = [];
  for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth++) {
    const d = new Date(year, month, dayOfMonth);
    const isPast = d <= today;
    const dayKey = DAY_KEYS[d.getDay()];
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
    const range = location?.hours[dayKey];
    const isBlocked = blockedDates.has(date);

    const times = isPast || !range || isBlocked ? [] : slotsForRange(range[0], range[1]);
    const slots = times.map((time) => ({
      time,
      available: !occupied.has(`${date}T${time}`),
    }));

    days.push({ date, dayOfMonth, weekday: d.getDay(), isPast, slots });
  }
  return days;
}

// Deterministic (not random) "days until this provider's next opening" used
// only to power the availability filter in ProviderDiscovery — there's no
// real per-provider slot data at the search stage (slots are only generated
// once a provider is picked, via buildDays above), so this simulates a
// stable per-provider offset instead of wiring up a full mock calendar.
export function nextAvailableInDays(providerId: string): number {
  let hash = 0;
  for (let i = 0; i < providerId.length; i++) {
    hash = (hash * 31 + providerId.charCodeAt(i)) >>> 0;
  }
  return 1 + (hash % 28);
}
