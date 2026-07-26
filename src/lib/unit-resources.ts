// Medical-unit resources (§PRV-08) — the availability model for a מכון רפואי /
// מרפאת חוץ.
//
// A unit is one site (the unit IS the branch), and it doesn't have a single
// queue: what it sells is delivered by a *resource*, and each resource has its
// own week and its own queue:
//
//   חדר        (ProviderFacility) — "MRI 1" hosts MRI ראש / MRI בטן / MRI ברך,
//                                   "CT 1" hosts the CT items, and so on.
//   נותן שירות (AffiliatedDoctor) — consultations and provider-delivered procedures.
//
// Consequences, all implemented here:
//   • Availability is read per resource, never from the unit as a whole.
//   • Capacity is counted per resource — MRI 1, CT 1 and ד"ר גלעד can each
//     hold an appointment at 09:00 without colliding.
//   • A service is bookable exactly when at least one resource that offers it
//     is open and free. A service linked to no resource at all falls back to
//     the unit's general hours (see resolveServiceAvailability below), so a
//     unit that hasn't modelled its resources yet still behaves as it did.
//
// "זמינות כללית" (the unit-level week on the single Clinic record) is the
// unit's opening hours and the aggregate picture of every resource. It is
// DISPLAY + FALLBACK today, not a constraint that clips resource hours — see
// buildUnitOverview and the note in UnitAvailabilitySection.
import {
  AffiliatedDoctor,
  Appointment,
  FACILITY_KIND_LABELS,
  ProviderFacility,
  ProviderProfile,
  ScheduleException,
  WeeklySchedule,
  isUnitProviderType,
} from "@/types";
import {
  DAY_KEYS,
  ScheduleHolder,
  getWeeklySchedule,
  hasAnyAvailability,
  shiftOffersService,
  shiftsForDate,
  slotTimesForShift,
  timeToMinutes,
  totalWeeklyHours,
} from "./schedule";

export type UnitResourceKind = "facility" | "doctor";

/** A facility or a doctor, flattened into the one shape the scheduler needs. */
export interface UnitResource extends ScheduleHolder {
  id: string; // facility id / affiliation id — unique within the unit
  kind: UnitResourceKind;
  name: string;
  /** "MRI · Siemens Vida" / "מנהל היחידה להדמיה" — one line of context. */
  subtitle?: string;
  service_ids: string[];
  is_active: boolean;
  /** Which branch (site) this לוז runs in. */
  branch_id?: string;
  /** The מערך (service line) this לוז belongs to — "מערך MRI" / "מערך ייעוצים". */
  service_array?: string;
  /** How many identical stations this one לוז represents (concurrent capacity
   * per slot). A doctor is always 1; a facility can stand for several machines. */
  capacity: number;
  schedule?: WeeklySchedule;
  schedule_exceptions?: ScheduleException[];
}

export const UNIT_RESOURCE_KIND_LABELS: Record<UnitResourceKind, string> = {
  facility: "חדר",
  doctor: "נותן/ת שירות",
};

export const UNIT_RESOURCE_KIND_LABELS_PLURAL: Record<UnitResourceKind, string> = {
  facility: "חדרים",
  doctor: "נותני שירות",
};

export function isUnitProvider(provider: ProviderProfile): boolean {
  return isUnitProviderType(provider.provider_type);
}

export function facilityToResource(facility: ProviderFacility, kindLabel: string): UnitResource {
  return {
    id: facility.id,
    kind: "facility",
    name: facility.name,
    subtitle: [kindLabel, facility.model, facility.room].filter(Boolean).join(" · "),
    service_ids: facility.service_ids ?? [],
    is_active: facility.is_active !== false,
    branch_id: facility.branch_id,
    service_array: facility.service_array,
    capacity: Math.max(1, facility.capacity ?? 1),
    schedule: facility.schedule,
    schedule_exceptions: facility.schedule_exceptions,
  };
}

