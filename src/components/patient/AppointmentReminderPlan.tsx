"use client";

import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buildIcsDataUrl } from "@/lib/utils";
import { Appointment, ProviderProfile } from "@/types";

/** Add-to-calendar action for a specific appointment. */
export function AppointmentReminderPlan({
  appointment,
  provider,
}: {
  appointment: Appointment;
  provider?: ProviderProfile;
}) {
  const icsUrl = buildIcsDataUrl({
    title: `תור ל-${appointment.provider_name}`,
    description: appointment.service_name,
    location: provider?.clinic_locations[0]?.address,
    date: appointment.date,
    time: appointment.time,
    durationMinutes: appointment.duration_minutes,
  });

  return (
    <div className="flex flex-wrap gap-2">
      <a href={icsUrl} download="appointment.ics">
        <Button variant="outline" size="sm">
          <Calendar className="h-3.5 w-3.5" /> הוסף ליומן
        </Button>
      </a>
    </div>
  );
}
