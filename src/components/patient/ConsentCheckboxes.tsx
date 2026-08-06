"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
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
  const [policyOpen, setPolicyOpen] = useState(false);
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

      {/* Under the boxes, not inside one: reading the policy is not a fifth
          thing to tick, and putting it in the list would imply it is. It stays
          a link so consenting never depends on having opened it. */}
      <p className="border-t border-slate-100 pt-2.5 text-[11px] leading-relaxed text-slate-400">
        ההסכמות נשמרות עם תאריך ושעה. לפרטים על אופן השימוש בנתונים שלכם, שמירתם ומחיקתם —{" "}
        <button
          type="button"
          onClick={() => setPolicyOpen(true)}
          className="focus-ring font-medium text-primary underline decoration-dotted underline-offset-2"
        >
          מדיניות הפרטיות
        </button>
        .
      </p>

      <Dialog
        open={policyOpen}
        onClose={() => setPolicyOpen(false)}
        title="מדיניות פרטיות"
        description="נוסח זמני — המסמך המלא בהכנה"
      >
        {/* Deliberately NOT draft legal text: a placeholder that reads like a
            policy is one copy-paste away from shipping as if it were one. This
            says what the document will cover and nothing more. */}
        <div className="flex flex-col gap-3 text-sm leading-relaxed text-slate-600">
          <p className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-bg p-3 text-xs text-warning-text">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            הנוסח המחייב טרם הושלם. המסמך יפורסם כאן לפני עלייה לאוויר, וההסכמה תתועד מול גרסתו.
          </p>
          <p>המסמך יכסה, בין היתר:</p>
          <ul className="list-inside list-disc space-y-1 text-xs">
            <li>אילו נתונים נאספים ולאיזו מטרה</li>
            <li>מי רשאי לצפות במידע הרפואי ומתי הוא מועבר לנותן השירות</li>
            <li>משך שמירת המידע ואופן מחיקתו</li>
            <li>זכויות העיון, התיקון והמחיקה, והדרך לממש אותן</li>
          </ul>
        </div>
      </Dialog>
    </div>
  );
}

export function areRequiredConsentsChecked(value: ConsentValues): boolean {
  return CONSENT_TYPES.every((type) => !CONSENT_REQUIRED[type] || value[type]);
}
