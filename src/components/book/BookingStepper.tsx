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
 * The route decides the journey. Where the payer settles by undertaking —
 * the kupah for a basket service, the insurer for surgery — nothing is
 * charged, so that stage collects the document instead of money: same
 * position in the flow, different act.
 */
export function flowStepsFor({
  referral,
  commitment,
  singleLocation,
}: {
  referral: boolean;
  commitment: boolean;
  /** The service is given at one place only, so no location is ever chosen. */
  singleLocation?: boolean;
}): string[] {
  const steps = [...(referral ? REFERRAL_FLOW_STEPS : SEARCH_FLOW_STEPS)];
  if (commitment) {
    const payIndex = steps.indexOf("תשלום");
    if (payIndex !== -1) steps[payIndex] = "התחייבות";
  }
  if (singleLocation) {
    const locationIndex = steps.indexOf("מיקום");
    if (locationIndex !== -1) steps.splice(locationIndex, 1);
  }
  return steps;
}

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

      {/* Every stage, named, at every width — the whole route has to be
          readable in advance. On a phone that can't be one line, so it's an
          even grid rather than a wrapped row: four then three reads as
          structure, where an accidental wrap reads as breakage. */}
      <div className="grid grid-cols-4 gap-1.5 sm:flex sm:items-center sm:gap-1">
        {steps.map((label, i) => {
          const done = i < step;
          const current = i === step;
          const canReturn = done && !!onStepSelect;
          const Tag = canReturn ? "button" : "span";

          return (
            <div key={label} className="flex min-w-0 items-center gap-1">
              <Tag
                {...(canReturn
                  ? { onClick: () => onStepSelect(i), type: "button" as const, title: `חזרה ל${label}` }
                  : {})}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex w-full min-w-0 items-center justify-center gap-1 rounded-full px-1.5 py-1 text-[10px] font-semibold transition-colors sm:w-auto sm:justify-start sm:gap-1.5 sm:px-2.5 sm:text-[11px]",
                  current
                    ? "bg-[var(--brand-navy)] text-white"
                    : done
                    ? "bg-success-bg text-success-text"
                    : "bg-slate-100 text-slate-500",
                  canReturn && "focus-ring hover:brightness-95"
                )}
              >
                {done ? (
                  <Check className="h-3 w-3 shrink-0" />
                ) : (
                  <span
                    className={cn(
                      "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                      current ? "bg-white/25" : "bg-slate-200 text-slate-600"
                    )}
                  >
                    {i + 1}
                  </span>
                )}
                <span className="truncate">{label}</span>
              </Tag>
              {i < steps.length - 1 && <span className="hidden h-px w-4 shrink-0 bg-slate-200 sm:block" />}
            </div>
          );
        })}
      </div>

      {onStepSelect && step > 0 && (
        <p className="mt-1.5 text-[10px] text-slate-400">אפשר להקיש על שלב שהושלם כדי לחזור אליו</p>
      )}
    </div>
  );
}
