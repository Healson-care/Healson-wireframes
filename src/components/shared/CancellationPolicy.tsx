"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

/**
 * The cancellation terms, in one place. Shown wherever the patient either
 * commits to them (the payment step) or is likely to go looking for them
 * afterwards ("התורים שלי", the booking confirmation).
 *
 * Collapsed by default everywhere: on the payment screen it must not push the
 * price and the pay button down the page for text most people never open, and
 * the numbers in it (48h, 5%, ₪100) are the same numbers CANCELLATION_WINDOW_HOURS
 * / REFUND_FEE_RATE / REFUND_FEE_CAP enforce in client/appointments — kept as a
 * single component so a change to the rule can't leave one screen behind.
 */
export function CancellationPolicy({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className={cn("p-3", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="focus-ring flex w-full items-center justify-between gap-2 text-xs font-semibold text-slate-700"
      >
        מדיניות ביטול
        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pt-2 text-xs leading-relaxed text-slate-500">
              ניתן לבטל תור ללא עלות עד לתשלום המקדמה. עד 48 שעות ממועד תשלום המקדמה ניתן לבטל ולקבל החזר מקדמה
              בניכוי דמי טיפול (5% מסך העסקה או ₪100 — הנמוך מביניהם). לאחר מכן לא ניתן לבטל את התור.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
