"use client";

import { Check, ChevronDown, ListFilter } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { cn } from "@/lib/utils";

/** Single "filter" button that opens a dropdown list of single-select
 * options — one line regardless of how many options exist, instead of a
 * row of chips that wraps to 2-3 lines on a narrow screen. `value: null`
 * means "no filter" / "all". */
export function FilterDropdown({
  value,
  options,
  allLabel = "הכל",
  onSelect,
}: {
  value: string | null;
  options: { value: string; label: string }[];
  allLabel?: string;
  onSelect: (value: string | null) => void;
}) {
  const activeLabel = value === null ? allLabel : options.find((o) => o.value === value)?.label ?? allLabel;

  return (
    <Popover
      trigger={
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            value !== null
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
      {(close) => (
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => {
              onSelect(null);
              close();
            }}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-right text-sm transition-colors",
              value === null ? "bg-primary/10 font-medium text-primary" : "text-slate-700 hover:bg-slate-50"
            )}
          >
            {allLabel}
            {value === null && <Check className="h-3.5 w-3.5" />}
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onSelect(opt.value);
                close();
              }}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-right text-sm transition-colors",
                value === opt.value ? "bg-primary/10 font-medium text-primary" : "text-slate-700 hover:bg-slate-50"
              )}
            >
              {opt.label}
              {value === opt.value && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}
