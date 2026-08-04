"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// The faceted search resolves service AND provider on one screen, so there is
// no separate "בחירת רופא" stage. "מיקום"/"שעה" both happen inside SlotPicker
// — the page works out which of the two is still in progress and passes it in
// as `step`, so this component stays purely presentational.
export const SEARCH_FLOW_STEPS = ["בחירה", "מיקום", "שעה", "תשלום", "סיום"];

/**
 * Anything that isn't a consultation needs a kupah referral, and that adds
 * two stages the patient must see coming: uploading it before any slot is
 * picked, and the medical unit's review of it before any money is charged.
 */
export const REFERRAL_FLOW_STEPS = ["בחירה", "הפניה", "מיקום", "שעה", "אישור יחידה", "תשלום", "סיום"];

/**
 * Every stage, named, on one screen — including the ones still ahead, so the
 * patient can see what she's committing to before she starts. Completed
 * stages are buttons: going back is part of the journey, not an escape from
 * it. The row wraps rather than scrolling sideways, because a stage she'd
 * have to swipe to discover may as well not be shown.
 */
export function BookingStepper({
  step,
  steps = SEARCH_FLOW_STEPS,
  onStepSelect,
}: {
  step: number;
  steps?: string[];
  /** Called with a completed stage's index. Omit to render a static meter. */
  onStepSelect?: (index: number) => void;
}) {
  const percent = ((step + 1) / steps.length) * 100;

  return (
    <div className="mx-auto mb-6 w-full max-w-3xl">
      <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-l from-primary to-primary-dark transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
        {steps.map((label, i) => {
          const done = i < step;
          const current = i === step;
          const canReturn = done && !!onStepSelect;
          const Tag = canReturn ? "button" : "span";

          return (
            <Tag
              key={label}
              {...(canReturn
                ? { onClick: () => onStepSelect(i), type: "button" as const, title: `חזרה ל${label}` }
                : {})}
              aria-current={current ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                current && "border-primary bg-primary text-white shadow-sm",
                done && "border-primary/30 bg-primary/5 text-primary",
                canReturn && "focus-ring hover:border-primary hover:bg-primary/10",
                !done && !current && "border-slate-200 bg-white text-slate-400"
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                  current && "bg-white text-primary",
                  done && "bg-primary text-white",
                  !done && !current && "bg-slate-100 text-slate-400"
                )}
              >
                {done ? <Check className="h-2.5 w-2.5" /> : i + 1}
              </span>
              {label}
            </Tag>
          );
        })}
      </div>

      {onStepSelect && step > 0 && (
        <p className="mt-1.5 text-[10px] text-slate-400">אפשר להקיש על שלב שהושלם כדי לחזור אליו</p>
      )}
    </div>
  );
}
