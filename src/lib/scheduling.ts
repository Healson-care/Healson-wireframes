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

  return Array.from({ length: daysAhead }, (_, dayIdx) => {
    const d = new Date();
    d.setDate(d.getDate() + dayIdx + 1);
    const date = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("he-IL", { weekday: "short", day: "2-digit", month: "2-digit" });

    const dayKey = DAY_KEYS[d.getDay()];
    const range = location?.hours[dayKey];
    const isBlocked = blockedDates.has(date);

    const times = !range || isBlocked ? [] : slotsForRange(range[0], range[1]);
    const slots = times.map((time) => ({
      time,
      available: !occupied.has(`${date}T${time}`),
    }));

    return { date, label, slots };
  });
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
