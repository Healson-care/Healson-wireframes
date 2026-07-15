"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/Card";
import { ProgressRing } from "@/components/ui/Progress";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Rocket, Sparkles } from "lucide-react";

export interface OnboardingChecklistItem {
  label: string;
  done: boolean;
}

/** Booking/Amazon-style activation progress bar shown on the provider
 * onboarding page — a single glanceable "you're not live yet, here's what's
 * left" summary, with a real percent-complete bar instead of a plain
 * checklist, so the provider always knows exactly how far they are from
 * accepting their first booking. */
export function OnboardingChecklist({ items, ring = false }: { items: OnboardingChecklistItem[]; ring?: boolean }) {
  const doneCount = items.filter((i) => i.done).length;
  const percent = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
  const isActive = doneCount === items.length && items.length > 0;

  return (
    <Card className={cn("overflow-hidden", isActive ? "border-success-border" : "border-warning-border")}>
      <CardContent className="flex flex-col gap-6 pt-6">
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
                {isActive ? "הפרופיל שלך מוכן לפרסום" : "הישג גדול בדרך לשידור חי"}
              </p>
              <p className="text-sm text-slate-500 max-w-2xl">
                {isActive
                  ? "הפרופיל שלך עבר את כל השלבים והוא מוכן לקבל הזמנות — נותר רק לפרסם."
                  : `השלמת ${doneCount} מתוך ${items.length} שלבים. כל שלב קרב אותך לקבלת הזמנות.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {ring && (
              <ProgressRing
                percent={percent}
                size={72}
                tone={isActive ? "success" : "primary"}
                textClassName="text-slate-900"
              />
            )}
            <div className="rounded-3xl bg-slate-100 px-4 py-3 text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">התקדמות אונבורדינג</div>
              <div className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{percent}%</div>
              <div className="text-xs text-slate-500">{doneCount} מתוך {items.length} שלבים הושלמו</div>
            </div>
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
          {items.map((item, index) => (
            <div
              key={item.label}
              className={cn(
                "rounded-3xl border p-4 shadow-sm transition hover:-translate-y-0.5",
                item.done ? "border-emerald-200 bg-emerald-50/80" : "border-slate-200 bg-white"
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-500">שלב {index + 1} מתוך {items.length}</p>
                </div>
                <div
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em]",
                    item.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                  )}
                >
                  {item.done ? "הושלם" : "נדרש"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
