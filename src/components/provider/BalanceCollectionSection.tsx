"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { BALANCE_COLLECTORS, BALANCE_COLLECTOR_LABELS, BalanceCollector } from "@/types";
import { Building2, CreditCard, Info } from "lucide-react";

const DETAIL: Record<BalanceCollector, { icon: typeof CreditCard; detail: string }> = {
  healson: {
    icon: CreditCard,
    detail:
      "המטופל משלם מקדמה בעת קביעת התור, והיתרה מחויבת אוטומטית מאותו כרטיס יום לפני התור עד השעה 12:00. אי-תשלום עד המועד מבטל את התור, והיחידה מקבלת התראה.",
  },
  unit: {
    icon: Building2,
    detail:
      "המטופל משלם מקדמה בלבד דרך Healson, ואת היתרה גובה היחידה ישירות במעמד הפגישה. Healson לא תחייב את הכרטיס פעם שנייה, והמטופל יראה בכרטיס התור “היתרה תשולם ישירות במעמד הפגישה”.",
  },
};

/** Who collects the balance left after the deposit — a policy each medical unit
 * sets once (payments meeting §5). It is snapshotted onto every new booking, so
 * changing it here affects future appointments only and never rewrites what a
 * patient was already told at checkout. */
export function BalanceCollectionSection({
  value,
  onChange,
}: {
  value: BalanceCollector;
  onChange: (value: BalanceCollector) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>גביית היתרה</CardTitle>
        <p className="text-sm text-slate-500">
          מי גובה מהמטופל את היתרה שנשארה אחרי המקדמה. ההגדרה חלה על כל התורים החדשים ביחידה.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2.5">
          {BALANCE_COLLECTORS.map((option) => {
            const Icon = DETAIL[option].icon;
            const selected = value === option;
            return (
              <label
                key={option}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  selected ? "border-primary bg-primary/5" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="balance-collector"
                  checked={selected}
                  onChange={() => onChange(option)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span className="flex flex-col gap-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                    <Icon className="h-4 w-4 text-slate-400" />
                    {BALANCE_COLLECTOR_LABELS[option]}
                    {option === "healson" && (
                      <span className="text-[11px] font-normal text-slate-400">· ברירת מחדל</span>
                    )}
                  </span>
                  <span className="text-xs leading-relaxed text-slate-500">{DETAIL[option].detail}</span>
                </span>
              </label>
            );
          })}
        </div>

        <p className="mt-3 flex items-start gap-2 rounded-lg bg-info-bg px-3 py-2 text-xs leading-relaxed text-info-text">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          המקדמה עצמה נגזרת אוטומטית מהעמלה שנקבעה מול Healson ואינה מוגדרת כאן. במסלול סל הקופה (S) לא נגבית
          מקדמה כלל — במקומה מועלית התחייבות.
        </p>
      </CardContent>
    </Card>
  );
}
