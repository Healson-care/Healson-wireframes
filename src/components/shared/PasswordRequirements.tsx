"use client";

import { Check, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const PASSWORD_RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: "לפחות 8 תווים", test: (v) => v.length >= 8 },
  { label: "לפחות אות אחת", test: (v) => /[a-zA-Zא-ת]/.test(v) },
  { label: "לפחות ספרה אחת", test: (v) => /[0-9]/.test(v) },
];

export function passwordMeetsRequirements(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

/** Live checklist shown under a password field — every screen that lets a
 * user set/change a password (registration, reset) should show the same
 * rules the same way, not just reject on submit with no advance warning. */
export function PasswordRequirements({ password }: { password: string }) {
  return (
    <ul className="-mt-1.5 flex flex-col gap-0.5 px-1">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li
            key={rule.label}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              met ? "text-success-text" : "text-slate-400"
            )}
          >
            {met ? <Check className="h-3 w-3 shrink-0" /> : <XIcon className="h-3 w-3 shrink-0" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
