"use client";

import { useMemo, useState } from "react";
import { ProviderLayout } from "@/components/layouts/ProviderLayout";
import { useStore } from "@/lib/store";
import { useCurrentProvider } from "@/lib/useCurrentPatient";
import { PageHeader } from "@/components/ui/Misc";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { formatDateHe } from "@/lib/utils";
import { Plus, FileText } from "lucide-react";
import { LabReferral, REFERRAL_STATUSES, ReferralStatus } from "@/types";

export default function ProviderReferralsPage() {
  const provider = useCurrentProvider();
  const patients = useStore((s) => s.patients);
  const labReferrals = useStore((s) => s.labReferrals);
  const addLabReferral = useStore((s) => s.addLabReferral);
  const updateLabReferral = useStore((s) => s.updateLabReferral);
  const showToast = useStore((s) => s.showToast);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ patient_id: "", test_type: "", lab_code: "", notes: "" });

  const myPatients = useMemo(
    () => patients.filter((p) => p.assigned_provider === provider?.id),
    [patients, provider]
  );

  const myReferrals = useMemo(
    () =>
      labReferrals
        .filter((r) => r.provider_id === provider?.id)
        .sort((a, b) => (a.created_date < b.created_date ? 1 : -1)),
    [labReferrals, provider]
  );

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const patient = patients.find((p) => p.id === form.patient_id);
    if (!patient || !provider) return;
    addLabReferral({
      provider_id: provider.id,
      provider_name: provider.display_name,
      patient_id: patient.id,
      patient_name: patient.full_name,
      test_types: [form.test_type],
      lab_code: form.lab_code || undefined,
      status: "ממתין לעיבוד",
      notes: form.notes,
    });
    showToast("ההפניה נוצרה בהצלחה", { variant: "success" });
    setOpen(false);
    setForm({ patient_id: "", test_type: "", lab_code: "", notes: "" });
  }

  return (
    <ProviderLayout>
      <PageHeader
        title="הפניות למעבדה"
        description="יצירה ומעקב אחר הפניות בדיקה"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> הפניה חדשה
          </Button>
        }
      />

      <DataTable<LabReferral>
        rows={myReferrals}
        rowKey={(r) => r.id}
        emptyIcon={<FileText className="h-10 w-10" />}
        emptyTitle="אין הפניות עדיין"
        columns={
          [
            {
              key: "patient",
              header: "מטופל",
              sortable: true,
              sortValue: (r) => r.patient_name,
              render: (r) => <span className="font-medium text-slate-900">{r.patient_name}</span>,
            },
            { key: "tests", header: "בדיקות", render: (r) => <span className="text-slate-600">{r.test_types.join(", ")}</span> },
            {
              key: "date",
              header: "תאריך",
              sortable: true,
              sortValue: (r) => r.created_date,
              render: (r) => <span className="text-slate-500">{formatDateHe(r.created_date)}</span>,
            },
            {
              key: "status",
              header: "סטטוס",
              render: (r) => (
                <div className="flex items-center gap-2">
                  <Select
                    value={r.status}
                    onChange={(e) => updateLabReferral(r.id, { status: e.target.value as ReferralStatus })}
                    className="h-8 text-xs w-32"
                  >
                    {REFERRAL_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                  {r.status !== "ממתין לעיבוד" && <StatusBadge status={r.status} kind="referral" />}
                </div>
              ),
            },
          ] satisfies DataTableColumn<LabReferral>[]
        }
      />

      <Dialog open={open} onClose={() => setOpen(false)} title="הפניה חדשה למעבדה">
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <Select
            label="מטופל"
            value={form.patient_id}
            onChange={(e) => setForm({ ...form, patient_id: e.target.value })}
            required
          >
            <option value="">בחר מטופל</option>
            {myPatients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </Select>
          <Input
            label="סוג בדיקה"
            value={form.test_type}
            onChange={(e) => setForm({ ...form, test_type: e.target.value })}
            required
          />
          <Input
            label="קוד מעבדה"
            value={form.lab_code}
            onChange={(e) => setForm({ ...form, lab_code: e.target.value })}
          />
          <Textarea
            label="הערות"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <Button type="submit">שלח הפניה</Button>
        </form>
      </Dialog>
    </ProviderLayout>
  );
}
