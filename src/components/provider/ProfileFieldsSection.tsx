"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Textarea } from "@/components/ui/Input";
import { fileToDataUrl } from "@/lib/file";
import { formatDateHe } from "@/lib/utils";
import { DOCTOR_SUBTYPE_LABELS, ProviderProfile, ToastItem } from "@/types";
import { Lock, Pencil, Save, Upload, SendHorizontal } from "lucide-react";
import { Avatar } from "@/components/ui/Misc";

const LANGUAGE_OPTIONS = ["עברית", "ערבית", "רוסית", "אנגלית"];

/** Two-tier profile editor: fields a provider can change themselves vs.
 * fields that need Healson's approval to change. The approval flow here is
 * intentionally visual only (a request dialog + confirmation toast) — there
 * is no backing approval workflow/state in this mock app. */
export function ProfileFieldsSection({
  provider,
  onSave,
  showToast,
}: {
  provider: ProviderProfile;
  onSave: (data: Partial<ProviderProfile>) => void;
  showToast: (title: string, opts?: { description?: string; variant?: ToastItem["variant"] }) => void;
}) {
  const [form, setForm] = useState({
    display_name: provider.display_name ?? "",
    contact_phone: provider.contact_phone ?? "",
    contact_email: provider.contact_email ?? "",
    bio: provider.bio ?? "",
    coordination_notes: provider.coordination_notes ?? "",
  });
  const [languages, setLanguages] = useState<string[]>(provider.languages ?? []);
  const [imageUrl, setImageUrl] = useState<string | undefined>(provider.image_url);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [requestField, setRequestField] = useState<string | null>(null);
  const [requestReason, setRequestReason] = useState("");

  function toggleLanguage(lang: string) {
    setLanguages((prev) => (prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]));
  }

  async function handlePhotoSelect(file: File | undefined) {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const url = await fileToDataUrl(file);
      setImageUrl(url);
      onSave({ image_url: url });
    } catch (err) {
      showToast("שגיאה בהעלאת התמונה", { description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    onSave({ ...form, languages });
    showToast("הפרופיל נשמר בהצלחה", { variant: "success" });
  }

  function submitChangeRequest() {
    showToast("הבקשה נשלחה לצוות Healson", {
      description: "נעדכן אותך במייל ברגע שהשינוי יאושר.",
      variant: "success",
    });
    setRequestField(null);
    setRequestReason("");
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-slate-400" /> פרטים ניתנים לעריכה עצמאית
          </CardTitle>
          <p className="text-sm text-slate-500">שינויים כאן נשמרים מיידית — אין צורך באישור Healson.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 flex items-center gap-4">
              <Avatar name={form.display_name || provider.display_name} src={imageUrl} className="h-16 w-16 text-lg" />
              <label className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm text-slate-600 cursor-pointer hover:border-primary">
                <Upload className="h-4 w-4" />
                {uploadingPhoto ? "מעלה..." : "העלאת תמונת פרופיל"}
                <input type="file" accept=".jpg,.jpeg,.png" className="hidden" onChange={(e) => handlePhotoSelect(e.target.files?.[0])} />
              </label>
            </div>
            <Input
              label="שם תצוגה (כינוי)"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              required
            />
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
              className="sm:col-span-2"
            />
            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-slate-700 mb-2">שפות</p>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggleLanguage(lang)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      languages.includes(lang) ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              label="על אודות (bio) — יוצג למטופלים"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="sm:col-span-2"
            />
            <Textarea
              label="הנחיות תיאום לצוות Healson (לא גלוי למטופלים)"
              value={form.coordination_notes}
              onChange={(e) => setForm({ ...form, coordination_notes: e.target.value })}
              className="sm:col-span-2"
            />
            <Button type="submit" className="sm:col-span-2 self-start mt-1">
              <Save className="h-4 w-4" /> שמור שינויים
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-slate-400" /> פרטים הדורשים אישור Healson
          </CardTitle>
          <p className="text-sm text-slate-500">שדות רגישים/מקצועיים — כל שינוי דורש בקשה ואישור מצוות Healson.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          <LockedRow label="תחום התמחות" value={provider.specialty || "—"} onRequest={() => setRequestField("תחום התמחות")} />
          <LockedRow
            label="תתי-התמחות"
            value={provider.sub_specialties?.length ? provider.sub_specialties.join(", ") : "—"}
            onRequest={() => setRequestField("תתי-התמחות")}
          />
          <LockedRow label="מספר רישיון" value={provider.license_number || "—"} onRequest={() => setRequestField("מספר רישיון")} />
          <LockedRow label="גוף מנפיק הרישיון" value={provider.license_issuer || "—"} onRequest={() => setRequestField("גוף מנפיק הרישיון")} />
          <LockedRow
            label="תאריך תפוגת רישיון"
            value={provider.license_expiry_date ? formatDateHe(provider.license_expiry_date) : "—"}
            onRequest={() => setRequestField("תאריך תפוגת רישיון")}
          />
          {provider.doctor_subtype && (
            <LockedRow label="סוג רופא/ה" value={DOCTOR_SUBTYPE_LABELS[provider.doctor_subtype]} onRequest={() => setRequestField("סוג רופא/ה")} />
          )}
          <LockedRow
            label={'מס\' עוסק/ח"פ'}
            value={provider.business_reg_number || "—"}
            onRequest={() => setRequestField('מס\' עוסק/ח"פ')}
          />
        </CardContent>
      </Card>

      <Dialog open={!!requestField} onClose={() => setRequestField(null)} title={`בקשת שינוי — ${requestField ?? ""}`}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-500">
            תארו את השינוי המבוקש. הבקשה תישלח לצוות Healson לבדיקה ואישור לפני עדכון הפרופיל.
          </p>
          <Textarea label="פירוט הבקשה" value={requestReason} onChange={(e) => setRequestReason(e.target.value)} />
          <Button onClick={submitChangeRequest}>
            <SendHorizontal className="h-4 w-4" /> שלח בקשה לצוות Healson
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function LockedRow({ label, value, onRequest }: { label: string; value: string; onRequest: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3.5 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-sm font-medium text-slate-800 truncate">{value}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge tone="amber">דורש אישור Healson</Badge>
        <Button variant="outline" size="sm" onClick={onRequest}>
          בקש שינוי
        </Button>
      </div>
    </div>
  );
}
