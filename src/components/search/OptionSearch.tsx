"use client";

import { Search } from "lucide-react";

/**
 * The free-text field every gate list wears at its top. One component rather
 * than one per gate, so the field looks and behaves identically wherever a
 * list appears — a real catalogue is longer than anyone wants to scroll, and
 * she usually already knows the word she's after.
 */
export function OptionSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="mx-3 mb-1 flex items-center gap-1.5 rounded-lg border border-slate-200 px-2">
      <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        // 40px on a touch screen, and 16px text so iOS doesn't zoom the page
        // the moment the field takes focus.
        className="h-10 w-full bg-transparent text-base outline-none placeholder:text-slate-400 sm:h-8 sm:text-xs"
      />
    </div>
  );
}
