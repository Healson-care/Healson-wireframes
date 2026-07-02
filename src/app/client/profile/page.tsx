"use client";

import { useState } from "react";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { PageHeader } from "@/components/ui/Misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { KUPOT } from "@/types";

export default function ClientProfilePage() {
  const currentUser = useStore((s) => s.currentUser);
  const updatePatient = useStore((s) => s.updatePatient);
  const showToast = useStore((s) => s.showToast);
  const patient = useCurrentPatient();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    id_number: "",
    kupah: "כללית" as (typeof KUPOT)[number],
    parent_name: "",
  });

  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loadKey = patient?.id ?? currentUser?.id ?? null;

  if (loadKey && loadKey !== loadedFor) {
    setLoadedFor(loadKey);
    if (patient) {
      setForm({
        full_name: patient.full_name ?? "",
        email: patient.email ?? "",
        phone: patient.phone ?? "",
        id_number: patient.id_number ?? "",
        kupah: patient.kupah,
        parent_name: patient.parent_name ?? "",
      });
    } else if (currentUser) {
      setForm((f) => ({ ...f, full_name: currentUser.full_name, email: currentUser.email }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (patient) {
      updatePatient(patient.id, form);
    }
    showToast("הפרופיל נשמר בהצלחה", { variant: "success" });
  }

  return (
    <ClientLayout>
      <PageHeader title="הפרופיל שלי" description="פרטים אישיים ופרטי ביטוח" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>פרטים אישיים</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input
              label="שם מלא"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
            <Input
              label="אימייל"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="טלפון"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              label="תעודת זהות"
              value={form.id_number}
              onChange={(e) => setForm({ ...form, id_number: e.target.value })}
            />
            <Input
              label="שם הורה (אם המטופל קטין)"
              value={form.parent_name}
              onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ביטוח</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              label="קופת חולים"
              value={form.kupah}
              onChange={(e) => setForm({ ...form, kupah: e.target.value as (typeof KUPOT)[number] })}
            >
              {KUPOT.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          </CardContent>
        </Card>

        <Button type="submit" className="self-start">
          שמור שינויים
        </Button>
      </form>
    </ClientLayout>
  );
}
