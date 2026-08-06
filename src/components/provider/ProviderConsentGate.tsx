"use client";

import { ShieldCheck } from "lucide-react";
import {
  PROVIDER_CONSENT_HINTS,
  PROVIDER_CONSENT_LABELS,
  PROVIDER_CONSENT_REQUIRED,
  PROVIDER_CONSENT_VERSION,
  ProviderConsentType,
} from "@/types";
import { cn } from "@/lib/utils";

/**
 * The privacy-law consent gate (חוק הגנת הפרטיות + תיקון 13).
 *
 * Used at BOTH points where the law requires it, with a different `types` list:
 *   • /apply, above "צור חשבון" — before a single personal detail is stored;
 *   • before identity documents ("מידע בעל רגישות מיוחדת") are collected — a
 *     separate, explicit consent. For a solo provider (נותן שירות יחיד) this is
 *     its own screen straight after the phone verification, blocking the way
 *     into "זיהוי, מקצוע ורישוי"; for organizations and stores it sits inside
 *     that step, above the uploads it covers.
 *
 * Consents are never pre-ticked and never bundled into one box: each purpose is
 * its own decision, which is what makes it הסכמה מדעת. The parent owns the
 * state and calls the store (registerProviderAccount / recordProviderConsents)
 * so every grant is written with its version + timestamp.
 */
export function ProviderConsentGate({
  types,
  value,
  onChange,
  title = "הסכמות ופרטיות",
  description,
  className,
}: {
  types: ProviderConsentType[];
  value: Record<string, boolean>;
  onChange: (value: Record<string, boolean>) => void;
  title?: string;
  description?: string;
  className?: string;
}) {
  function toggle(type: ProviderConsentType, checked: boolean) {
    onChange({ ...value, [type]: checked });
  }

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-slate-50/70 p-3.5", className)}>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" /> {title}
      </p>
      {description && <p className="mb-2.5 text-[11px] leading-relaxed text-slate-500">{description}</p>}

      <div className="flex flex-col gap-2.5">
        {types.map((type) => {
          const required = PROVIDER_CONSENT_REQUIRED[type];
          const hint = PROVIDER_CONSENT_HINTS[type];
          return (
            <label key={type} className="flex cursor-pointer items-start gap-2 text-[12px] leading-relaxed">
              <input
                type="checkbox"
                checked={!!value[type]}
                onChange={(e) => toggle(type, e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-primary"
                aria-describedby={hint ? `${type}-hint` : undefined}
              />
              <span className="text-slate-700">
                {PROVIDER_CONSENT_LABELS[type]}
                {required ? (
                  <span className="text-danger"> *</span>
                ) : (
                  <span className="text-slate-400"> (לא חובה)</span>
                )}
                {hint && (
                  <span id={`${type}-hint`} className="mt-0.5 block text-[11px] text-slate-500">
                    {hint}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      <p className="mt-2.5 border-t border-slate-200 pt-2 text-[10px] leading-relaxed text-slate-400">
        גרסת מסמך {PROVIDER_CONSENT_VERSION} · ההסכמה נשמרת עם תאריך ושעה. באפשרותך לעיין במידע שנשמר עליך,
        לתקן אותו או לבקש את מחיקתו בכל עת דרך הפורטל או בפנייה ל-privacy@healson.co.il. מדיניות הפרטיות
        ותנאי השימוש המלאים זמינים באתר Healson.
      </p>
    </div>
  );
}

/** True once every consent the law makes mandatory in this gate is ticked. */
export function consentGateSatisfied(types: ProviderConsentType[], value: Record<string, boolean>): boolean {
  return types.every((t) => !PROVIDER_CONSENT_REQUIRED[t] || !!value[t]);
}

/** The grants, in the shape the store actions take. */
export function consentGrants(types: ProviderConsentType[], value: Record<string, boolean>) {
  return types.map((type) => ({ type, granted: !!value[type] }));
}