export function doctorToResource(
  affiliation: AffiliatedDoctor,
  doctorName: string,
  subtitle?: string
): UnitResource {
  return {
    id: affiliation.id,
    kind: "doctor",
    name: doctorName,
    subtitle: [affiliation.role, subtitle].filter(Boolean).join(" · ") || undefined,
    service_ids: affiliation.service_ids ?? [],
    is_active: true,
    branch_id: affiliation.branch_id,
    service_array: affiliation.service_array,
    capacity: 1,
    schedule: affiliation.schedule,
    schedule_exceptions: affiliation.schedule_exceptions,
  };
}

/** Every bookable resource of a unit — facilities first, then doctors.
 * `doctorNames` maps a doctor ProviderProfile id to its display name (the
 * caller has the providers list; this module deliberately doesn't). */
export function getUnitResources(
  provider: ProviderProfile,
  doctorNames?: Map<string, { name: string; specialty?: string }>
): UnitResource[] {
  if (!isUnitProvider(provider)) return [];
  const facilities = (provider.facilities ?? []).map((f) =>
    facilityToResource(f, FACILITY_KIND_LABELS[f.kind] ?? "")
  );
  const doctors = (provider.affiliated_doctors ?? []).map((a) => {
    const info = doctorNames?.get(a.doctor_provider_id);
    return doctorToResource(a, info?.name ?? "נותן/ת שירות", info?.specialty);
  });
  return [...facilities, ...doctors];
}

/** Resources that can deliver a given service. */
export function resourcesForService(resources: UnitResource[], serviceId: string): UnitResource[] {
  return resources.filter((r) => r.is_active && r.service_ids.includes(serviceId));
}

/** How a unit's service gets its slots:
 *  "resources" — one or more resources are linked to it (the modelled case);
 *  "unit"      — nothing is linked, so the unit's general hours are used.
 * Kept explicit so both the booking engine and the UI warnings agree. */
export function resolveServiceAvailability(
  resources: UnitResource[],
  serviceId: string
): { mode: "resources"; resources: UnitResource[] } | { mode: "unit" } {
  const linked = resourcesForService(resources, serviceId);
  return linked.length > 0 ? { mode: "resources", resources: linked } : { mode: "unit" };
}

/** True when this provider's slots must be computed from resources rather than
 * from the unit's single location schedule. */
export function usesUnitResources(provider: ProviderProfile, serviceId?: string): boolean {
  if (!isUnitProvider(provider)) return false;
  const resources = getUnitResources(provider).filter((r) => r.is_active);
  if (resources.length === 0) return false;
  if (!serviceId) return true;
  return resourcesForService(resources, serviceId).length > 0;
}

export interface ResourceSlot {
  time: string;
  /** Resource ids open at this time — capacity is `length`, not 1. */
  resourceIds: string[];
}

/** All start times a service can be booked at on a date, together with which
 * resources are open then. Occupancy is NOT applied here (the caller knows the
 * appointments) — see freeResourceIds. */
