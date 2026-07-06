"use client";

import { useState } from "react";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { PageHeader } from "@/components/ui/Misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  EMPTY_INSURANCE_PROFILE,
  InsuranceProfileForm,
  InsuranceProfileValue,
} from "@/components/patient/InsuranceProfileForm";
import { CONSENT_LABELS, CONSENT_REQUIRED, CONSENT_TYPES, ConsentType } from "@/types";
import { ShieldOff, FileDown } from "lucide-react";

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
    parent_name: "",
  });
  const [insurance, setInsurance] = useState<InsuranceProfileValue>(EMPTY_INSURANCE_PROFILE);

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
        parent_name: patient.parent_name ?? "",
      });
      setInsurance({
        kupah: patient.kupah,
        k_level: patient.k_level ?? "",
        has_b_insurance: !!patient.has_b_insurance,
        b_insurance_company: patient.b_insurance_company ?? "",
        b_policy_number: patient.b_policy_number ?? "",
      });
    } else if (currentUser) {
      setForm((f) => ({ ...f, full_name: currentUser.full_name, email: currentUser.email }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (patient) {
      updatePatient(patient.id, {
        ...form,
        kupah: insurance.kupah,
        k_level: insurance.k_level || undefined,
        has_b_insurance: insurance.has_b_insurance,
        b_insurance_company: insurance.has_b_insurance ? insurance.b_insurance_company : undefined,
        b_policy_number: insurance.has_b_insurance ? insurance.b_policy_number : undefined,
      });
    }
    showToast("הפרופיל נשמר בהצלחה", { variant: "success" });
  }

  return (
    <ClientLayout>
      <PageHeader title="הפרופיל שלי" description="פרטים אישיים, פרטי ביטוח וזכויות נושא המידע" />

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
            <InsuranceProfileForm value={insurance} onChange={setInsurance} />
          </CardContent>
        </Card>

        <Button type="submit" className="self-start">
          שמור שינויים
        </Button>
      </form>

      {patient && <DataRightsSection patientId={patient.id} />}
    </ClientLayout>
  );
}

function DataRightsSection({ patientId }: { patientId: string }) {
  const exportPatientData = useStore((s) => s.exportPatientData);
  const addDsrRequest = useStore((s) => s.addDsrRequest);
  const getPatientConsents = useStore((s) => s.getPatientConsents);
  const revokeConsent = useStore((s) => s.revokeConsent);
  const showToast = useStore((s) => s.showToast);
  const consentRecords = useStore((s) => s.consentRecords);

  const consents = getPatientConsents(patientId);

  function activeConsent(type: ConsentType) {
    return consents
      .filter((c) => c.consent_type === type)
      .sort((a, b) => (a.granted_at < b.granted_at ? 1 : -1))
      .find((c) => c.granted && !c.revoked_at);
  }

  function handleExport() {
    const data = exportPatientData(patientId);
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `healson-my-data-${patientId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("הנתונים יוצאו בהצלחה", { description: "קובץ JSON הורד למכשירך", variant: "success" });
  }

  function handleErasureRequest() {
    addDsrRequest({ patient_id: patientId, type: "erasure" });
    showToast("בקשת המחיקה נשלחה", { description: "נטפל בבקשה תוך 30 יום", variant: "success" });
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>הזכויות שלי</CardTitle>
        <p className="text-sm text-slate-500">עיון, ייצוא ומחיקה של הנתונים שלכם, וניהול הסכמות (חוק הגנת הפרטיות)</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <FileDown className="h-4 w-4" /> ייצוא הנתונים שלי
          </Button>
          <Button variant="outline" size="sm" onClick={handleErasureRequest}>
            <ShieldOff className="h-4 w-4" /> בקשת מחיקת חשבון
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-slate-700">הסכמות שניתנו</p>
          {CONSENT_TYPES.map((type) => {
            const record = activeConsent(type);
            const required = CONSENT_REQUIRED[type];
            return (
              <div key={type} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div>
                  <p className="text-slate-700">{CONSENT_LABELS[type]}</p>
                  <p className="text-xs text-slate-400">
                    {record ? `אושר ב-${new Date(record.granted_at).toLocaleDateString("he-IL")}` : "לא אושר"}
                  </p>
                </div>
                {record && !required && (
                  <Button variant="outline" size="sm" onClick={() => revokeConsent(record.id)}>
                    בטל הסכמה
                  </Button>
                )}
                {required && <span className="text-xs text-slate-400">חובה</span>}
              </div>
            );
          })}
          {consentRecords.length === 0 && <p className="text-xs text-slate-400">אין רשומות הסכמה</p>}
        </div>
      </CardContent>
    </Card>
  );
}
