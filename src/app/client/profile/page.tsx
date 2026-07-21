"use client";

import { useEffect, useState } from "react";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { PageHeader } from "@/components/ui/Misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/Tabs";
import {
  EMPTY_INSURANCE_PROFILE,
  InsuranceProfileForm,
  InsuranceProfileValue,
} from "@/components/patient/InsuranceProfileForm";
import {
  CONSENT_DOCUMENT_VERSION,
  CONSENT_LABELS,
  CONSENT_REQUIRED,
  CONSENT_TYPES,
  COMMUNICATION_LANGUAGES,
  COMMUNICATION_LANGUAGE_LABELS,
  CommunicationLanguage,
  ConsentType,
  Gender,
  GENDERS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_CHANNEL_LABELS,
  NotificationChannel,
  Patient,
  Gender,
  GENDERS,
} from "@/types";
import { formatDateHe, isValidIsraeliId } from "@/lib/utils";
import { ShieldOff, FileDown, Lock, UserRound, SlidersHorizontal, ShieldCheck, ShieldPlus } from "lucide-react";

const OPEN_DSR_STATUSES = ["ממתין", "בטיפול"];

// Read-only display for identity fields — deliberately not styled like an
// input box, so it doesn't invite clicking/typing the way a disabled Input does.
function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="truncate text-sm font-medium text-slate-700">{value || "—"}</p>
      </div>
      <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
    </div>
  );
}

