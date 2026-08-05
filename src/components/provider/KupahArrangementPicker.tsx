"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { KLevel, K_LEVELS_BY_KUPAH, Kupah, KupahArrangement, KUPOT, PRIVATE_INSURANCE_COMPANIES } from "@/types";
import { cn } from "@/lib/utils";

/** Generic multi-select pill group — toggles a string in/out of a string[]. */
export function MultiSelectPills({
  label,
  options,
  value,
  onChange,
  getLabel = (option: string) => option,
}: {
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  getLabel?: (option: string) => string;
}) {
  function toggle(option: string) {
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              value.includes(option) ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {getLabel(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Which קופה+שב"ן-plan combinations a provider has an agreement with (§K layer).
 *
 * Two levels, in the order a provider actually thinks: first pick the קופה you
 * work with, and its שב"ן plans open up ALREADY SELECTED — holding an agreement
 * with מאוחדת almost always means both מאוחדת עדיף and מאוחדת שיא. Removing a
 * single plan stays one click away for the minority case, and unticking the
 * last plan of a קופה drops the קופה itself.
 *
 * A provider can hold more than one plan of the same קופה, so every plan is its
 * own independent record — the שב"ן level is never a single dropdown choice. */
export function KupahArrangementPicker({
  label = 'עם אילו קופות חולים ותוכניות שב"ן יש הסכם (K)',
  value,
  onChange,
}: {
  label?: string;
  value: KupahArrangement[];
  onChange: (value: KupahArrangement[]) => void;
}) {
  function levelsOf(kupah: Kupah): readonly KLevel[] {
    return K_LEVELS_BY_KUPAH[kupah];
  }

  function selectedLevels(kupah: Kupah): KupahArrangement[] {
    return value.filter((a) => a.kupah === kupah);
  }

  function toggleKupah(kupah: Kupah) {
    const picked = selectedLevels(kupah).length > 0;
    if (picked) {
      onChange(value.filter((a) => a.kupah !== kupah));
    } else {
      // Opening a קופה selects all of its plans — that is the common truth, and
      // unticking is cheaper than hunting for every plan you do hold.
      onChange([...value, ...levelsOf(kupah).map((level) => ({ kupah, level }))]);
    }
  }

  function toggleLevel(kupah: Kupah, level: KLevel) {
    const exists = value.some((a) => a.kupah === kupah && a.level === level);
    onChange(
      exists ? value.filter((a) => !(a.kupah === kupah && a.level === level)) : [...value, { kupah, level }]
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="grid gap-2 sm:grid-cols-2">
        {KUPOT.map((kupah) => {
          const picked = selectedLevels(kupah);
          const isOpen = picked.length > 0;
          return (
            <div
              key={kupah}
              className={cn(
                "rounded-xl border p-3 transition-colors",
                isOpen ? "border-primary/40 bg-primary/[0.04]" : "border-slate-200 bg-white"
              )}
            >
              <button
                type="button"
                onClick={() => toggleKupah(kupah)}
                aria-pressed={isOpen}
                className="flex w-full items-center gap-2 text-right"
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                    isOpen ? "border-primary bg-primary text-white" : "border-slate-300 bg-white"
                  )}
                >
                  {isOpen && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className={cn("text-sm font-medium", isOpen ? "text-slate-900" : "text-slate-600")}>
                  {kupah}
                </span>
                {isOpen && (
                  <span className="mr-auto text-[11px] text-slate-500">
                    {picked.length}/{levelsOf(kupah).length} תוכניות
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-primary/15 pt-2.5">
                  {levelsOf(kupah).map((level) => {
                    const active = picked.some((a) => a.level === level);
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => toggleLevel(kupah, level)}
                        aria-pressed={active}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                          active
                            ? "bg-primary text-white"
                            : "bg-white text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
                        )}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">
        בחירת קופה מסמנת אוטומטית את כל תוכניות השב&quot;ן שלה. אם אין לכם הסכם עם אחת מהן — פשוט הסירו אותה.
      </p>
    </div>
  );
}

/** Private health-insurance carriers a provider holds an arrangement with
 * (§B layer). Beyond the known carriers there is always a smaller/newer one, so
 * "אחר" is a real option — but only with its name written in, since layer-B
 * pricing matches this string against the patient's own policy. */
export function PrivateInsurerPicker({
  label = "עם אילו חברות ביטוח פרטיות יש הסדר (B)",
  value,
  onChange,
}: {
  label?: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const known = PRIVATE_INSURANCE_COMPANIES as readonly string[];
  const custom = value.filter((v) => !known.includes(v));
  const [otherOpen, setOtherOpen] = useState(custom.length > 0);
  const [otherText, setOtherText] = useState("");

  function toggle(company: string) {
    onChange(value.includes(company) ? value.filter((v) => v !== company) : [...value, company]);
  }

  function addOther() {
    const clean = otherText.trim();
    if (!clean || value.includes(clean)) {
      setOtherText("");
      return;
    }
    onChange([...value, clean]);
    setOtherText("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex flex-wrap gap-2">
        {known.map((company) => (
          <button
            key={company}
            type="button"
            onClick={() => toggle(company)}
            aria-pressed={value.includes(company)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              value.includes(company) ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {company}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOtherOpen((v) => !v)}
          aria-pressed={otherOpen}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            otherOpen || custom.length > 0
              ? "bg-primary text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          אחר
        </button>
      </div>

      {custom.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {custom.map((c) => (
            <span
              key={c}
              className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              {c}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== c))}
                aria-label={`הסרת ${c}`}
                className="text-primary/70 hover:text-primary"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {otherOpen && (
        <div className="flex items-center gap-2">
          <input
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addOther();
              }
            }}
            placeholder="שם חברת הביטוח"
            aria-label="שם חברת ביטוח אחרת"
            className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={addOther}
            disabled={!otherText.trim()}
            className="flex h-9 items-center gap-1 rounded-lg border border-primary/40 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/5 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> הוספה
          </button>
        </div>
      )}
    </div>
  );
}
