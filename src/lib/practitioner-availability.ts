// §PRV-10 — the person-level time ledger that prevents a single human service
// provider from being booked twice at once ACROSS every context they work in
// (their own solo clinics + every medical unit they deliver in).
//
// The invariant the whole platform leans on: an Appointment's `practitioner_id`
// is the human whose time the event consumes, INDEPENDENT of which calendar
// owns it. So the authoritative "is this person free?" question is answered by
// scanning ALL appointments for that practitioner_id — never by provider_id,
// which is context-scoped and silently misses cross-context collisions (a
// doctor's private-clinic booking lives under provider_id = their own profile,
// a unit booking under provider_id = the unit; the two never intersect).
//
// NOTE (scale): in a real backend this must be enforced atomically at WRITE
// time — e.g. a Postgres `EXCLUDE USING gist (practitioner_id WITH =,
// tsrange(start,end) WITH &&) WHERE status <> 'בוטל'` — because a client-side
// check-then-write races under concurrency. Here it is a read-time guard.
import { Appointment } from "@/types";

export interface BusyInterval {
  startMin: number;
  endMin: number;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Every minute-range the practitioner is already committed to on `date`,
 * aggregated across all their contexts. `excludeAppointmentId` skips the
 * appointment being edited so it doesn't collide with itself. */
export function practitionerBusyIntervals(
  practitionerId: string,
  date: string,
  appointments: Appointment[],
  excludeAppointmentId?: string
): BusyInterval[] {
  return appointments
    .filter(
      (a) =>
        a.practitioner_id === practitionerId &&
        a.date === date &&
        a.status !== "בוטל" &&
        a.id !== excludeAppointmentId
    )
    .map((a) => {
      const startMin = timeToMinutes(a.time);
      return { startMin, endMin: startMin + a.duration_minutes };
    });
}

/** True when the practitioner has no commitment overlapping
 * [startMin, startMin + durationMin) anywhere. A blank practitionerId (a
 * facility/room booking — no person involved) is always free on this axis. */
export function practitionerFreeAt(
  practitionerId: string | undefined,
  date: string,
  startMin: number,
  durationMin: number,
  appointments: Appointment[],
  excludeAppointmentId?: string
): boolean {
  if (!practitionerId) return true;
  const endMin = startMin + durationMin;
  return !practitionerBusyIntervals(practitionerId, date, appointments, excludeAppointmentId).some(
    (b) => startMin < b.endMin && b.startMin < endMin
  );
}
