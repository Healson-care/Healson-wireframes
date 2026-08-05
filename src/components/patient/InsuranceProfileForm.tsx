"use client";

import { useState } from "react";
import { ChevronDown, Paperclip, Plus, Trash2 } from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { fileToDataUrl } from "@/lib/file";
import { cn } from "@/lib/utils";
import {
  B_INSURANCE_COMPANIES,
  INSURANCE_AGENTS_BY_COMPANY,
  KUPOT,
  K_LEVELS_BY_KUPAH,
  Kupah,
  KLevel,
  PatientInsurance,
} from "@/types";

const OTHER_COMPANY = "אחר";
const OTHER_AGENT = "אחר";

const AGENTS_BY_COMPANY = INSURANCE_AGENTS_BY_COMPANY as Record<string, string[] | undefined>;

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

const EMPTY_B_INSURANCE: PatientInsurance = { company: "" };

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
  // Same trick for the agent picker — "אחר" selected but nothing typed yet.
  const [otherAgentRows, setOtherAgentRows] = useState<Record<number, boolean>>({});
  // The policy upload is a bonus, so it ships collapsed — open only where the
  // patient asked for it. Registration must not grow a file picker's worth of
  // height for something nobody is required to provide.
  const [policyOpenRows, setPolicyOpenRows] = useState<Record<number, boolean>>({});
  // The File as just picked, kept only so FileDropzone can show its name and a
  // remove button. The durable value is `policy_document` on the row.
  const [policyFileRows, setPolicyFileRows] = useState<Record<number, File | null>>({});

  async function setPolicyFile(index: number, file: File | null) {
    setPolicyFileRows((prev) => ({ ...prev, [index]: file }));
    if (!file) {
      updateRow(index, { policy_document: undefined });
      return;
    }
    updateRow(index, {
      policy_document: {
        file_name: file.name,
        uploaded_at: new Date().toISOString(),
        data_url: await fileToDataUrl(file),
      },
    });
  }

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
    setOtherAgentRows((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setPolicyOpenRows((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setPolicyFileRows((prev) => {
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
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
            <p className="text-xs font-semibold text-primary">למה כדאי לציין את שם הסוכן?</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              לכל סוכן ביטוח יש הסכמים ותנאים משלו מול חברות הביטוח. כשאנחנו יודעים מי הסוכן שלכם, נוכל להציג לכם את
              המחיר המדויק שמגיע לכם לפי הפוליסה — ולטפל בהחזר מול הסוכן ישירות, בלי שתצטרכו לרדוף אחריו.
            </p>
          </div>
          {value.b_insurances.map((ins, index) => {
            // "אחר" — a carrier the patient typed that isn't on the canonical
            // list (the list is `as const`, hence the widened compare).
            const isOtherCompany = ins.company
              ? !(B_INSURANCE_COMPANIES as readonly string[]).includes(ins.company)
              : otherPickedRows[index];
            // A carrier typed as "אחר" has no agent roster of its own, so
            // that case skips the picker and asks for the name directly.
            const companyAgents = AGENTS_BY_COMPANY[ins.company] ?? [];
            const agentName = ins.agent_name ?? "";
            const isOtherAgent = agentName ? !companyAgents.includes(agentName) : otherAgentRows[index];
            return (
              <div key={index} className="rounded-lg border border-slate-200 p-3 flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <Select
                      label="חברת ביטוח"
                      value={isOtherCompany ? OTHER_COMPANY : ins.company}
                      onChange={(e) => {
                        const next = e.target.value;
                        setOtherPickedRows((prev) => ({ ...prev, [index]: next === OTHER_COMPANY }));
                        // Agents are carrier-specific — keeping the old pick
                        // would leave e.g. a מגדל agent attached to a הפניקס
                        // policy.
                        setOtherAgentRows((prev) => ({ ...prev, [index]: false }));
                        updateRow(index, { company: next === OTHER_COMPANY ? "" : next, agent_name: "" });
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
                {ins.company &&
                  (companyAgents.length > 0 ? (
                    <>
                      <Select
                        label="שם סוכן הביטוח (מומלץ)"
                        value={isOtherAgent ? OTHER_AGENT : agentName}
                        onChange={(e) => {
                          const next = e.target.value;
                          setOtherAgentRows((prev) => ({ ...prev, [index]: next === OTHER_AGENT }));
                          updateRow(index, { agent_name: next === OTHER_AGENT ? "" : next });
                        }}
                      >
                        <option value="">לא ידוע / אין סוכן</option>
                        {companyAgents.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                        <option value={OTHER_AGENT}>אחר</option>
                      </Select>
                      {isOtherAgent && (
                        <Input
                          label="שם הסוכן"
                          placeholder="הזינו את שם סוכן הביטוח"
                          value={agentName}
                          onChange={(e) => updateRow(index, { agent_name: e.target.value })}
                        />
                      )}
                    </>
                  ) : (
                    <Input
                      label="שם סוכן הביטוח (מומלץ)"
                      placeholder="הזינו את שם סוכן הביטוח"
                      value={agentName}
                      onChange={(e) => updateRow(index, { agent_name: e.target.value })}
                    />
                  ))}

                {/* Bonus, never a condition — so it is one quiet line until
                    tapped, and says up front that skipping it is fine. A
                    filed policy still shows its name while collapsed, so the
                    row never hides work the patient already did. */}
                <div className="border-t border-slate-100 pt-2">
                  <button
                    type="button"
                    onClick={() => setPolicyOpenRows((prev) => ({ ...prev, [index]: !prev[index] }))}
                    aria-expanded={!!policyOpenRows[index]}
                    className="focus-ring flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-right text-xs text-slate-600 hover:bg-slate-50"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">
                        צירוף מסמך הפוליסה
                        <span className="text-slate-400"> · אופציונלי</span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {ins.policy_document && !policyOpenRows[index] && (
                        <span className="max-w-[9rem] truncate text-[11px] font-medium text-success-text">
                          {ins.policy_document.file_name}
                        </span>
                      )}
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform",
                          policyOpenRows[index] && "rotate-180"
                        )}
                      />
                    </span>
                  </button>

                  {policyOpenRows[index] && (
                    <div className="mt-2 flex flex-col gap-2">
                      <p className="text-[11px] leading-relaxed text-slate-500">
                        לא חובה, ואפשר גם מאוחר יותר. הפוליסה עצמה מכילה את התנאים, המספר והתאריכים — כך שנוכל
                        לדייק לכם את המחיר ואת ההחזר בלי שתצטרכו לחפש מספרים.
                      </p>
                      <FileDropzone
                        file={policyFileRows[index] ?? null}
                        onFileChange={(file) => void setPolicyFile(index, file)}
                        existingFileName={policyFileRows[index] ? undefined : ins.policy_document?.file_name}
                        ariaLabel="העלאת מסמך פוליסת ביטוח"
                      />
                    </div>
                  )}
                </div>
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
            label="כתובת"
            placeholder="רחוב, מספר, עיר"
            value={value.address}
            onChange={(e) => onChange({ ...value, address: e.target.value })}
            required
          />
          <p className="text-xs text-slate-400 -mt-2">לצורך שליחת תוצאות בדיקות ומול חברות הביטוח</p>
        </>
      )}
    </div>
  );
}
