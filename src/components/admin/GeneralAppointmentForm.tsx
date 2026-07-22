"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { findSchedulingConflict, suggestNextFreeSlot } from "@/lib/calendar";
import { APPOINTMENT_STATUSES, Appointment, Patient, ProviderProfile } from "@/types";
import { AlertTriangle } from "lucide-react";

export type AppointmentSource = "patient" | "manual";

export interface GeneralAppointmentFormValues {
  source: AppointmentSource;
  patient_id: string;
  manual_name: string;
  manual_phone: string;
  provider_id: string;
  service_name: string;
  date: string;
  time: string;
  duration_minutes: number;
  price: string;
  status: Appointment["status"];
  notes: string;
}

function emptyValues(initialDate?: string): GeneralAppointmentFormValues {
  return {
    source: "patient",
    patient_id: "",
    manual_name: "",
    manual_phone: "",
    provider_id: "",
    service_name: "",
    date: initialDate || new Date().toISOString().slice(0, 10),
    time: "09:00",
    duration_minutes: 30,
    price: "",
    status: "מאושר",
    notes: "",
  };
}

/** Secretary's "book directly from the calendar" form for the general
 * /appointments board — unlike AppointmentForm (used inside a single
 * patient's chart) there's no fixed patient yet, so it starts with a
 * patient-or-walk-in picker. */
export function GeneralAppointmentForm({
  open,
  onClose,
  onSubmit,
  providers,
  patients,
  initialDate,
  appointments,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: GeneralAppointmentFormValues) => void;
  providers: ProviderProfile[];
  patients: Patient[];
  initialDate?: string;
  appointments: Appointment[];
}) {
  const [form, setForm] = useState<GeneralAppointmentFormValues>(emptyValues(initialDate));
  const [wasOpen, setWasOpen] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setForm(emptyValues(initialDate));
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const selectedPatient = patients.find((p) => p.id === form.patient_id);
  const canSubmit =
    !!form.provider_id && !!form.service_name && (form.source === "patient" ? !!form.patient_id : !!form.manual_name.trim());

  const conflict = useMemo(
    () => findSchedulingConflict(appointments, form.provider_id, form.date, form.time, form.duration_minutes),
    [appointments, form.provider_id, form.date, form.time, form.duration_minutes]
  );
  const suggestedSlot = useMemo(
    () =>
      conflict ? suggestNextFreeSlot(appointments, form.provider_id, form.date, form.time, form.duration_minutes) : undefined,
    [conflict, appointments, form.provider_id, form.date, form.time, form.duration_minutes]
  );

  return (
    <Dialog open={open} onClose={onClose} title="קביעת תור חדש" description="קביעה ידנית — כמוסכם בטלפון עם המטופל">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(form);
        }}
        className="flex flex-col gap-3"
      >
        <Select label="עבור" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as AppointmentSource })}>
          <option value="patient">מטופל קיים</option>
          <option value="manual">הזנה ידנית (לא רשום במערכת)</option>
        </Select>

        {form.source === "patient" ? (
          <>
            <Select label="מטופל" required value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
              <option value="">בחר מטופל...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                  {p.phone ? ` — ${p.phone}` : ""}
                </option>
              ))}
            </Select>
            {selectedPatient && (
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-500">קופת חולים</span>
                <span className="font-medium text-slate-700">{selectedPatient.kupah ?? "ללא קופה (תייר)"} · מהפרופיל הביטוחי</span>
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Input label="שם" required value={form.manual_name} onChange={(e) => setForm({ ...form, manual_name: e.target.value })} />
            <Input label="טלפון" value={form.manual_phone} onChange={(e) => setForm({ ...form, manual_phone: e.target.value })} />
          </div>
        )}

        <Select label="ספק" required value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })}>
          <option value="">בחר ספק...</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title ? `${p.title} ` : ""}
              {p.display_name}
            </option>
          ))}
        </Select>

        <Input label="פריט" required value={form.service_name} onChange={(e) => setForm({ ...form, service_name: e.target.value })} />

        <div className="grid grid-cols-2 gap-3">
          <Input type="date" label="תאריך" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input type="time" label="שעה" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        </div>

        {conflict && (
          <div className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-bg px-3 py-2.5 text-sm text-danger-text">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p>לספק כבר יש תור ב-{conflict.time} ({conflict.client_name})</p>
              {suggestedSlot ? (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, time: suggestedSlot })}
                  className="mt-1 font-medium hover:underline"
                >
                  בחר את השעה הפנויה הבאה — {suggestedSlot}
                </button>
              ) : (
                <p className="mt-1 text-xs">אין שעה פנויה נוספת ליום זה</p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            label="משך (דקות)"
            value={form.duration_minutes}
            onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) || 30 })}
          />
          <Input type="number" label="מחיר (אופציונלי)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </div>

        <Select label="סטטוס" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Appointment["status"] })}>
          {APPOINTMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>

        <Textarea label="הערות (אופציונלי)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

        <Button type="submit" className="mt-1" disabled={!canSubmit}>
          קבע תור
        </Button>
      </form>
    </Dialog>
  );
}
