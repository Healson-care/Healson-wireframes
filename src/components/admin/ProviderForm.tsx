"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PROVIDER_TYPE_LABELS, PROVIDER_TYPES, ProviderType } from "@/types";

export interface ProviderFormValues {
  // Healson ops creates real organizations by hand; units and their login
  // users are then created from inside the organization's admin profile.
  is_organization: boolean;
  provider_type: ProviderType;
  display_name: string;
  contact_name: string;
  specialty: string;
  contact_phone: string;
  contact_email: string;
  license_number: string;
  commission_rate: number;
}

const EMPTY: ProviderFormValues = {
  is_organization: false,
  provider_type: "doctor",
  display_name: "",
  contact_name: "",
  specialty: "",
  contact_phone: "",
  contact_email: "",
  license_number: "",
  commission_rate: 15,
};

export function ProviderForm({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ProviderFormValues) => void;
}) {
  const [form, setForm] = useState<ProviderFormValues>(EMPTY);
  const [wasOpen, setWasOpen] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setForm(EMPTY);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="ספק / ארגון חדש"
      description={
        form.is_organization
          ? "יצירת ארגון (רשת) — לאחר היצירה מוסיפים לו יחידות רפואיות ומשתמש כניסה לכל יחידה מתוך כרטיס הארגון"
          : "הוספה ידנית — הספק ייכנס ישירות במצב מאושר ומפורסם"
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(form);
        }}
        className="flex flex-col gap-3"
      >
        <Select
          label="סוג רשומה"
          value={form.is_organization ? "organization" : "provider"}
          onChange={(e) => setForm({ ...form, is_organization: e.target.value === "organization" })}
        >
          <option value="provider">נותן שירות / יחידה עצמאית</option>
          <option value="organization">ארגון (רשת בריאות)</option>
        </Select>
        {!form.is_organization && (
          <Select
            label="סוג ספק"
            value={form.provider_type}
            onChange={(e) => setForm({ ...form, provider_type: e.target.value as ProviderType })}
          >
            {PROVIDER_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROVIDER_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        )}
        <Input
          label={form.is_organization ? "שם הארגון" : "שם תצוגה"}
          required
          value={form.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
        />
        {form.is_organization ? (
          <Input
            label="איש קשר בארגון"
            value={form.contact_name}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
          />
        ) : (
          <Input label="תחום" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
        )}
        <Input
          label="טלפון ליצירת קשר"
          value={form.contact_phone}
          onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
        />
        <Input
          label="אימייל ליצירת קשר"
          type="email"
          value={form.contact_email}
          onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
        />
        {!form.is_organization && (
          <Input
            label="מספר רישיון"
            value={form.license_number}
            onChange={(e) => setForm({ ...form, license_number: e.target.value })}
          />
        )}
        <Input
          label="אחוז עמלה (%)"
          type="number"
          value={form.commission_rate}
          onChange={(e) => setForm({ ...form, commission_rate: Number(e.target.value) || 0 })}
        />
        <Button type="submit" className="mt-1">
          {form.is_organization ? "צור ארגון" : "שמור ספק"}
        </Button>
      </form>
    </Dialog>
  );
}
