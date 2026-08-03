"use client";

/** The compact inline filter used by both schedule calendars (availability and
 * appointments) — a label + select that reads as one chip, so a row of them
 * doesn't tower over the calendar it filters. */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
      <span className="font-medium text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="focus-ring max-w-[10rem] cursor-pointer truncate bg-transparent text-xs font-medium text-slate-800 outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
