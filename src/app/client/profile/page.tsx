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
import { StepUpReauthDialog } from "@/components/shared/StepUpReauthDialog";
import { useOtpAttemptGuard, ResendControl, BlockedPanel, WrongAttemptsLockoutNotice } from "@/components/shared/OtpAttemptGuard";
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
} from "@/types";
import { cn, formatDateHe, isValidEmail, isValidIsraeliId, isValidIsraeliPhone } from "@/lib/utils";
import { CITIES, STREETS_BY_CITY, DEFAULT_STREETS } from "@/lib/constants";
import { ShieldOff, FileDown, Lock, Pencil, UserRound, SlidersHorizontal, ShieldCheck, ShieldPlus } from "lucide-react";

const OPEN_DSR_STATUSES = ["ממתין", "בטיפול"];

// Reverses the "street, city" join registration uses to store Patient.address
// as a single string, so the profile page can prefill the same city/street
// pickers. Best-effort only — falls back to blank fields if it doesn't match
// a known city (e.g. addresses set before this field existed).
function parseAddress(address: string): { city: string; street: string } {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const [street, city] = parts;
    return { city: CITIES.includes(city) ? city : "", street };
  }
  if (parts.length === 1) {
    return CITIES.includes(parts[0]) ? { city: parts[0], street: "" } : { city: "", street: parts[0] };
  }
  return { city: "", street: "" };
}

// Segmented toggle for a short, fixed set of options — used instead of a
// native <select> where there are only 2-3 choices. iOS renders <select>
// options via its own OS picker (font size isn't controllable via CSS), so
// for very short lists a toggle avoids that "tiny popup" problem entirely.
function SegmentedToggle<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="grid gap-1 rounded-lg bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "rounded-md py-1.5 text-sm font-medium transition-colors",
              value === opt ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {labels[opt]}
          </button>
        ))}
      </div>
    </div>
  );
}

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

type ContactField = "email" | "phone";
const CONTACT_FIELD_LABELS: Record<ContactField, string> = { email: "אימייל", phone: "טלפון" };

// Step-up re-auth before a contact-detail change takes effect — password,
// then one OTP (see PendingReauth in store.ts) sent to the *new* value
// specifically, so saving also proves the patient actually controls the
// new email/phone, not just that they're still signed in. Thin wrapper
// around the shared StepUpReauthDialog — only the copy differs (it names
// the new value being verified), the password/otp/lockout mechanics are
// identical to every other step-up dialog on this page.
function ContactFieldVerifyDialog({
  open,
  onClose,
  field,
  newValue,
  onVerified,
}: {
  open: boolean;
  onClose: () => void;
  field: ContactField;
  newValue: string;
  onVerified: () => void;
}) {
  return (
    <StepUpReauthDialog
      open={open}
      onClose={onClose}
      title={`אימות שינוי ${CONTACT_FIELD_LABELS[field]}`}
      otpDescription={field === "email" ? `שלחנו קוד אימות לכתובת ${newValue}` : `שלחנו קוד אימות ב-SMS למספר ${newValue}`}
      otpToastTitle={field === "email" ? "קוד אימות נשלח לכתובת המייל החדשה" : "קוד אימות נשלח ב-SMS למספר החדש"}
      onVerified={onVerified}
    />
  );
}

