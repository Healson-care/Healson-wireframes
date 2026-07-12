// Mock slot availability generator shared by every booking flow (§/book and
// the client personal-area booking flow both need identical fake calendars).
export interface DaySlots {
  date: string;
  label: string;
  slots: { time: string; available: boolean }[];
}

export function buildDays(): DaySlots[] {
  const hours = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00"];
  return Array.from({ length: 6 }, (_, dayIdx) => {
    const d = new Date();
    d.setDate(d.getDate() + dayIdx + 1);
    const date = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("he-IL", { weekday: "short", day: "2-digit", month: "2-digit" });
    const slots = hours.map((time, i) => ({
      time,
      available: (i + dayIdx) % 3 !== 0,
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
