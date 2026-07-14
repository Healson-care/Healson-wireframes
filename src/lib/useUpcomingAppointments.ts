"use client";

import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { isoDateDaysFromNow } from "@/lib/utils";
import { Appointment } from "@/types";

export function useUpcomingAppointments(limit?: number): Appointment[] {
  const currentUser = useStore((s) => s.currentUser);
  const appointments = useStore((s) => s.appointments);
  const patient = useCurrentPatient();

  const today = isoDateDaysFromNow(0);
  const upcoming = appointments
    .filter(
      (a) =>
        (a.created_by_id === patient?.id || a.created_by_id === currentUser?.id) &&
        a.date >= today &&
        a.status !== "בוטל" &&
        a.status !== "בוצע"
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return limit ? upcoming.slice(0, limit) : upcoming;
}
