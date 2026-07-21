"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type BookingStepperMode = "service" | "doctor";

// Both discovery paths land on the same 6 conceptual steps — only the order
// of the first two (service vs. doctor picked first) differs. "מיקום"/"שעה"
// and the doctor-mode "רופא"/"שירות" pair each happen on a single physical
// screen (SlotPicker, ServiceDiscovery) — the page computes which of the
// pair is still in progress and passes that in as `step`, so this component
// stays purely presentational.
export const STEPS_BY_MODE: Record<BookingStepperMode, string[]> = {
  service: ["בחירת שירות", "בחירת רופא", "בחירת מיקום", "בחירת שעה", "תשלום מקדמה", "אישור"],
  doctor: ["בחירת רופא", "בחירת שירות", "בחירת מיקום", "בחירת שעה", "תשלום מקדמה", "אישור"],
};

export function BookingStepper({ step, mode = "service" }: { step: number; mode?: BookingStepperMode }) {
  const STEPS = STEPS_BY_MODE[mode];
  const percent = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="w-full max-w-3xl mx-auto mb-10">
      {/* 6 numbered circles need real width to stay readable — on an iPhone-
          size screen they'd overflow/squash, so mobile gets a slim progress
          bar + the current step's label instead (below). */}
      <div className="hidden items-center sm:flex">
      {STEPS.map((label, i) => (
        <div key={label} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-2">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 shadow-sm",
                i < step
                  ? "bg-primary text-white"
                  : i === step
                  ? "bg-gradient-to-br from-primary to-primary-dark text-white scale-110 shadow-lg shadow-primary/30"
                  : "bg-slate-100 text-slate-400"
              )}
            >
              {i < step ? <Check className="h-4.5 w-4.5" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-[11px] font-medium whitespace-nowrap",
                i <= step ? "text-slate-700" : "text-slate-400"
              )}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="h-0.5 flex-1 mx-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-l from-primary to-primary-dark transition-all duration-500"
                style={{ width: i < step ? "100%" : "0%" }}
              />
            </div>
          )}
        </div>
      ))}
      </div>

      <div className="sm:hidden">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-l from-primary to-primary-dark transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-center text-xs font-medium text-slate-500">
          שלב {step + 1} מתוך {STEPS.length}: {STEPS[step]}
        </p>
      </div>
    </div>
  );
}
