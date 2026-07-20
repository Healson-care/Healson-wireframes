"use client";

import { Check, ChevronDown, ListFilter } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { cn } from "@/lib/utils";

/** Single "filter" button that opens a dropdown list of multi-select
 * options (checkboxes) — one line regardless of how many options exist,
 * instead of a row of chips that wraps to 2-3 lines on a narrow screen.
 * `values: []` means "no filter" / "all". Picking options doesn't close
 * the list, so several can be toggled in one go — dismiss by tapping
 * outside or pressing Escape. */
export function FilterDropdown({
  values,
  options,
  allLabel = "הכל",
  onChange,
}: {
  values: string[];
  options: { value: string; label: string }[];
  allLabel?: string;
  onChange: (values: string[]) => void;
}) {
  const activeLabel =
    values.length === 0
      ? allLabel
      : values.length === 1
      ? options.find((o) => o.value === values[0])?.label ?? allLabel
      : `${values.length} נבחרו`;

  function toggle(value: string) {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  }

  return (
    <Popover
      trigger={
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            values.length > 0
              ? "border-primary bg-primary/5 text-primary"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          )}
        >
          <ListFilter className="h-3.5 w-3.5" />
          {activeLabel}
          <ChevronDown className="h-3.5 w-3.5" />
        </span>
      }
    >
      {() => (
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => onChange([])}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-right text-sm transition-colors",
              values.length === 0 ? "bg-primary/10 font-medium text-primary" : "text-slate-700 hover:bg-slate-50"
            )}
          >
            {allLabel}
            {values.length === 0 && <Check className="h-3.5 w-3.5" />}
          </button>
          <div className="h-px bg-slate-100 my-0.5" />
          {options.map((opt) => {
            const checked = values.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-right text-sm transition-colors",
                  checked ? "font-medium text-primary" : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    checked ? "border-primary bg-primary text-white" : "border-slate-300"
                  )}
                >
                  {checked && <Check className="h-3 w-3" />}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </Popover>
  );
}
