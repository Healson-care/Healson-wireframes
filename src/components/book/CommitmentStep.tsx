"use client";

import { useState } from "react";
import { AlertTriangle, CalendarClock, FileText, MapPin, ShieldCheck, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { HoldTimer } from "@/components/book/HoldTimer";
import { PreparationRequirements } from "@/components/book/PreparationRequirements";
import { resolveDepositAmount } from "@/lib/deposit";
import { CommitmentRequirement } from "@/lib/pricing";
import { formatCurrency } from "@/lib/utils";
import { ConsultationType, ProviderProfile } from "@/types";


/**
 * What replaces the payment screen whenever the payer settles by undertaking
 * rather than at the till — the kupah's טופס 17 for a basket service, the
 * insurer's undertaking for surgery under a private policy. In both cases no
 * deposit is taken: what the appointment needs is the document. Two states:
 *
 *  1. She has the form → upload it and the appointment is confirmed.
 *  2. She doesn't yet → the fallback below, which is still an OPEN product
 *     decision and is drawn as such rather than pretended to be settled.
 */
export function CommitmentStep({
  provider,
  consultation,
  selectedSlot,
  clinicName,
  basePrice,
  commitment,
  coverageLabel,
  holdExpiresAt,
  onExpire,
  file,
  onFileChange,
  submitting,
  onConfirmWithCommitment,
  onPayDepositInstead,
}: {
  provider: ProviderProfile;
  consultation?: ConsultationType;
  selectedSlot: { date: string; time: string; label: string };
  clinicName?: string;
  /** P — shown so the value of the coverage is visible, never charged. */
  basePrice: number;
  /** Who issues the undertaking and what it's called. */
  commitment: CommitmentRequirement;
  /** The route in the patient's words — "מכוסה בסל הבריאות" and so on. */
  coverageLabel: string;
  holdExpiresAt: number;
  onExpire: () => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  submitting: boolean;
  onConfirmWithCommitment: () => void;
  onPayDepositInstead: () => void;
}) {
  const [showFallback, setShowFallback] = useState(false);
  const depositAmount = resolveDepositAmount(basePrice, consultation);

  return (
    <div>
      <div className="mb-4 text-center">
        <HoldTimer expiresAt={holdExpiresAt} onExpire={onExpire} />
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-2 text-xs text-slate-400">סיכום ההזמנה</p>
        <div className="flex items-start justify-between gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Stethoscope className="h-3.5 w-3.5 shrink-0" /> שירות
          </span>
          <span className="text-left font-medium text-slate-900">{consultation?.name}</span>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3 text-sm">
          <span className="text-slate-500">נותן שירות</span>
          <span className="text-left font-medium text-slate-900">
            {provider.title} {provider.display_name}
          </span>
        </div>
        {clinicName && (
          <div className="mt-2 flex items-start justify-between gap-3 text-sm">
            <span className="flex items-center gap-1.5 text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> מיקום
            </span>
            <span className="text-left font-medium text-slate-900">{clinicName}</span>
          </div>
        )}
        <div className="mt-2 flex items-start justify-between gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-slate-500">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" /> מועד
          </span>
          <span className="text-left font-medium text-slate-900">
            {selectedSlot.label} · {selectedSlot.time}
          </span>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-teal-200 bg-teal-50 p-5">
        <p className="flex items-center gap-1.5 text-sm font-bold text-teal-800">
          <ShieldCheck className="h-4 w-4 shrink-0" /> {coverageLabel} — לא נדרשת מקדמה
        </p>
        <p className="mt-1 text-xs text-teal-800/80">
          {commitment.source} מממנ/ת את השירות מול נותן השירות. מחיר מלא של {formatCurrency(basePrice)} — אתם לא
          משלמים אותו כאן.
        </p>
      </div>

      <div className="mb-4">
        <PreparationRequirements consultation={consultation} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <FileText className="h-4 w-4 shrink-0" /> {commitment.formLabel}
        </p>
        <p className="mb-3 mt-1 text-xs text-slate-500">
          ההתחייבות היא מה שמאפשר ל{commitment.source} לממן את השירות. צרפו אותה כאן והתור יאושר סופית.
        </p>
        <FileDropzone file={file} onFileChange={onFileChange} />

        <Button
          size="lg"
          className="mt-4 w-full"
          disabled={!file}
          loading={submitting}
          onClick={onConfirmWithCommitment}
        >
          {file ? "אשרו את התור" : "צרפו התחייבות כדי לאשר"}
        </Button>

        {!showFallback && (
          <button
            onClick={() => setShowFallback(true)}
            className="focus-ring mt-3 w-full rounded-lg py-1.5 text-xs font-medium text-primary hover:underline"
          >
            אין לי התחייבות עדיין
          </button>
        )}
      </div>

      {showFallback && (
        <div className="mt-4 rounded-2xl border border-warning-border bg-warning-bg p-5">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-warning-text">
            <AlertTriangle className="h-4 w-4 shrink-0" /> החלטה עסקית פתוחה
          </p>
          <p className="text-xs text-warning-text/90">
            מה קורה כשאין התחייבות מ{commitment.source} בזמן ההזמנה — עדיין לא הוכרע. שתי החלופות שנשקלות
            משורטטות כאן כדי שיהיה אפשר להשוות ביניהן, ואף אחת מהן אינה סופית.
          </p>

          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-white/60 bg-white p-4">
              <p className="text-sm font-semibold text-slate-800">חלופה א׳ — שריון ללא תשלום</p>
              <p className="mt-1 text-xs text-slate-500">
                התור נשמר, וההתחייבות מועלית עד מועד הביקור. אם היא לא תגיע — התור מבוטל. אין חשיפה כספית
                למטופל, אבל גם אין מה שמונע ביטולים ברגע האחרון.
              </p>
              <Button variant="outline" size="sm" className="mt-3 w-full" disabled>
                שריון ללא תשלום (לא מיושם — לשרטוט בלבד)
              </Button>
            </div>

            <div className="rounded-xl border border-white/60 bg-white p-4">
              <p className="text-sm font-semibold text-slate-800">חלופה ב׳ — פיקדון שיוחזר</p>
              <p className="mt-1 text-xs text-slate-500">
                גובים {formatCurrency(depositAmount)} כפיקדון. כשההתחייבות מגיעה — הסכום מוחזר במלואו. מגן
                מפני אי-הגעה, אבל גובה כסף משירות שאמור להיות חינם.
              </p>
              <Button size="sm" className="mt-3 w-full" loading={submitting} onClick={onPayDepositInstead}>
                המשך לתשלום פיקדון {formatCurrency(depositAmount)}
              </Button>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-warning-text/80">
            לבירור מול יוטי: האם גביית פיקדון מותרת כשהשירות ממומן על ידי {commitment.source}, ומי נושא בעלות
            הביטול כשההתחייבות לא מגיעה.
          </p>
        </div>
      )}
    </div>
  );
}
