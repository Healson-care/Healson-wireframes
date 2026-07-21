"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Step-progress indicator — circles + connecting lines, with a small label
 * under each step so it still fits inside narrow containers (e.g.
 * AuthLayout's max-w-sm card). Pass `onStepClick` to let the user jump back
 * to an already-completed step (future steps stay non-interactive so you
 * can't skip ahead without filling their data). */
export function Stepper({
  steps,
  step,
  onStepClick,
}: {
  steps: string[];
  step: number;
  onStepClick?: (index: number) => void;
}) {
  return (
    <div className="flex items-start w-full mb-1">
      {steps.map((label, i) => {
        const clickable = i < step && !!onStepClick;
        return (
          <div key={label} className="flex flex-1 flex-col items-center last:flex-none">
            <div className="flex w-full items-center">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick!(i)}
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                  i < step
                    ? "bg-primary text-white"
                    : i === step
                    ? "bg-gradient-to-br from-primary to-primary-dark text-white scale-110 shadow-sm shadow-primary/30"
                    : "bg-slate-100 text-slate-400",
                  clickable ? "cursor-pointer hover:ring-2 hover:ring-primary/40" : "cursor-default"
                )}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </button>
              {i < steps.length - 1 && (
                <div className="h-0.5 flex-1 mx-1 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-l from-primary to-primary-dark transition-all duration-500"
                    style={{ width: i < step ? "100%" : "0%" }}
                  />
                </div>
              )}
            </div>
            <span
              className={cn(
                "mt-1 text-center text-[10px] leading-tight px-0.5",
                i <= step ? "text-slate-600 font-medium" : "text-slate-400"
              )}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
