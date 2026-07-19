"use client";

import { Calendar, FileText, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buildIcsDataUrl } from "@/lib/utils";
import { Appointment, ProviderProfile } from "@/types";

function offsetFromAppointment(appointment: Appointment, opts: { hours?: number; days?: number }) {
  const d = new Date(`${appointment.date}T${appointment.time}:00`);
  if (opts.hours) d.setHours(d.getHours() + opts.hours);
  if (opts.days) d.setDate(d.getDate() + opts.days);
  return d;
}

function formatStepTime(d: Date) {
  return `${d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })} · ${d.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** Add-to-calendar + send-reminder actions, and the fixed reminder timeline
 * relative to a specific appointment — shared between the post-booking
 * confirmation flow's sibling screens (history detail, /client/reminders). */
export function AppointmentReminderPlan({
  appointment,
  provider,
  showTimeline = true,
}: {
  appointment: Appointment;
  provider?: ProviderProfile;
  showTimeline?: boolean;
}) {
  const icsUrl = buildIcsDataUrl({
    title: `תור ל-${appointment.provider_name}`,
    description: appointment.service_name,
    location: provider?.clinic_locations[0]?.address,
    date: appointment.date,
    time: appointment.time,
    durationMinutes: appointment.duration_minutes,
  });

  const steps = [
    { label: "תזכורת + צ׳קליסט להגעה", when: offsetFromAppointment(appointment, { hours: -24 }) },
    { label: "תזכורת אחרונה + קישור להעלאת מסמכים", when: offsetFromAppointment(appointment, { hours: -2 }) },
    { label: "ביקור, תשלום וקבלה דיגיטלית", when: offsetFromAppointment(appointment, {}), highlight: true },
    { label: "סיכום ביקור + דירוג חוויה", when: offsetFromAppointment(appointment, { days: 2 }) },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <a href={icsUrl} download="appointment.ics">
          <Button variant="outline" size="sm">
            <Calendar className="h-3.5 w-3.5" /> הוסף ליומן
          </Button>
        </a>
      </div>

      {showTimeline && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
            <FileText className="h-4 w-4 text-primary" /> מה קורה עכשיו
          </p>
          <ul className="flex flex-col gap-2.5 text-sm text-slate-500">
            {steps.map((step) => (
              <li key={step.label} className="flex items-center justify-between gap-2">
                <span>{step.label}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                  {step.highlight && <PartyPopper className="h-3 w-3" />}
                  {formatStepTime(step.when)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