export default function ClientProfilePage() {
  const currentUser = useStore((s) => s.currentUser);
  const updatePatient = useStore((s) => s.updatePatient);
  const showToast = useStore((s) => s.showToast);
  const dsrRequests = useStore((s) => s.dsrRequests);
  const patient = useCurrentPatient();

  const [form, setForm] = useState<{ email: string; phone: string; gender: Gender | "" }>({
    email: "",
    phone: "",
    gender: "",
  });
  const [preferences, setPreferences] = useState<{
    communication_language: CommunicationLanguage;
    notification_channel: NotificationChannel;
  }>({ communication_language: "he", notification_channel: "email" });
  const [insurance, setInsurance] = useState<InsuranceProfileValue>(EMPTY_INSURANCE_PROFILE);
  const [error, setError] = useState("");
  const [rectifyOpen, setRectifyOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");

  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loadKey = patient?.id ?? currentUser?.id ?? null;

  if (loadKey && loadKey !== loadedFor) {
    setLoadedFor(loadKey);
    if (patient) {
      setForm({ email: patient.email ?? "", phone: patient.phone ?? "", gender: patient.gender ?? "" });
      setPreferences({
        communication_language: patient.communication_language ?? "he",
        notification_channel: patient.notification_channel ?? "email",
      });
      setInsurance({
        kupah: patient.kupah,
        k_level: patient.k_level ?? "",
        has_b_insurance: !!patient.has_b_insurance,
        b_insurance_company: patient.b_insurance_company ?? "",
        b_policy_number: patient.b_policy_number ?? "",
        address: patient.address ?? "",
      });
    } else if (currentUser) {
      setForm((f) => ({ ...f, email: currentUser.email }));
    }
  }

  const pendingRectification = patient
    ? dsrRequests.find(
        (r) => r.patient_id === patient.id && r.type === "rectification" && OPEN_DSR_STATUSES.includes(r.status)
      )
    : undefined;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (patient) {
      updatePatient(patient.id, {
        email: form.email,
        phone: form.phone,
        gender: form.gender || undefined,
        communication_language: preferences.communication_language,
        notification_channel: preferences.notification_channel,
        kupah: insurance.kupah,
        k_level: insurance.k_level || undefined,
        has_b_insurance: insurance.has_b_insurance,
        b_insurance_company: insurance.has_b_insurance ? insurance.b_insurance_company : undefined,
        b_policy_number: insurance.has_b_insurance ? insurance.b_policy_number : undefined,
        address: insurance.address || undefined,
      });
    }
    showToast("הפרופיל נשמר בהצלחה", { variant: "success" });
  }

  return (
    <ClientLayout>
      <PageHeader title="הפרופיל שלי" description="פרטים אישיים, פרטי ביטוח וזכויות נושא המידע" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
            {error}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 sm:flex">
            <TabsTrigger value="personal" icon={<UserRound className="h-3.5 w-3.5" />} className="justify-center">
              פרטים אישיים
            </TabsTrigger>
            <TabsTrigger value="preferences" icon={<SlidersHorizontal className="h-3.5 w-3.5" />} className="justify-center">
              העדפות
            </TabsTrigger>
            <TabsTrigger value="insurance" icon={<ShieldPlus className="h-3.5 w-3.5" />} className="justify-center">
              פרופיל ביטוחי
            </TabsTrigger>
            <TabsTrigger value="privacy" icon={<ShieldCheck className="h-3.5 w-3.5" />} className="justify-center">
              פרטיות
            </TabsTrigger>
          </div>

          <TabsContent value="personal" className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>פרטים מזהים</CardTitle>
                <p className="text-sm text-slate-500">
                  שינוי בפרטים אלו דורש אישור צוות — לחצו על &quot;בקש שינוי&quot; כדי לשלוח בקשה
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {pendingRectification && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                    <p className="font-medium">
                      בקשת שינוי פרטים ממתינה לאישור (מ-{formatDateHe(pendingRectification.requested_at)})
                    </p>
                    {pendingRectification.notes && (
                      <p className="text-xs text-amber-700 mt-1">{pendingRectification.notes}</p>
                    )}
                  </div>
                )}
                <LockedField label="שם מלא" value={patient?.full_name ?? ""} />
                <LockedField label="תעודת זהות / דרכון" value={patient?.id_number ?? ""} />
                <LockedField
                  label="תאריך לידה"
                  value={patient?.date_of_birth ? formatDateHe(patient.date_of_birth) : ""}
                />
                <LockedField label="שם הורה (אם המטופל קטין)" value={patient?.parent_name ?? ""} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  disabled={!patient || !!pendingRectification}
                  onClick={() => setRectifyOpen(true)}
                >
                  בקש שינוי פרטים מזהים
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>פרטי קשר</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
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
                  required
                />
                <Input
                  label="כתובת (אופציונלי)"
                  placeholder="רחוב, מספר, עיר"
                  value={insurance.address}
                  onChange={(e) => setInsurance({ ...insurance, address: e.target.value })}
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>העדפות</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Select
                  label="שפת תקשורת"
                  value={preferences.communication_language}
                  onChange={(e) =>
                    setPreferences({ ...preferences, communication_language: e.target.value as CommunicationLanguage })
                  }
                >
                  {COMMUNICATION_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {COMMUNICATION_LANGUAGE_LABELS[lang]}
                    </option>
                  ))}
                </Select>
                <Select
                  label="ערוץ התראות"
                  value={preferences.notification_channel}
                  onChange={(e) =>
                    setPreferences({ ...preferences, notification_channel: e.target.value as NotificationChannel })
                  }
                >
                  {NOTIFICATION_CHANNELS.map((channel) => (
                    <option key={channel} value={channel}>
                      {NOTIFICATION_CHANNEL_LABELS[channel]}
                    </option>
                  ))}
                </Select>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insurance" className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>פרופיל ביטוחי</CardTitle>
              </CardHeader>
              <CardContent>
                <InsuranceProfileForm value={insurance} onChange={setInsurance} showAddress={false} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy">
            {patient && <DataRightsSection patientId={patient.id} />}
          </TabsContent>
        </Tabs>

        {activeTab !== "privacy" && (
          <Button type="submit" className="self-start">
            שמור שינויים
          </Button>
        )}
      </form>

      {patient && (
        <RectifyDetailsDialog open={rectifyOpen} onClose={() => setRectifyOpen(false)} patient={patient} />
      )}
    </ClientLayout>
  );
}

