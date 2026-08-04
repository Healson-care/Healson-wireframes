"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Plane, ShieldCheck } from "lucide-react";
import { InsuranceLogo } from "@/components/search/InsuranceLogo";
import { formatCurrency } from "@/lib/utils";
import { PriceBreakdown } from "@/lib/pricing";
import { InsuranceLayer } from "@/types";

/**
 * Layer accents — one hue per SKBH layer, used anywhere a price says which
 * insurance layer produced it (here, and the profile strip). Keeping the two
 * in the same palette is what lets a patient connect "the amber dot on this
 * price" to "the amber circle in my profile" without reading anything.
 */
export const LAYER_ACCENT: Record<InsuranceLayer, { dot: string; text: string }> = {
  S: { dot: "bg-teal-700", text: "text-teal-700" },
  K: { dot: "bg-amber-700", text: "text-amber-700" },
  B: { dot: "bg-blue-700", text: "text-blue-700" },
  H: { dot: "bg-slate-500", text: "text-slate-600" },
};

/**
 * The price as its funding route, not a bare number — the route is the
 * primary fact, the amount is its consequence:
 *
 * - basket:       "מכוסה בסל הבריאות" — no payable price at all; the base
 *                 price appears only as reference, so the value of the
 *                 coverage is felt.
 * - arrangement:  base price struck out, the copay large, and under it who
 *                 covered it, dotted in that layer's color.
 * - tourist:      the dedicated tourist price, said plainly.
 * - base:         the full price; if the patient's own plans might reimburse
 *                 her, an informational hint — deliberately without any
 *                 amount, because the system never calculates reimbursements.
 */
export function InsurancePriceBlock({ breakdown }: { breakdown: PriceBreakdown }) {
  const reduceMotion = useReducedMotion();

  if (breakdown.kind === "basket") {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="flex items-center gap-1.5 text-sm font-bold text-teal-700">
          <ShieldCheck className="h-4 w-4 shrink-0" /> מכוסה בסל הבריאות
        </span>
        <span className="text-[11px] text-slate-500">נדרשת התחייבות (טופס 17) מהקופה</span>
        <span className="text-[11px] text-slate-400">
          במקום מחיר מלא של {formatCurrency(breakdown.basePrice)}
        </span>
      </div>
    );
  }

  if (breakdown.kind === "arrangement") {
    const accent = LAYER_ACCENT[breakdown.layer ?? "K"];
    return (
      <div className="flex flex-col items-start gap-0.5">
        <motion.span
          initial={reduceMotion ? false : { opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
          className="text-xs text-slate-400 line-through decoration-slate-300"
        >
          {formatCurrency(breakdown.basePrice)}
        </motion.span>
        <motion.span
          initial={reduceMotion ? false : { scale: 1.05 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.25 }}
          className="text-lg font-bold leading-none text-slate-900"
        >
          {formatCurrency(breakdown.price)}
        </motion.span>
        <span className={`flex items-center gap-1.5 text-[11px] font-medium ${accent.text}`}>
          {/* The insurer's own mark, ringed in its layer colour — the same
              pair the patient is wearing in the profile strip above. */}
          <InsuranceLogo name={breakdown.label} layers={[breakdown.layer ?? "K"]} size={14} />
          {breakdown.label}
        </span>
      </div>
    );
  }

  if (breakdown.kind === "tourist") {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="text-lg font-bold leading-none text-slate-900">{formatCurrency(breakdown.price)}</span>
        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
          <Plane className="h-3 w-3 shrink-0" /> מחיר תייר
        </span>
      </div>
    );
  }

  // kind === "base"
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="text-lg font-bold leading-none text-slate-900">{formatCurrency(breakdown.price)}</span>
      <span className="text-[11px] text-slate-500">מחיר מלא</span>
      {breakdown.reimbursementHint && breakdown.reimbursementHint.length > 0 && (
        <>
          <span className="flex items-center gap-1 rounded-full border border-info-border px-2 py-0.5 text-[11px] font-medium text-info-text">
            {breakdown.reimbursementHint.map((plan) => (
              <InsuranceLogo key={plan} name={plan} layers={["B"]} size={14} />
            ))}
            ייתכן החזר — בדקו מול {breakdown.reimbursementHint.join(" / ")}
          </span>
          <span className="text-[10px] text-slate-400">המערכת אינה מחשבת סכומי החזר</span>
        </>
      )}
    </div>
  );
}
