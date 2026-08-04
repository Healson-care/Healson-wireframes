"use client";

import { CONSENT_LABELS, CONSENT_REQUIRED, CONSENT_TYPES, ConsentType } from "@/types";

export type ConsentValues = Partial<Record<ConsentType, boolean>>;

/** The 4 separate consent checkboxes required by §4.2 / §11.1 — 2 mandatory
 * (health data storage, provider transfer), 2 optional (analytics, marketing). */
export function ConsentCheckboxes({
  value,
  onChange,
}: {
  value: ConsentValues;
  onChange: (value: ConsentValues) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {CONSENT_TYPES.map((type) => {
        const required = CONSENT_REQUIRED[type];
        const checked = !!value[type];
        return (
          <label
            key={type}
            className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3.5 cursor-pointer hover:border-primary/40"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onChange({ ...value, [type]: e.target.checked })}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-primary"
            />
            <span className="text-sm text-slate-700">
              {CONSENT_LABELS[type]}{" "}
              <span className={required ? "text-danger-text text-xs font-medium" : "text-slate-400 text-xs"}>
                {required ? "(חובה)" : "(אופציונלי)"}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function areRequiredConsentsChecked(value: ConsentValues): boolean {
  return CONSENT_TYPES.every((type) => !CONSENT_REQUIRED[type] || value[type]);
}
