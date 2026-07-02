"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LEAD_STATUSES, Lead } from "@/types";

export interface LeadFormValues {
  full_name: string;
  email: string;
  phone: string;
  source: string;
  notes: string;
  status: Lead["status"];
}

const EMPTY: LeadFormValues = {
  full_name: "",
  email: "",
  phone: "",
  source: "אתר אינטרנט",
  notes: "",
  status: "חדש",
};

export function LeadForm({
  open,
  onClose,
  onSubmit,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: LeadFormValues) => void;
  initial?: Partial<LeadFormValues>;
}) {
  const [form, setForm] = useState<LeadFormValues>(EMPTY);
  const [wasOpen, setWasOpen] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setForm({ ...EMPTY, ...initial });
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "עריכת ליד" : "ליד חדש"}>
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
        <Input label="מקור" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
        <Select label="סטטוס" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Lead["status"] })}>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Textarea label="הערות" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <Button type="submit" className="mt-1">שמור</Button>
      </form>
    </Dialog>
  );
}
