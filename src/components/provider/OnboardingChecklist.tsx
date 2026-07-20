"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/Card";
import { ProgressRing } from "@/components/ui/Progress";
import { cn } from "@/lib/utils";
import { CheckCircle2, ChevronLeft, Circle, Rocket, Sparkles } from "lucide-react";

export interface OnboardingChecklistItem {
  label: string;
  done: boolean;
  /** Wizard tab key — when provided together with onItemClick, the item card
   * becomes a button that jumps straight to that step. */
  key?: string;
}

/** Booking/Amazon-style activation progress bar shown on the provider
 * onboarding page — a single glanceable "you're not live yet, here's what's
 * left" summary. One progress indicator (ring or compact count), one bar,
 * and clickable step cards that jump to the relevant wizard tab. */
export function OnboardingChecklist({
  items,
  ring = false,
  onItemClick,
}: {
  items: OnboardingChecklistItem[];
  ring?: boolean;
  onItemClick?: (key: string) => void;
}) {
  const doneCount = items.filter((i) => i.done).length;
  const percent = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
  const isActive = doneCount === items.length && items.length > 0;
  const nextItem = items.find((i) => !i.done);

  return (
    <Card className={cn("overflow-hidden", isActive ? "border-success-border" : "border-warning-border")}>
      <CardContent className="flex flex-col gap-5 pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2",
                isActive ? "border-success bg-success-bg text-success-text" : "border-primary bg-primary/10 text-primary"
              )}
            >
              {isActive ? <Sparkles className="h-5 w-5" /> : <Rocket className="h-5 w-5" />}
            </span>
            <div>
              <p className="text-lg font-semibold text-slate-900 leading-tight">
                {isActive ? "הפרופיל שלך מוכן לפרסום" : "מה נשאר עד הפרסום"}
              </p>
              <p className="text-sm text-slate-500 max-w-2xl">
                {isActive
                  ? "הפרופיל שלך עבר את כל השלבים והוא מוכן לקבל הזמנות — נותר רק לפרסם."
                  : `הושלמו ${doneCount} מתוך ${items.length} שלבים. כל שלב מקרב אותך לקבלת הזמנות.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {ring ? (
              <ProgressRing
                percent={percent}
                size={72}
                tone={isActive ? "success" : "primary"}
                textClassName="text-slate-900"
              />
            ) : (
              <span className="text-sm font-semibold text-slate-700 tabular-nums">
                {doneCount}/{items.length}
              </span>
            )}
            {nextItem?.key && onItemClick && (
              <button
                onClick={() => onItemClick(nextItem.key!)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
              >
                המשך ל{nextItem.label}
              </button>
            )}
          </div>
        </div>

        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className={cn(
              "h-full rounded-full",
              isActive ? "bg-success" : "bg-gradient-to-r from-primary to-accent"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item, index) => {
            const clickable = !!item.key && !!onItemClick;
            const inner = (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  {item.done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-slate-300" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-900 text-right">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-500 text-right">שלב {index + 1} מתוך {items.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-[11px] font-semibold",
                      item.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {item.done ? "הושלם" : "נדרש"}
                  </span>
                  {clickable && <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400" />}
                </div>
              </div>
            );
            const cardClasses = cn(
              "rounded-2xl border p-4 shadow-sm transition w-full",
              item.done ? "border-emerald-200 bg-emerald-50/80" : "border-slate-200 bg-white",
              clickable && "hover:-translate-y-0.5 hover:border-primary/40 cursor-pointer"
            );
            return clickable ? (
              <button key={item.label} type="button" onClick={() => onItemClick!(item.key!)} className={cardClasses}>
                {inner}
              </button>
            ) : (
              <div key={item.label} className={cardClasses}>
                {inner}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
