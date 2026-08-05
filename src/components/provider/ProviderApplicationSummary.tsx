"use client";

import { ReactNode } from "react";
import { FileCheck2, BadgeCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { ProviderProfile, UploadedFile } from "@/types";
import { PROVIDER_TYPE_LABELS, DOCTOR_SUBTYPE_LABELS } from "@/types";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{children || "—"}</p>
    </div>
  );
}

function DocRow({ label, file }: { label: string; file?: UploadedFile }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-slate-700">
        <FileCheck2 className={`h-4 w-4 ${file ? "text-success" : "text-slate-300"}`} />
        {label}
      </span>
      <span className={file ? "text-xs font-medium text-success-text" : "text-xs text-slate-400"}>
        {file ? file.file_name : "לא צורף"}
      </span>
    </div>
  );
}

/** Read-only recap of what the provider submitted in their application (type,
 * specialty/category, license, documents) — surfaced FIRST inside onboarding so
 * they can see everything Healson already has on file while they finish setup. */
export function ProviderApplicationSummary({ provider }: { provider: ProviderProfile }) {
  const documents: { label: string; file?: UploadedFile }[] = [
    { label: "צילום תעודת זהות", file: provider.id_document_photo },
    { label: "רישיון מקצועי", file: provider.license_file },
    ...(provider.specialist_license_file || provider.specialist_license_number
      ? [{ label: "תעודת מומחה", file: provider.specialist_license_file }]
      : []),
    { label: "קורות חיים / תעודות", file: provider.medical_resume_file },
    ...(provider.doctor_subtype === "surgeon"
      ? [
          { label: "תעודת מומחיות (בורד)", file: provider.surgical_board_certificate },
          { label: "ביטוח אחריות מקצועית", file: provider.malpractice_insurance_file },
        ]
      : []),
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <BadgeCheck className="h-4 w-4 text-primary" />
        <div>
          <CardTitle>פרטי הבקשה שלך</CardTitle>
          <p className="text-xs text-slate-500">הפרטים והמסמכים שהגשת ואומתו על ידי צוות Healson</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="סוג ספק">
            {provider.provider_type ? PROVIDER_TYPE_LABELS[provider.provider_type] : ""}
          </Field>
          {provider.doctor_subtype && (
            <Field label="סיווג">{DOCTOR_SUBTYPE_LABELS[provider.doctor_subtype]}</Field>
          )}
          <Field label="תחום התמחות">{provider.specialty}</Field>
          {(provider.sub_specialties?.length ?? 0) > 0 && (
            <Field label="תתי-התמחות">{provider.sub_specialties!.join(", ")}</Field>
          )}
          {/* A free-text sub-specialty is not part of the profile until Healson
              approves it — say so rather than showing it as a fact. */}
          {(provider.sub_specialty_requests ?? []).some((r) => r.status === "pending") && (
            <Field label='תת-התמחות "אחר" — ממתינה לאישור'>
              {provider
                .sub_specialty_requests!.filter((r) => r.status === "pending")
                .map((r) => r.value)
                .join(", ")}
            </Field>
          )}
          <Field label="מספר רישיון">
            {provider.license_number && <span className="font-mono">{provider.license_number}</span>}
          </Field>
          {provider.specialist_license_number && (
            <Field label="מספר רישיון מומחה">
              <span className="font-mono">{provider.specialist_license_number}</span>
            </Field>
          )}
          {provider.id_number && (
            <Field label="תעודת זהות">
              <span className="font-mono">{provider.id_number}</span>
            </Field>
          )}
          {provider.business_reg_number && (
            <Field label='ח"פ / עוסק'>
              <span className="font-mono">{provider.business_reg_number}</span>
            </Field>
          )}
          {(provider.member_provider_types?.length ?? 0) > 0 && (
            <Field label="סוגי ספקים במסגרת">
              {provider.member_provider_types!.map((t) => PROVIDER_TYPE_LABELS[t]).join(", ")}
            </Field>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500">מסמכים שצורפו</p>
          <div className="flex flex-col gap-2">
            {documents.map((d) => (
              <DocRow key={d.label} label={d.label} file={d.file} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
