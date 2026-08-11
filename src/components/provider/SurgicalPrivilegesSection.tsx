"use client";

import { useState } from "react";
import { Building2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { fileToDataUrl } from "@/lib/file";
import { SURGICAL_HOSPITALS } from "@/types";
import type { ProviderProfile, UploadedFile } from "@/types";

/**
 * Surgical privileges (הרשאות ניתוח) — a הקמה step, not a registration one.
 *
 * At registration all Healson needs is "are you a licensed surgeon"; WHERE you
 * are allowed to operate, and the paperwork behind it, only matters once that
 * license is verified and the practice is actually being set up. So this lives
 * in the onboarding checklist (see OnboardingProgress) rather than in the
 * application form.
 *
 * Only the hospital is required — the two documents are what Healson asks for
 * in practice but a surgeon may still be collecting them.
 */
export function SurgicalPrivilegesSection({
  provider,
  onSave,
  onDone,
}: {
  provider: ProviderProfile;
  onSave: (data: Partial<ProviderProfile>) => void;
  onDone?: () => void;
}) {
  const [hospital, setHospital] = useState(provider.surgical_privileges_hospital ?? "");
  const [boardFile, setBoardFile] = useState<File | null>(null);
  const [malpracticeFile, setMalpracticeFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedHospital = SURGICAL_HOSPITALS.find((h) => h.id === hospital);

  async function toRecord(file: File): Promise<UploadedFile> {
    return { file_name: file.name, uploaded_at: new Date().toISOString(), data_url: await fileToDataUrl(file) };
  }

  async function handleSave() {
    if (!hospital) {
      setError("נא לבחור את בית החולים או מרכז הניתוחים שבו קיימת ההרשאה");
      return;
    }
    setSaving(true);
    setError("");
    try {
      onSave({
        surgical_privileges_hospital: hospital,
        surgical_board_certificate: boardFile
          ? await toRecord(boardFile)
          : provider.surgical_board_certificate,
        malpractice_insurance_file: malpracticeFile
          ? await toRecord(malpracticeFile)
          : provider.malpractice_insurance_file,
      });
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהעלאת הקובץ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <p className="flex items-start gap-2 rounded-xl border border-info-border bg-info-bg px-3.5 py-2.5 text-xs leading-relaxed text-info-text">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        ניתוחים מוזמנים דרך Healson רק במוסד שבו יש לך הרשאת ניתוח. הפרטים כאן נבדקים על ידי צוות Healson
        לפני אישור הפרסום. כל המוסדות ברשימה נחשבים למסגרת פרטית — גם שערי צדק והדסה, שבהם ההזמנה היא
        לשר״פ.
      </p>

      {error && (
        <div role="alert" className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text">
          {error}
        </div>
      )}

      {/* Closed list — see SURGICAL_HOSPITALS. The address is shown under the
          picker so the surgeon confirms they mean this site (three of the
          hospitals sit on the same street in רמת החייל). */}
      <div className="flex flex-col gap-1.5">
        <Select
          label="בית חולים / מרכז ניתוחים בו קיימת הרשאת ניתוח"
          value={hospital}
          onChange={(e) => {
            setHospital(e.target.value);
            if (error) setError("");
          }}
          required
        >
          <option value="">בחר/י בית חולים</option>
          {SURGICAL_HOSPITALS.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
          {/* A value saved before the list existed stays selectable rather than
              silently emptying the field on the next save. */}
          {hospital && !SURGICAL_HOSPITALS.some((h) => h.id === hospital) && (
            <option value={hospital}>{hospital}</option>
          )}
        </Select>
        {selectedHospital && (
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            {selectedHospital.address}, {selectedHospital.city}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-700">תעודת מומחה בתחום ניתוחי / בורד (לא חובה)</span>
        <FileDropzone
          file={boardFile}
          onFileChange={setBoardFile}
          existingFileName={provider.surgical_board_certificate?.file_name}
          ariaLabel="תעודת מומחה בתחום ניתוחי"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-700">ביטוח אחריות מקצועית (לא חובה)</span>
        <FileDropzone
          file={malpracticeFile}
          onFileChange={setMalpracticeFile}
          existingFileName={provider.malpractice_insurance_file?.file_name}
          ariaLabel="ביטוח אחריות מקצועית"
        />
      </div>

      <Button onClick={handleSave} loading={saving}>
        שמירת הרשאות הניתוח
      </Button>
    </div>
  );
}
