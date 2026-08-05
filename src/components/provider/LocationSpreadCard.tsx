"use client";

import { MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

/**
 * "כמה סניפים יש לך" — the location spread.
 *
 * It used to be asked during registration, before the provider had any branch
 * to point at; it belongs in הקמה, where it sits directly above the branch list
 * and can actually be compared against it. Nothing gates on it: it tells Healson
 * what to expect while the branches are still being entered.
 */
export function LocationSpreadCard({
  value,
  branchCount,
  onChange,
}: {
  value?: number;
  branchCount: number;
  onChange: (value: number | undefined) => void;
}) {
  const declared = value ?? 0;
  const gap = declared > 0 && branchCount < declared;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end justify-between gap-4 pt-4">
        <div className="min-w-[220px] flex-1">
          <Input
            type="number"
            min={1}
            label="כמה מוקדי קבלה / סניפים יש לך?"
            icon={<MapPin className="h-4 w-4" />}
            value={value != null ? String(value) : ""}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
            hint="כולל קליניקה פרטית, ביקורי בית ופגישות אונליין — כל אחד מהם הוא סניף."
          />
        </div>
        <p
          className={`rounded-lg px-3 py-2 text-xs ${
            gap ? "bg-warning-bg text-warning-text" : "bg-slate-50 text-slate-500"
          }`}
        >
          {gap
            ? `הוגדרו ${branchCount} מתוך ${declared} סניפים — נותר להוסיף ${declared - branchCount}.`
            : `${branchCount} סניפים מוגדרים בפועל.`}
        </p>
      </CardContent>
    </Card>
  );
}
