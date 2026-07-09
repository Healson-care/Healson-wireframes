"use client";

import { Input, Select } from "@/components/ui/Input";
import { KUPOT, KUPAH_LEVELS, Kupah, KLevel } from "@/types";

export interface InsuranceProfileValue {
  kupah: Kupah;
  k_level: KLevel | "";
  has_b_insurance: boolean;
  b_insurance_company: string;
  b_policy_number: string;
}

export const EMPTY_INSURANCE_PROFILE: InsuranceProfileValue = {
  kupah: "כללית",
  k_level: "",
  has_b_insurance: false,
  b_insurance_company: "",
  b_policy_number: "",
};

/** Patient insurance profile fields (§4.3) — kupah (S), optional K-level
 * (שב"ן), optional B (private health insurance). */
export function InsuranceProfileForm({
  value,
  onChange,
}: {
  value: InsuranceProfileValue;
  onChange: (value: InsuranceProfileValue) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Select
        label="קופת חולים"
        value={value.kupah}
        onChange={(e) => onChange({ ...value, kupah: e.target.value as Kupah, k_level: "" })}
        required
      >
        {KUPOT.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </Select>

      <Select
        label='רמת ביטוח קופה (שב"ן) — אופציונלי'
        value={value.k_level}
        onChange={(e) => onChange({ ...value, k_level: e.target.value as KLevel | "" })}
      >
        <option value="">אין ביטוח קופה נוסף</option>
        {KUPAH_LEVELS[value.kupah].map((level) => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </Select>

      <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={value.has_b_insurance}
          onChange={(e) => onChange({ ...value, has_b_insurance: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 accent-primary"
        />
        <span className="text-sm text-slate-700">יש לי ביטוח בריאות פרטי</span>
      </label>

      {value.has_b_insurance && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="חברת ביטוח"
            placeholder="כלל / הראל / מגדל..."
            value={value.b_insurance_company}
            onChange={(e) => onChange({ ...value, b_insurance_company: e.target.value })}
          />
          <Input
            label="מספר פוליסה (אופציונלי)"
            value={value.b_policy_number}
            onChange={(e) => onChange({ ...value, b_policy_number: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
