"use client";

import { ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { providerLabel } from "@/lib/search";
import { ConsultationType, ProviderProfile } from "@/types";

/**
 * The referral is a precondition, so it gets its own stage before any slot is
 * chosen — asking for it after the patient has already invested in picking a
 * time would be a trap. Only consultations skip this screen entirely.
 */
export function ReferralStep({
  provider,
  consultation,
  file,
  onFileChange,
  onBack,
  onContinue,
}: {
  provider: ProviderProfile;
  consultation?: ConsultationType;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="mx-auto max-w-md">
      <button onClick={onBack} className="focus-ring mb-4 flex items-center gap-1 text-sm text-primary">
        <ArrowRight className="h-3.5 w-3.5" /> חזרה לבחירה
      </button>

      <div className="mb-4 text-center">
        <h2 className="text-xl font-bold text-slate-900">העלאת הפניה</h2>
        <p className="mt-1 text-sm text-slate-500">
          {consultation?.name} אצל {providerLabel(provider)}
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <FileText className="h-4 w-4 shrink-0" /> הפניה תקפה מקופת החולים
        </p>
        <p className="mt-1 mb-3 text-xs text-slate-500">
          לשירות הזה נדרשת הפניה. לאחר בחירת המועד היא תישלח לאישור היחידה הרפואית, ורק לאחר האישור ייגבה תשלום.
        </p>
        <FileDropzone file={file} onFileChange={onFileChange} />

        <Button size="lg" className="mt-4 w-full" disabled={!file} onClick={onContinue}>
          {file ? "המשך לבחירת מועד" : "צרפו הפניה כדי להמשיך"}
        </Button>
      </div>

      <p className="mt-3 text-center text-[11px] text-slate-400">
        אין לכם הפניה? אפשר לבקש אותה מרופא המשפחה בקופה ולחזור לכאן — החיפוש שלכם יישמר.
      </p>
    </div>
  );
}
