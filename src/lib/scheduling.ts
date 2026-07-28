// Real slot availability generator shared by every booking flow (§/book and
// the client personal-area booking flow both call this once a provider —
// and, if they have more than one clinic, a specific location — is picked).
// Slots are derived from that clinic's weekly schedule (shifts, breaks,
// per-date exceptions — see src/lib/schedule.ts), minus any blocked dates and
// any time already taken by an existing, non-cancelled appointment (checked
// against the provider as a whole — a doctor can't be double-booked across
// two locations at the same time either).
//
// `serviceId` narrows the result to a specific service: a shift that declares
// which services it hosts only yields slots for those, the location must
// actually offer the service (ConsultationType.linked_clinic_ids), and slots
// are sized to the service's own duration so a booking can't run past closing.
//
// Medical units (§PRV-08) are the exception to "one appointment at a time per
// provider": a מכון has several independent queues (MRI 1, CT 1, each doctor),
// so its slots are built per resource and a time stays available while ANY
// resource that offers the service is still free — see src/lib/unit-resources.ts.
import {
  Appointment,
  Clinic,
  DEFAULT_SLOT_MINUTES,
  ProviderAffiliation,
  ProviderProfile,
  isPractitionerProviderType,
} from "@/types";
import { slotTimesForDate, timeToMinutes } from "./schedule";
import { practitionerFreeAt } from "./practitioner-availability";
import {
  ResourceSlot,
  UnitResource,
  freeResourceIds,
  getUnitResources,
  resourcesForService,
  unitSlotTimesForDate,
  usesUnitResources,
} from "./unit-resources";

export function primaryLocation(provider: ProviderProfile): Clinic | undefined {
  return provider.clinic_locations.find((c) => c.is_primary) ?? provider.clinic_locations[0];
}

/** Whether a location offers a given service. A service with no explicit
 * location links isn't restricted to any of them. */
export function serviceOfferedAt(provider: ProviderProfile, serviceId: string, clinicId: string): boolean {
  const service = provider.consultation_types.find((s) => s.id === serviceId);
  if (!service) return true;
  const links = service.linked_clinic_ids ?? [];
  return links.length === 0 || links.includes(clinicId);
}

export interface MonthDay {
  date: string; // yyyy-MM-dd
  dayOfMonth: number;
  weekday: number; // 0 (Sunday) .. 6 (Saturday) — matches Date#getDay()
  isPast: boolean; // today or earlier — never bookable
  slots: {
    time: string;
    available: boolean;
    // Medical units only: the resource (מתקן / רופא) that would take this
    // booking — the first one still free at that time. Stamped onto the
    // Appointment so the next booking sees the machine as taken.
    resourceId?: string;
  }[];
}

// Every calendar day in the given month — the date grid needs every day
// present so it can render a blank/no-indicator cell for days the provider
// doesn't work, distinct from a grey "fully booked" cell.
// `clinic` is which of the provider's clinic_locations to build hours from
// (a provider can offer the same service at more than one location, each
// with its own weekly schedule) — defaults to the primary one.
export function buildMonth(
  provider: ProviderProfile,
  appointments: Appointment[],
  monthDate: Date,
  clinic: Clinic | undefined = primaryLocation(provider),
  opts: { serviceId?: string; durationMinutes?: number } = {},
  // §PRV-10 — the affiliations slice, so a unit's human resources (and their
  // cross-context availability) are derived from the first-class links. Omit it
  // and unit doctors fall back to the deprecated embedded array; the
  // cross-context guard for units then has no practitioner mapping to key on.
  affiliations?: ProviderAffiliation[]
): MonthDay[] {
  const location = clinic;
  // A service the chosen location doesn't offer has no slots there at all,
  // regardless of what its shifts say — an unscoped shift means "every
  // service *this location* provides", not every service in the catalog.
  const offeredHere = !opts.serviceId || !location || serviceOfferedAt(provider, opts.serviceId, location.id);
  const blockedDates = new Set((provider.blocked_dates ?? []).map((b) => b.date));
  const providerAppointments = appointments.filter((a) => a.provider_id === provider.id);
  const occupied = new Set(
    providerAppointments.filter((a) => a.status !== "בוטל").map((a) => `${a.date}T${a.time}`)
  );
  // §PRV-10 — booking length used by the cross-context human guard (defaults to
  // one standard slot when the caller didn't scope to a specific service).
  const bookingMinutes = opts.durationMinutes ?? DEFAULT_SLOT_MINUTES;
  // For a solo HUMAN provider, the person's time is also consumed by any unit
  // they deliver in — so their own calendar's free slots must exclude times
  // they're booked elsewhere. Entity providers (store/lab/…) have no such axis.
  const soloHuman = !usesUnitResources(provider, opts.serviceId, affiliations) && isPractitionerProviderType(provider.provider_type);

  // Unit mode: the queues are the resources, not the site. `resources` is
  // empty for every other provider type, which keeps the classic path below.
  const unitMode = usesUnitResources(provider, opts.serviceId, affiliations);
  const unitResources: UnitResource[] = unitMode
    ? opts.serviceId
      ? resourcesForService(getUnitResources(provider, undefined, undefined, affiliations), opts.serviceId)
      : getUnitResources(provider, undefined, undefined, affiliations)
    : [];
  // resource id → delivering person's profile id, for the cross-context guard.
  const practitionerByResource = new Map(unitResources.map((r) => [r.id, r.practitioner_id]));

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: MonthDay[] = [];
  for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth++) {
    const d = new Date(year, month, dayOfMonth);
    const isPast = d <= today;
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
    const isBlocked = blockedDates.has(date);
    const closed = isPast || isBlocked;

    let slots: MonthDay["slots"];
    if (unitMode) {
      const resourceSlots: ResourceSlot[] = closed
        ? []
        : unitSlotTimesForDate(unitResources, date, opts);
      slots = resourceSlots.map((slot) => {
        const free = freeResourceIds(slot, appointments, date, {
          durationMinutes: bookingMinutes,
          practitionerByResource,
        });
        return { time: slot.time, available: free.length > 0, resourceId: free[0] };
      });
    } else {
      const times = closed || !offeredHere ? [] : slotTimesForDate(location, date, opts);
      slots = times.map((time) => {
        // Own-calendar occupancy (as before) plus, for a human, the
        // cross-context guard: booked in a unit ⇒ unavailable in the private
        // clinic too, even though nothing here occupies the slot.
        const takenHere = occupied.has(`${date}T${time}`);
        const busyElsewhere =
          soloHuman && !practitionerFreeAt(provider.id, date, timeToMinutes(time), bookingMinutes, appointments);
        return { time, available: !takenHere && !busyElsewhere };
      });
    }

    days.push({ date, dayOfMonth, weekday: d.getDay(), isPast, slots });
  }
  return days;
}

// Deterministic (not random) "days until this provider's next opening" used
// only to power the availability filter in ProviderDiscovery — there's no
// real per-provider slot data at the search stage (slots are only generated
// once a provider is picked, via buildMonth above), so this simulates a
// stable per-provider offset instead of wiring up a full mock calendar.
export function nextAvailableInDays(providerId: string): number {
  let hash = 0;
  for (let i = 0; i < providerId.length; i++) {
    hash = (hash * 31 + providerId.charCodeAt(i)) >>> 0;
  }
  return 1 + (hash % 28);
}
