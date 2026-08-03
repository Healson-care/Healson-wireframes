"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { B_INSURANCE_COMPANIES, KUPOT, K_LEVELS_BY_KUPAH, Kupah, KLevel, PatientInsurance } from "@/types";

const OTHER_COMPANY = "אחר";

export interface InsuranceProfileValue {
  // "" plays two roles: the not-yet-picked placeholder (blocked by the
  // Select's `required` for ת"ז holders, so it can never be submitted), and
  // the meaningful "no Israeli kupah" choice (tourist/no institutional
  // coverage) when the caller passes allowNoKupah (see below).
  kupah: Kupah | "";
  k_level: KLevel | "";
  // A patient can hold several private policies at once (unlike kupah,
  // which is single by law) — "has private insurance" is just
  // b_insurances.length > 0, not a separate field.
  b_insurances: PatientInsurance[];
  address: string;
}

// kupah starts unpicked on purpose — a prefilled "כללית" let users click
// straight through and get saved with the wrong kupah, which feeds pricing
// (getPatientLayers). The required Select forces an active choice instead.
export const EMPTY_INSURANCE_PROFILE: InsuranceProfileValue = {
  kupah: "",
  k_level: "",
  b_insurances: [],
  address: "",
};

const EMPTY_B_INSURANCE: PatientInsurance = { company: "", policy_number: "" };

/** Patient insurance profile fields (§4.3) — kupah (S), optional K-level
 * (שב"ן), optional B (one or more private health insurance policies). */
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
  // "אחר" even though the underlying field is momentarily "" — keyed by row
  // index, same reasoning as the old single-insurance local flag.
  const [otherPickedRows, setOtherPickedRows] = useState<Record<number, boolean>>({});

  const hasBInsurance = value.b_insurances.length > 0;

  function updateRow(index: number, patch: Partial<PatientInsurance>) {
    onChange({
      ...value,
      b_insurances: value.b_insurances.map((ins, i) => (i === index ? { ...ins, ...patch } : ins)),
    });
  }

  function removeRow(index: number) {
    onChange({ ...value, b_insurances: value.b_insurances.filter((_, i) => i !== index) });
    setOtherPickedRows((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Select
        label="קופת חולים"
        value={value.kupah}
        onChange={(e) => onChange({ ...value, kupah: e.target.value as Kupah | "", k_level: "" })}
        required={!allowNoKupah}
      >
        {/* For ת"ז holders "" is only a placeholder (required blocks it);
            for passport holders "" is the real tourist option below, which
            therefore doubles as their pre-selected default. */}
        {!allowNoKupah && <option value="">בחרו קופת חולים</option>}
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
          checked={hasBInsurance}
          onChange={(e) => onChange({ ...value, b_insurances: e.target.checked ? [{ ...EMPTY_B_INSURANCE }] : [] })}
          className="h-4 w-4 rounded border-slate-300 accent-primary"
        />
        <span className="text-sm text-slate-700">יש לי ביטוח בריאות פרטי</span>
      </label>

      {hasBInsurance && (
        <div className="flex flex-col gap-2">
          {value.b_insurances.map((ins, index) => {
            const isOtherCompany = ins.company ? !B_INSURANCE_COMPANIES.includes(ins.company) : otherPickedRows[index];
            return (
              <div key={index} className="rounded-lg border border-slate-200 p-3 flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    <Select
                      label="חברת ביטוח"
                      value={isOtherCompany ? OTHER_COMPANY : ins.company}
                      onChange={(e) => {
                        const next = e.target.value;
                        setOtherPickedRows((prev) => ({ ...prev, [index]: next === OTHER_COMPANY }));
                        updateRow(index, { company: next === OTHER_COMPANY ? "" : next });
                      }}
                      required
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
                      value={ins.policy_number ?? ""}
                      onChange={(e) => updateRow(index, { policy_number: e.target.value })}
                    />
                  </div>
                  {value.b_insurances.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      aria-label="הסר ביטוח"
                      className="mt-6 shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {isOtherCompany && (
                  <Input
                    label="שם חברת הביטוח"
                    placeholder="הזינו את שם חברת הביטוח"
                    value={ins.company}
                    onChange={(e) => updateRow(index, { company: e.target.value })}
                    required
                  />
                )}
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => onChange({ ...value, b_insurances: [...value.b_insurances, { ...EMPTY_B_INSURANCE }] })}
          >
            <Plus className="h-4 w-4" /> הוסף ביטוח נוסף
          </Button>
        </div>
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
