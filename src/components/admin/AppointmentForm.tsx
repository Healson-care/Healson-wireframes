"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { APPOINTMENT_STATUSES, Appointment, ProviderProfile } from "@/types";

export interface AppointmentFormValues {
  provider_id: string;
  service_name: string;
  date: string;
  time: string;
  duration_minutes: number;
  price: string;
  status: Appointment["status"];
  notes: string;
}

function emptyValues(initialDate?: string): AppointmentFormValues {
  return {
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

/** Quick, secretary-facing "book on this patient's behalf" form — deliberately
 * simpler than the patient-facing /book flow (no per-kupah price resolution,
 * no deposit math): front desk enters what they already agreed with the
 * patient over the phone. */
export function AppointmentForm({
  open,
  onClose,
  onSubmit,
  providers,
  patientKupah,
  initialDate,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: AppointmentFormValues) => void;
  providers: ProviderProfile[];
  patientKupah: string;
  initialDate?: string;
}) {
  const [form, setForm] = useState<AppointmentFormValues>(emptyValues(initialDate));
  const [wasOpen, setWasOpen] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setForm(emptyValues(initialDate));
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  return (
    <Dialog open={open} onClose={onClose} title="קביעת תור חדש" description="קביעה ידנית עבור המטופל, כמוסכם בטלפון">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(form);
        }}
        className="flex flex-col gap-3"
      >
        <Select label="ספק" required value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })}>
          <option value="">בחר ספק...</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title ? `${p.title} ` : ""}
              {p.display_name}
            </option>
          ))}
        </Select>

        <Input label="שירות" required value={form.service_name} onChange={(e) => setForm({ ...form, service_name: e.target.value })} />

        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-500">קופת חולים</span>
          <span className="font-medium text-slate-700">{patientKupah} · מהפרופיל הביטוחי</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input type="date" label="תאריך" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input type="time" label="שעה" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            label="משך (דקות)"
            value={form.duration_minutes}
            onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) || 30 })}
          />
          <Input
            type="number"
            label="מחיר (אופציונלי)"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
        </div>

        <Select label="סטטוס" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Appointment["status"] })}>
          {APPOINTMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>

        <Textarea label="הערות (אופציונלי)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

        <Button type="submit" className="mt-1" disabled={!form.provider_id || !form.service_name}>
          קבע תור
        </Button>
      </form>
    </Dialog>
  );
}
