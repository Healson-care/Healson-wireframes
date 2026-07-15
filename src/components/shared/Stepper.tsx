"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Compact step-progress indicator — circles + connecting lines only, no
 * per-step labels, so it fits inside narrow containers (e.g. AuthLayout's
 * max-w-sm card). Pair it with a text line showing the current step name. */
export function Stepper({ steps, step }: { steps: string[]; step: number }) {
  return (
    <div className="flex items-center w-full mb-1">
      {steps.map((label, i) => (
        <div key={label} className="flex flex-1 items-center last:flex-none">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
              i < step
                ? "bg-primary text-white"
                : i === step
                ? "bg-gradient-to-br from-primary to-primary-dark text-white scale-110 shadow-sm shadow-primary/30"
                : "bg-slate-100 text-slate-400"
            )}
          >
            {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div className="h-0.5 flex-1 mx-1 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-l from-primary to-primary-dark transition-all duration-500"
                style={{ width: i < step ? "100%" : "0%" }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