export function unitSlotTimesForDate(
  resources: UnitResource[],
  date: string,
  opts: { serviceId?: string; durationMinutes?: number } = {}
): ResourceSlot[] {
  // Which distinct resources are open at each time (deduped across a resource's
  // own overlapping shifts).
  const openByTime = new Map<string, Set<string>>();
  const capacityById = new Map<string, number>();
  resources
    .filter((r) => r.is_active)
    .filter((r) => !opts.serviceId || r.service_ids.includes(opts.serviceId))
    .forEach((resource) => {
      capacityById.set(resource.id, Math.max(1, resource.capacity ?? 1));
      shiftsForDate(resource, date)
        .filter((s) => shiftOffersService(s, opts.serviceId))
        .forEach((s) =>
          slotTimesForShift(s, opts.durationMinutes).forEach((time) => {
            const set = openByTime.get(time) ?? new Set<string>();
            set.add(resource.id);
            openByTime.set(time, set);
          })
        );
    });
  // Each open resource contributes `capacity` concurrent openings (a לוז that
  // stands for N stations → its id appears N times).
  return [...openByTime.entries()]
    .map(([time, ids]) => {
      const resourceIds: string[] = [];
      ids.forEach((id) => {
        const c = capacityById.get(id) ?? 1;
        for (let i = 0; i < c; i++) resourceIds.push(id);
      });
      return { time, resourceIds };
    })
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

/** Which of a slot's resources are actually free, given the day's
 * appointments. An appointment with no `resource_id` (a unit appointment
 * predating the resource model) can't be attributed to a resource, so it is
 * counted against the unit rather than blocking a specific machine. */
export function freeResourceIds(
  slot: ResourceSlot,
  appointments: Appointment[],
  date: string
): string[] {
  // How many bookings each resource id already holds at this time. A לוז with
  // capacity N appears N times in slot.resourceIds, and can absorb N bookings
  // on the same id before it's full.
  const takenCount = new Map<string, number>();
  appointments
    .filter((a) => a.status !== "בוטל" && a.date === date && a.time === slot.time && a.resource_id)
    .forEach((a) => takenCount.set(a.resource_id!, (takenCount.get(a.resource_id!) ?? 0) + 1));

  const remaining = new Map(takenCount);
  return slot.resourceIds.filter((id) => {
    const left = remaining.get(id);
    if (left && left > 0) {
      remaining.set(id, left - 1); // this opening is consumed by an existing booking
      return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// "זמינות כללית" — the unit-level picture
// ---------------------------------------------------------------------------

export interface ResourceWeekSummary {
  resource: UnitResource;
  activeDays: number;
  weeklyHours: number;
  hasAvailability: boolean;
  /** Number of the unit's services this resource is linked to. */
  serviceCount: number;
}

export interface UnitOverview {
  facilities: ResourceWeekSummary[];
  doctors: ResourceWeekSummary[];
  /** Days of the week on which at least one resource is open. */
  activeDays: number;
  totalWeeklyHours: number;
  /** Resources that exist but have no week configured yet. */
  resourcesWithoutAvailability: UnitResource[];
  /** Services delivered by no resource — they fall back to the unit's hours. */
  servicesWithoutResource: { id: string; name: string }[];
  /** Per weekday, how many resources are open — the "תמונת מצב" heat row. */
  openResourcesByDay: Record<string, number>;
}

export function buildUnitOverview(provider: ProviderProfile, resources: UnitResource[]): UnitOverview {
  const summarize = (resource: UnitResource): ResourceWeekSummary => {
    const schedule = getWeeklySchedule(resource);
    return {
      resource,
      activeDays: DAY_KEYS.filter((d) => (schedule[d] ?? []).length > 0).length,
      weeklyHours: totalWeeklyHours(resource),
      hasAvailability: hasAnyAvailability(resource),
      serviceCount: resource.service_ids.length,
    };
  };

  const facilities = resources.filter((r) => r.kind === "facility").map(summarize);
  const doctors = resources.filter((r) => r.kind === "doctor").map(summarize);
  const all = [...facilities, ...doctors];

  const openResourcesByDay = DAY_KEYS.reduce<Record<string, number>>((acc, day) => {
    acc[day] = all.filter((s) => (getWeeklySchedule(s.resource)[day] ?? []).length > 0).length;
    return acc;
  }, {});

  return {
    facilities,
    doctors,
    activeDays: DAY_KEYS.filter((d) => openResourcesByDay[d] > 0).length,
    totalWeeklyHours: all.reduce((sum, s) => sum + s.weeklyHours, 0),
    resourcesWithoutAvailability: all.filter((s) => !s.hasAvailability).map((s) => s.resource),
    servicesWithoutResource: provider.consultation_types
      .filter((s) => resourcesForService(resources, s.id).length === 0)
      .map((s) => ({ id: s.id, name: s.name })),
    openResourcesByDay,
  };
}
