"use client";

import { KLevel, K_LEVELS_BY_KUPAH, Kupah, KupahArrangement, KUPOT } from "@/types";

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

/** Which קופה+שב"ן-plan combinations a provider has an agreement with (§K layer)
 * — a provider can hold more than one plan of the same קופה (e.g. both
 * "מאוחדת עדיף" and "מאוחדת שיא"), so every plan is its own independent toggle
 * rather than one dropdown-selected level per קופה. */
export function KupahArrangementPicker({
  label = 'עם אילו קופות חולים ותוכניות שב"ן יש הסכם (K)',
  value,
  onChange,
}: {
  label?: string;
  value: KupahArrangement[];
  onChange: (value: KupahArrangement[]) => void;
}) {
  function toggle(kupah: Kupah, level: KLevel) {
    const exists = value.some((a) => a.kupah === kupah && a.level === level);
    onChange(
      exists ? value.filter((a) => !(a.kupah === kupah && a.level === level)) : [...value, { kupah, level }]
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex flex-col gap-2.5">
        {KUPOT.map((kupah) => (
          <div key={kupah}>
            <p className="text-xs text-slate-400 mb-1">{kupah}</p>
            <div className="flex flex-wrap gap-2">
              {K_LEVELS_BY_KUPAH[kupah].map((level) => {
                const active = value.some((a) => a.kupah === kupah && a.level === level);
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => toggle(kupah, level)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      active ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