function DataRightsSection({ patientId }: { patientId: string }) {
  const exportPatientData = useStore((s) => s.exportPatientData);
  const addDsrRequest = useStore((s) => s.addDsrRequest);
  const getPatientConsents = useStore((s) => s.getPatientConsents);
  const grantConsent = useStore((s) => s.grantConsent);
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

  function handleGrant(type: ConsentType) {
    grantConsent(patientId, type, CONSENT_DOCUMENT_VERSION);
    showToast("ההסכמה עודכנה", { description: CONSENT_LABELS[type], variant: "success" });
  }

  function handleRevoke(recordId: string, type: ConsentType) {
    revokeConsent(recordId);
    showToast("ההסכמה בוטלה", { description: CONSENT_LABELS[type] });
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
    <Card>
      <CardHeader>
        <CardTitle>הזכויות שלי</CardTitle>
        <p className="text-sm text-slate-500">עיון, ייצוא ומחיקה של הנתונים שלכם, וניהול הסכמות (חוק הגנת הפרטיות)</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <FileDown className="h-4 w-4" /> ייצוא הנתונים שלי
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleErasureRequest}>
            <ShieldOff className="h-4 w-4" /> בקשת מחיקת חשבון
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-slate-700">ניהול הסכמות</p>
          {CONSENT_TYPES.map((type) => {
            const record = activeConsent(type);
            const required = CONSENT_REQUIRED[type];
            return (
              <div key={type} className="flex flex-col gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-slate-700">{CONSENT_LABELS[type]}</p>
                  <p className="text-xs text-slate-400">
                    {record ? `אושר ב-${new Date(record.granted_at).toLocaleDateString("he-IL")}` : "לא אושר"}
                  </p>
                </div>
                {required ? (
                  <span className="text-xs text-slate-400">חובה</span>
                ) : record ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 self-start whitespace-nowrap sm:self-auto"
                    onClick={() => handleRevoke(record.id, type)}
                  >
                    בטל הסכמה
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 self-start whitespace-nowrap sm:self-auto"
                    onClick={() => handleGrant(type)}
                  >
                    אשר הסכמה
                  </Button>
                )}
              </div>
            );
          })}
          {consentRecords.length === 0 && <p className="text-xs text-slate-400">אין רשומות הסכמה</p>}
        </div>
      </CardContent>
    </Card>
  );
}

const RECTIFY_FIELD_LABELS: Record<"full_name" | "id_number" | "date_of_birth" | "parent_name", string> = {
  full_name: "שם מלא",
  id_number: "תעודת זהות / דרכון",
  date_of_birth: "תאריך לידה",
  parent_name: "שם הורה",
};

function RectifyDetailsDialog({
  open,
  onClose,
  patient,
}: {
  open: boolean;
  onClose: () => void;
  patient: Patient;
}) {
  const addDsrRequest = useStore((s) => s.addDsrRequest);
  const showToast = useStore((s) => s.showToast);

  const [values, setValues] = useState({
    full_name: "",
    id_number: "",
    date_of_birth: "",
    parent_name: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setValues({
        full_name: patient.full_name ?? "",
        id_number: patient.id_number ?? "",
        date_of_birth: patient.date_of_birth ?? "",
        parent_name: patient.parent_name ?? "",
      });
      setError("");
    }
  }, [open, patient]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (values.id_number && !isValidIsraeliId(values.id_number)) {
      setError("מספר תעודת זהות לא תקין");
      return;
    }
    const diffs = (Object.keys(RECTIFY_FIELD_LABELS) as (keyof typeof RECTIFY_FIELD_LABELS)[])
      .filter((key) => (values[key] ?? "").trim() !== (patient[key] ?? "").trim())
      .map((key) => `${RECTIFY_FIELD_LABELS[key]}: "${patient[key] || "—"}" → "${values[key] || "—"}"`);

    if (diffs.length === 0) {
      setError("לא בוצע אף שינוי");
      return;
    }

    addDsrRequest({ patient_id: patient.id, type: "rectification", notes: diffs.join("; ") });
    showToast("בקשת התיקון נשלחה", { description: "נטפל בבקשה בהקדם", variant: "success" });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="בקשת שינוי פרטים מזהים"
      description="השינוי ייכנס לתוקף רק לאחר אישור הצוות"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && (
          <div className="rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
            {error}
          </div>
        )}
        <Input
          label="שם מלא"
          value={values.full_name}
          onChange={(e) => setValues({ ...values, full_name: e.target.value })}
          required
        />
        <Input
          label="תעודת זהות / דרכון"
          value={values.id_number}
          onChange={(e) => setValues({ ...values, id_number: e.target.value })}
          inputMode="numeric"
          maxLength={9}
        />
        <Input
          label="תאריך לידה"
          type="date"
          value={values.date_of_birth}
          onChange={(e) => setValues({ ...values, date_of_birth: e.target.value })}
        />
        <Input
          label="שם הורה (אם המטופל קטין)"
          value={values.parent_name}
          onChange={(e) => setValues({ ...values, parent_name: e.target.value })}
        />
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit">שלח בקשה</Button>
        </div>
      </form>
    </Dialog>
  );
}
