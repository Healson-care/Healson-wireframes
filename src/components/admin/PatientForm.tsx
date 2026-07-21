"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { InsuranceProfileForm, InsuranceProfileValue } from "@/components/patient/InsuranceProfileForm";
import { GENDERS, Gender, KLevel, PATIENT_STATUSES, Patient } from "@/types";

export interface PatientFormValues {
  full_name: string;
  email: string;
  phone: string;
  id_number: string;
  id_document_type: "id" | "passport";
  date_of_birth: string;
  gender: Gender | "";
  parent_name: string;
  kupah: Patient["kupah"];
  k_level: KLevel | "";
  has_b_insurance: boolean;
  b_insurance_company: string;
  b_policy_number: string;
  address: string;
  status: Patient["status"];
}

const EMPTY: PatientFormValues = {
  full_name: "",
  email: "",
  phone: "",
  id_number: "",
  id_document_type: "id",
  date_of_birth: "",
  gender: "",
  parent_name: "",
  kupah: "כללית",
  k_level: "",
  has_b_insurance: false,
  b_insurance_company: "",
  b_policy_number: "",
  address: "",
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

  const insuranceValue: InsuranceProfileValue = {
    kupah: form.kupah,
    k_level: form.k_level,
    has_b_insurance: form.has_b_insurance,
    b_insurance_company: form.b_insurance_company,
    b_policy_number: form.b_policy_number,
    address: form.address,
  };

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
        <Input label="טלפון" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input label="אימייל" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="סוג מסמך מזהה"
            value={form.id_document_type}
            onChange={(e) => setForm({ ...form, id_document_type: e.target.value as "id" | "passport" })}
          >
            <option value="id">תעודת זהות</option>
            <option value="passport">דרכון</option>
          </Select>
          <Input
            label={form.id_document_type === "id" ? "מספר ת.ז" : "מספר דרכון"}
            required
            value={form.id_number}
            onChange={(e) => setForm({ ...form, id_number: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            type="date"
            label="תאריך לידה"
            required
            value={form.date_of_birth}
            onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
          />
          <Select
            label="מגדר"
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}
          >
            <option value="">לא צוין</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </div>
        <Input label="שם הורה (קטין)" value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} />

        <InsuranceProfileForm value={insuranceValue} onChange={(v) => setForm({ ...form, ...v })} />

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
