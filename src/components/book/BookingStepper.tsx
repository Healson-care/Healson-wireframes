"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["בחירת רופא", "פרטים אישיים", "בחירת תור", "תשלום מקדמה", "אישור"];

export function BookingStepper({ step }: { step: number }) {
  return (
    <div className="flex items-center w-full max-w-3xl mx-auto mb-10">
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
                "text-[11px] font-medium hidden sm:block whitespace-nowrap",
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
  );
}
