"use client";

import { cn } from "@/lib/utils";
import { PHASE_LABELS, ProviderPhase } from "@/lib/provider-phases";
import { Check } from "lucide-react";

/**
 * The two-step "רישום → הקמה" rail that sits at the top of BOTH progress
 * panels. Its whole job is to answer "where am I in the overall journey, and
 * how much is left" — a provider halfway through הקמה should never wonder
 * whether they're still registering.
 *
 * A unit-path provider never sees a רישום step they can act on (Healson did it
 * for them), so it renders as already-complete rather than being hidden: the
 * journey is still two phases, they just skipped one.
 */
export function PhaseHeader({
  phase,
  registrationDoneByHealson = false,
  className,
}: {
  phase: ProviderPhase;
  /** Unit path — רישום was handled off-platform by Healson ops. */
  registrationDoneByHealson?: boolean;
  className?: string;
}) {
  const order: ProviderPhase[] = ["registration", "setup"];
  const currentIndex = phase === "registration" ? 0 : 1;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {order.map((p, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        const skipped = p === "registration" && registrationDoneByHealson;
        return (
          <div key={p} className="flex items-center gap-2">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                current
                  ? "bg-primary text-white"
                  : done || skipped
                  ? "bg-success-bg text-success-text"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              {done || skipped ? (
                <Check className="h-3 w-3" />
              ) : (
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold",
                    current ? "bg-white/25" : "bg-slate-200 text-slate-600"
                  )}
                >
                  {i + 1}
                </span>
              )}
              {PHASE_LABELS[p]}
              {skipped && <span className="font-normal opacity-80">· בוצע ע״י Healson</span>}
            </span>
            {i < order.length - 1 && <span className="h-px w-4 bg-slate-200" />}
          </div>
        );
      })}
    </div>
  );
}
