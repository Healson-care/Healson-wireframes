"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { KUPOT, PATIENT_STATUSES, Patient } from "@/types";

export interface PatientFormValues {
  full_name: string;
  email: string;
  phone: string;
  id_number: string;
  parent_name: string;
  kupah: Patient["kupah"];
  status: Patient["status"];
}

const EMPTY: PatientFormValues = {
  full_name: "",
  email: "",
  phone: "",
  id_number: "",
  parent_name: "",
  kupah: "כללית",
  status: "פעיל",
};

export function PatientForm({
  open,
  onClose,
  onSubmit,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: PatientFormValues) => void;
  initial?: Partial<PatientFormValues>;
}) {
  const [form, setForm] = useState<PatientFormValues>(EMPTY);
  const [wasOpen, setWasOpen] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setForm({ ...EMPTY, ...initial });
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "עריכת מטופל" : "מטופל חדש"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(form);
        }}
        className="flex flex-col gap-3"
      >
        <Input label="שם מלא" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <Input label="טלפון" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input label="אימייל" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label="תעודת זהות" value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} />
        <Input label="שם הורה (קטין)" value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} />
        <Select label="קופת חולים" value={form.kupah} onChange={(e) => setForm({ ...form, kupah: e.target.value as Patient["kupah"] })}>
          {KUPOT.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </Select>
        <Select label="סטטוס" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Patient["status"] })}>
          {PATIENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Button type="submit" className="mt-1">שמור</Button>
      </form>
    </Dialog>
  );
}