// One row = one field, edited and saved independently (pencil to edit,
// own "שמור" that gates on ContactFieldVerifyDialog) — not batched with the
// rest of the profile form the way the old combined email+phone form was.
function EditableContactRow({ patient, field }: { patient: Patient; field: ContactField }) {
  const updatePatient = useStore((s) => s.updatePatient);
  const showToast = useStore((s) => s.showToast);
  const currentValue = patient[field] ?? "";
  const label = CONTACT_FIELD_LABELS[field];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState("");

  const draftError =
    editing && draft
      ? field === "email"
        ? !isValidEmail(draft)
          ? "כתובת אימייל לא תקינה"
          : undefined
        : !isValidIsraeliPhone(draft)
        ? "מספר טלפון לא תקין"
        : undefined
      : undefined;

  function startEdit() {
    setDraft(currentValue);
    setEditing(true);
  }

  function handleSaveClick() {
    const trimmed = draft.trim();
    if (!trimmed || draftError || trimmed === currentValue) {
      setEditing(false);
      return;
    }
    setPendingValue(trimmed);
    setVerifyOpen(true);
  }

  function handleVerified() {
    if (field === "email") updatePatient(patient.id, { email: pendingValue });
    else updatePatient(patient.id, { phone: pendingValue });
    showToast(`ה${label} עודכן בהצלחה`, { variant: "success" });
    setEditing(false);
  }

  return (
    <>
      {editing ? (
        <div className="flex flex-col gap-1.5">
          <Input
            label={label}
            type={field === "email" ? "email" : "text"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            error={draftError}
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setEditing(false)} className="text-xs font-medium text-slate-500 hover:underline">
              ביטול
            </button>
            <button type="button" onClick={handleSaveClick} className="text-xs font-medium text-primary hover:underline">
              שמור
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="truncate text-sm font-medium text-slate-700">{currentValue || "—"}</p>
          </div>
          <button
            type="button"
            onClick={startEdit}
            aria-label={`ערוך ${label}`}
            className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <ContactFieldVerifyDialog
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        field={field}
        newValue={pendingValue}
        onVerified={handleVerified}
      />
    </>
  );
}

// Same step-up procedure as login: password, then a single OTP sent to both
// SMS and email at once (not scoped to one changed field, unlike
// ContactFieldVerifyDialog — insurance changes don't change a channel).
function InsuranceVerifyDialog({
  open,
  onClose,
  onVerified,
}: {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
}) {
  return <StepUpReauthDialog open={open} onClose={onClose} title="אימות שמירת שינויים" onVerified={onVerified} />;
}

export default function ClientProfilePage() {
  const currentUser = useStore((s) => s.currentUser);
  const updatePatient = useStore((s) => s.updatePatient);
  const showToast = useStore((s) => s.showToast);
  const dsrRequests = useStore((s) => s.dsrRequests);
  const patient = useCurrentPatient();

  // Email/phone are no longer part of this batch form — each is edited and
  // saved independently by its own EditableContactRow (see above).
  // secondary_phone lives here and not in the "פרטי קשר" card above on
  // purpose — it never receives an OTP, so it doesn't need (or deserve) the
  // per-field re-auth those rows enforce.
  const [form, setForm] = useState<{ gender: Gender | ""; secondary_phone: string }>({
    gender: "",
    secondary_phone: "",
  });
  const [preferences, setPreferences] = useState<{
    communication_language: CommunicationLanguage;
    notification_channel: NotificationChannel;
  }>({ communication_language: "he", notification_channel: "email" });
  const [insurance, setInsurance] = useState<InsuranceProfileValue>(EMPTY_INSURANCE_PROFILE);
  const [addressCity, setAddressCity] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [error, setError] = useState("");
  const [rectifyOpen, setRectifyOpen] = useState(false);
  const [insuranceVerifyOpen, setInsuranceVerifyOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");

  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loadKey = patient?.id ?? currentUser?.id ?? null;

  if (loadKey && loadKey !== loadedFor) {
    setLoadedFor(loadKey);
    if (patient) {
      setForm({ gender: patient.gender ?? "", secondary_phone: patient.secondary_phone ?? "" });
      setPreferences({
        communication_language: patient.communication_language ?? "he",
        notification_channel: patient.notification_channel ?? "email",
      });
      setInsurance({
        kupah: patient.kupah ?? "",
        k_level: patient.k_level ?? "",
        b_insurances: patient.b_insurances ?? [],
        address: patient.address ?? "",
      });
      const parsed = parseAddress(patient.address ?? "");
      setAddressCity(parsed.city);
      setAddressStreet(parsed.street);
    }
  }

  // Empty is fine (the field is optional), but a typed number still has to be
  // valid and distinct from the verified one in "פרטי קשר".
  const secondaryPhoneError = !form.secondary_phone
    ? undefined
    : !isValidIsraeliPhone(form.secondary_phone)
    ? "מספר טלפון לא תקין"
    : form.secondary_phone === patient?.phone
    ? "מספר הטלפון הנוסף זהה למספר הראשי"
    : undefined;

  const pendingRectification = patient
    ? dsrRequests.find(
        (r) => r.patient_id === patient.id && r.type === "rectification" && OPEN_DSR_STATUSES.includes(r.status)
      )
    : undefined;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!patient) return;
    if (secondaryPhoneError) {
      setError(secondaryPhoneError);
      return;
    }
    updatePatient(patient.id, {
      gender: form.gender || undefined,
      secondary_phone: form.secondary_phone.trim() || undefined,
      communication_language: preferences.communication_language,
      notification_channel: preferences.notification_channel,
      address: [addressStreet.trim(), addressCity.trim()].filter(Boolean).join(", ") || undefined,
    });
    showToast("השינויים נשמרו", { variant: "success" });
  }

  // Insurance changes go through the same password + OTP step-up as login
  // (not the plain "שמור שינויים" above) — kupah/insurance affects pricing
  // and eligibility, so it's gated separately from gender/address/preferences.
  function handleSaveInsurance() {
    if (!patient) return;
    updatePatient(patient.id, {
      kupah: insurance.kupah || undefined,
      k_level: insurance.k_level || undefined,
      b_insurances: insurance.b_insurances.length > 0 ? insurance.b_insurances : undefined,
    });
    showToast("הפרופיל הביטוחי עודכן בהצלחה", { variant: "success" });
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
                  <div className="rounded-lg bg-warning-bg border border-warning-border px-3 py-2 text-sm text-warning-text">
                    <p className="font-medium">
                      בקשת שינוי פרטים ממתינה לאישור (מ-{formatDateHe(pendingRectification.requested_at)})
                    </p>
                    {pendingRectification.notes && (
                      <p className="text-xs text-warning-text/90 mt-1">{pendingRectification.notes}</p>
                    )}
                  </div>
                )}
                <LockedField label="שם מלא" value={patient?.full_name ?? ""} />
                <LockedField label="תעודת זהות / דרכון" value={patient?.id_number ?? ""} />
                <LockedField
                  label="תאריך לידה"
                  value={patient?.date_of_birth ? formatDateHe(patient.date_of_birth) : ""}
                />
                <LockedField label="שם האב" value={patient?.parent_name ?? ""} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  disabled={!patient || !!pendingRectification}
                  onClick={() => setRectifyOpen(true)}
                >
                  ערוך
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>פרטי קשר</CardTitle>
                <p className="text-sm text-slate-500">
                  לחצו על העט ליד שדה כדי לערוך אותו — כל שדה נשמר ומאומת בנפרד
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {patient ? (
                  <>
                    <EditableContactRow patient={patient} field="email" />
                    <EditableContactRow patient={patient} field="phone" />
                  </>
                ) : (
                  <p className="text-sm text-slate-400">טוען...</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>פרטים נוספים</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
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
                <Input
                  label="מספר טלפון נוסף (אופציונלי)"
                  type="tel"
                  placeholder="למשל בן/בת זוג, הורה או טלפון בעבודה"
                  value={form.secondary_phone}
                  onChange={(e) => setForm({ ...form, secondary_phone: e.target.value })}
                  error={secondaryPhoneError}
                  hint="מספר לגיבוי בלבד — קודי אימות תמיד נשלחים למספר הראשי"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    label="עיר (אופציונלי)"
                    value={addressCity}
                    onChange={(e) => {
                      setAddressCity(e.target.value);
                      setAddressStreet("");
                    }}
                  >
                    <option value="">לא צוין</option>
                    {CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="רחוב ומספר (אופציונלי)"
                    value={addressStreet}
                    onChange={(e) => setAddressStreet(e.target.value)}
                    disabled={!addressCity}
                  >
                    <option value="">{addressCity ? "בחרו רחוב" : "בחרו עיר קודם"}</option>
                    {(STREETS_BY_CITY[addressCity] ?? DEFAULT_STREETS).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>
                <p className="text-xs text-slate-400 -mt-2">
                  הרשימה לצורך הדגמה בלבד — באתר אמיתי שדה זה יתחבר למאגר כתובות חיצוני מלא
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>העדפות</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <SegmentedToggle
                  label="שפת תקשורת"
                  value={preferences.communication_language}
                  options={COMMUNICATION_LANGUAGES}
                  labels={COMMUNICATION_LANGUAGE_LABELS}
                  onChange={(lang) => setPreferences({ ...preferences, communication_language: lang })}
                />
                <SegmentedToggle
                  label="ערוץ התראות"
                  value={preferences.notification_channel}
                  options={NOTIFICATION_CHANNELS}
                  labels={NOTIFICATION_CHANNEL_LABELS}
                  onChange={(channel) => setPreferences({ ...preferences, notification_channel: channel })}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insurance" className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>פרופיל ביטוחי</CardTitle>
                <p className="text-sm text-slate-500">
                  שמירת שינויים כאן דורשת אימות סיסמה וקוד — כמו בכניסה למערכת
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <InsuranceProfileForm
                  value={insurance}
                  onChange={setInsurance}
                  showAddress={false}
                  allowNoKupah={patient?.id_document_type === "passport"}
                />
                <Button
                  type="button"
                  className="self-start"
                  disabled={!patient}
                  onClick={() => setInsuranceVerifyOpen(true)}
                >
                  שמור פרופיל ביטוחי
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy">
            {patient && <DataRightsSection patientId={patient.id} />}
          </TabsContent>
        </Tabs>

        {activeTab !== "privacy" && activeTab !== "insurance" && (
          <Button type="submit" className="self-start">
            שמור שינויים
          </Button>
        )}
      </form>

      <InsuranceVerifyDialog
        open={insuranceVerifyOpen}
        onClose={() => setInsuranceVerifyOpen(false)}
        onVerified={handleSaveInsurance}
      />

      {patient && (
        <RectifyDetailsDialog open={rectifyOpen} onClose={() => setRectifyOpen(false)} patient={patient} />
      )}
    </ClientLayout>
  );
}

type PrivacyAction = "export" | "erasure";
const PRIVACY_ACTION_LABELS: Record<PrivacyAction, string> = {
  export: "ייצוא הנתונים שלי",
  erasure: "בקשת מחיקת חשבון",
};

// Same password + single OTP (SMS+email) step-up as login — one shared
// dialog gates both data export and the erasure request, since these are
// one-off actions (not per-field edits like contact details), and export in
// particular hands over the full personal/medical record in one click
// otherwise.
function PrivacyActionVerifyDialog({
  open,
  onClose,
  action,
  onVerified,
}: {
  open: boolean;
  onClose: () => void;
  action: PrivacyAction | null;
  onVerified: () => void;
}) {
  return (
    <StepUpReauthDialog
      open={open}
      onClose={onClose}
      title={action ? `אימות זהות — ${PRIVACY_ACTION_LABELS[action]}` : "אימות זהות"}
      passwordDescription="לאימות זהותכם לפני ביצוע הפעולה, הזינו את הסיסמה שלכם"
      onVerified={onVerified}
    />
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

  const [pendingAction, setPendingAction] = useState<PrivacyAction | null>(null);

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

  function handleVerifiedPrivacyAction() {
    if (pendingAction === "export") handleExport();
    else if (pendingAction === "erasure") handleErasureRequest();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>הזכויות שלי</CardTitle>
        <p className="text-sm text-slate-500">עיון, ייצוא ומחיקה של הנתונים שלכם, וניהול הסכמות (חוק הגנת הפרטיות)</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPendingAction("export")}>
            <FileDown className="h-4 w-4" /> ייצוא הנתונים שלי
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setPendingAction("erasure")}>
            <ShieldOff className="h-4 w-4" /> בקשת מחיקת חשבון
          </Button>
        </div>
        <PrivacyActionVerifyDialog
          open={pendingAction !== null}
          onClose={() => setPendingAction(null)}
          action={pendingAction}
          onVerified={handleVerifiedPrivacyAction}
        />

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
  parent_name: "שם האב",
};

type RectifyPhase = "form" | "password" | "otp";

// Requesting a change to identifying details is sensitive enough to require
// step-up re-auth first (password, then one OTP sent to SMS+email at once —
// same 2FA policy as login, see PendingReauth in store.ts) — the request
// still needs staff approval afterward (DSR rectification), this just
// confirms it's really the account holder asking before it's even filed.
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
  const beginReauth = useStore((s) => s.beginReauth);
  const verifyReauthOtp = useStore((s) => s.verifyReauthOtp);
  const resendReauthOtp = useStore((s) => s.resendReauthOtp);
  const showToast = useStore((s) => s.showToast);
  const currentUser = useStore((s) => s.currentUser);
  const guard = useOtpAttemptGuard("reauth");

  const [phase, setPhase] = useState<RectifyPhase>("form");
  const [values, setValues] = useState({
    full_name: "",
    id_number: "",
    date_of_birth: "",
    parent_name: "",
  });
  const [pendingDiffs, setPendingDiffs] = useState<string[]>([]);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthCode, setReauthCode] = useState("");
  const [error, setError] = useState("");

  // Re-seed the form from the patient record when the dialog opens — done
  // during render (React's "adjust state when props change" pattern) instead
  // of in an effect, avoiding a cascading second render.
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setValues({
        full_name: patient.full_name ?? "",
        id_number: patient.id_number ?? "",
        date_of_birth: patient.date_of_birth ?? "",
        parent_name: patient.parent_name ?? "",
      });
      setPhase("form");
      setReauthPassword("");
      setReauthCode("");
      setError("");
      guard.reset();
    }
  }

  const idNumberError =
    values.id_number && !isValidIsraeliId(values.id_number) ? "מספר תעודת זהות לא תקין" : undefined;

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (idNumberError) {
      setError(idNumberError);
      return;
    }
    const diffs = (Object.keys(RECTIFY_FIELD_LABELS) as (keyof typeof RECTIFY_FIELD_LABELS)[])
      .filter((key) => (values[key] ?? "").trim() !== (patient[key] ?? "").trim())
      .map((key) => `${RECTIFY_FIELD_LABELS[key]}: "${patient[key] || "—"}" → "${values[key] || "—"}"`);

    if (diffs.length === 0) {
      setError("לא בוצע אף שינוי");
      return;
    }
    setPendingDiffs(diffs);
    setPhase("password");
  }

  // Nothing real to check the password against (see login() in store.ts —
  // this app never stores real passwords) — just requires a non-empty entry
  // before issuing the OTP, same as every other password field here.
  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError("");
    if (!reauthPassword) {
      setError("יש להזין סיסמה");
      return;
    }
    const otp = beginReauth();
    showToast("קוד אימות נשלח ב-SMS ובמייל", { description: `קוד הדגמה: ${otp}`, variant: "success" });
    setPhase("otp");
  }

  function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (guard.verifyLockSecondsLeft > 0) return;
    setError("");
    const result = verifyReauthOtp(reauthCode);
    if (!result.ok) {
      setError(result.error ?? "שגיאה באימות");
      guard.noteWrongAttempt();
      return;
    }
    addDsrRequest({ patient_id: patient.id, type: "rectification", notes: pendingDiffs.join("; ") });
    showToast("בקשת התיקון נשלחה", { description: "נטפל בבקשה בהקדם", variant: "success" });
    onClose();
  }

  function handleResendReauthOtp() {
    if (guard.secondsLeft > 0 || guard.blocked) return;
    const otp = resendReauthOtp();
    if (otp) {
      showToast("קוד חדש נשלח ב-SMS ובמייל", { description: `קוד הדגמה: ${otp}` });
      guard.noteResend();
    }
  }

  const DESCRIPTION_BY_PHASE: Record<RectifyPhase, string> = {
    form: "השינוי ייכנס לתוקף רק לאחר אישור הצוות",
    password: "לאימות זהותכם לפני שליחת הבקשה, הזינו את הסיסמה שלכם",
    otp: "שלחנו קוד אימות ב-SMS ובמייל — הקוד זהה בשני הערוצים",
  };

  return (
    <Dialog open={open} onClose={onClose} title="בקשת שינוי פרטים מזהים" description={DESCRIPTION_BY_PHASE[phase]}>
      {error && (
        <div className="mb-3 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
          {error}
        </div>
      )}
      {phase === "form" && (
        <form onSubmit={handleFormSubmit} className="flex flex-col gap-3">
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
            error={idNumberError}
          />
          <Input
            label="תאריך לידה"
            type="date"
            value={values.date_of_birth}
            onChange={(e) => setValues({ ...values, date_of_birth: e.target.value })}
          />
          <Input
            label="שם האב"
            value={values.parent_name}
            onChange={(e) => setValues({ ...values, parent_name: e.target.value })}
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              ביטול
            </Button>
            <Button type="submit">המשך לאימות זהות</Button>
          </div>
        </form>
      )}
      {phase === "password" && (
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
          <Input
            type="password"
            label="סיסמה"
            value={reauthPassword}
            onChange={(e) => setReauthPassword(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              ביטול
            </Button>
            <Button type="submit">המשך</Button>
          </div>
        </form>
      )}
      {phase === "otp" &&
        (guard.blocked ? (
          <BlockedPanel />
        ) : (
          <form onSubmit={handleOtpSubmit} className="flex flex-col gap-3">
            <Input
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              label="קוד אימות"
              value={reauthCode}
              onChange={(e) => setReauthCode(e.target.value)}
              className="text-center tracking-[0.4em] text-lg"
              disabled={guard.verifyLockSecondsLeft > 0}
              required
            />
            <WrongAttemptsLockoutNotice secondsLeft={guard.verifyLockSecondsLeft} />
            <div className="flex justify-end gap-2 mt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                ביטול
              </Button>
              <Button type="submit" disabled={guard.verifyLockSecondsLeft > 0}>
                שלח בקשה
              </Button>
            </div>
            <ResendControl
              secondsLeft={guard.secondsLeft}
              onResend={handleResendReauthOtp}
              resendCount={guard.resendCount}
              issueReported={guard.issueReported}
              onReportIssue={() => guard.reportIssue("sms", currentUser?.email ?? "")}
            />
          </form>
        ))}
    </Dialog>
  );
}
