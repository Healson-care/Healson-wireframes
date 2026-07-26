"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/Input";
import { B_INSURANCE_COMPANIES, KUPOT, K_LEVELS_BY_KUPAH, Kupah, KLevel } from "@/types";

const OTHER_COMPANY = "אחר";

export interface InsuranceProfileValue {
  // "" = no Israeli kupah (tourist/no institutional coverage) — only ever a
  // valid choice when the caller passes allowNoKupah (see below).
  kupah: Kupah | "";
  k_level: KLevel | "";
  has_b_insurance: boolean;
  b_insurance_company: string;
  b_policy_number: string;
  address: string;
}

export const EMPTY_INSURANCE_PROFILE: InsuranceProfileValue = {
  kupah: "כללית",
  k_level: "",
  has_b_insurance: false,
  b_insurance_company: "",
  b_policy_number: "",
  address: "",
};

/** Patient insurance profile fields (§4.3) — kupah (S), optional K-level
 * (שב"ן), optional B (private health insurance). */
export function InsuranceProfileForm({
  value,
  onChange,
  showAddress = true,
  allowNoKupah = false,
}: {
  value: InsuranceProfileValue;
  onChange: (value: InsuranceProfileValue) => void;
  showAddress?: boolean;
  // "אין לי קופת חולים" only makes sense — and is only offered — for
  // someone who already declared no Israeli citizenship (passport, not
  // ת"ז, as their ID document). An ת"ז holder must always pick a real kupah.
  allowNoKupah?: boolean;
}) {
  // "אחר" chosen but no free text typed yet still needs the picker to show
  // "אחר" even though the underlying field is momentarily "" — hence this
  // local flag rather than deriving purely from value.b_insurance_company.
  const [otherPicked, setOtherPicked] = useState(false);
  const isOtherCompany = value.b_insurance_company
    ? !B_INSURANCE_COMPANIES.includes(value.b_insurance_company)
    : otherPicked;

  return (
    <div className="flex flex-col gap-3">
      <Select
        label="קופת חולים"
        value={value.kupah}
        onChange={(e) => onChange({ ...value, kupah: e.target.value as Kupah | "", k_level: "" })}
        required={!allowNoKupah}
      >
        {KUPOT.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
        {allowNoKupah && <option value="">אין לי קופת חולים (תייר)</option>}
      </Select>

      {value.kupah && (
        <Select
          label='רמת ביטוח קופה (שב"ן) — אופציונלי'
          value={value.k_level}
          onChange={(e) => onChange({ ...value, k_level: e.target.value as KLevel | "" })}
        >
          <option value="">אין ביטוח קופה נוסף</option>
          {K_LEVELS_BY_KUPAH[value.kupah].map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </Select>
      )}

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
          <Select
            label="חברת ביטוח"
            value={isOtherCompany ? OTHER_COMPANY : value.b_insurance_company}
            onChange={(e) => {
              const next = e.target.value;
              setOtherPicked(next === OTHER_COMPANY);
              onChange({ ...value, b_insurance_company: next === OTHER_COMPANY ? "" : next });
            }}
          >
            <option value="">בחרו חברה</option>
            {B_INSURANCE_COMPANIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={OTHER_COMPANY}>אחר</option>
          </Select>
          <Input
            label="מספר פוליסה (אופציונלי)"
            value={value.b_policy_number}
            onChange={(e) => onChange({ ...value, b_policy_number: e.target.value })}
          />
        </div>
      )}

      {isOtherCompany && (
        <Input
          label="שם חברת הביטוח"
          placeholder="הזינו את שם חברת הביטוח"
          value={value.b_insurance_company}
          onChange={(e) => onChange({ ...value, b_insurance_company: e.target.value })}
        />
      )}

      {showAddress && (
        <>
          <Input
            label="כתובת (אופציונלי)"
            placeholder="רחוב, מספר, עיר"
            value={value.address}
            onChange={(e) => onChange({ ...value, address: e.target.value })}
          />
          <p className="text-xs text-slate-400 -mt-2">לצורך שליחת תוצאות בדיקות ומול חברות הביטוח</p>
        </>
      )}
    </div>
  );
}
