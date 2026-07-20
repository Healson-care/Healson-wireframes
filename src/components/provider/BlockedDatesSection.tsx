"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Misc";
import { generateId, formatDateHe } from "@/lib/utils";
import { BlockedDate } from "@/types";
import { CalendarOff, Plus, Trash2 } from "lucide-react";

/** Dates the provider has closed on top of their recurring weekly hours
 * (§PRV-03) — the real slot generator (src/lib/scheduling.ts) treats these
 * as fully closed regardless of what the weekly hours say. */
export function BlockedDatesSection({
  blockedDates,
  onChange,
}: {
  blockedDates: BlockedDate[];
  onChange: (blockedDates: BlockedDate[]) => void;
}) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  function addBlockedDate() {
    if (!date || blockedDates.some((b) => b.date === date)) return;
    onChange([...blockedDates, { id: generateId("block"), date, reason: reason || undefined }].sort((a, b) => a.date.localeCompare(b.date)));
    setDate("");
    setReason("");
  }

  function removeBlockedDate(id: string) {
    onChange(blockedDates.filter((b) => b.id !== id));
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1">
        <CalendarOff className="h-4 w-4 text-slate-500" />
        <p className="text-sm font-medium text-slate-800">תאריכים חסומים</p>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        חסימה גורפת בכל המיקומים שלך — התאריך ייסגר להזמנות בכל היומנים, גם אם הוא נכלל בלוח הזמנים השבועי.
        לסגירה או שינוי שעות במיקום מסוים בלבד, השתמשו ב&quot;חריגות בלוח הזמנים&quot; שמעל.
      </p>
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <Input type="date" label="תאריך" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        <Input label="סיבה (אופציונלי)" value={reason} onChange={(e) => setReason(e.target.value)} className="flex-1 min-w-[10rem]" />
        <Button size="sm" onClick={addBlockedDate} disabled={!date}>
          <Plus className="h-4 w-4" /> חסום תאריך
        </Button>
      </div>
      {blockedDates.length === 0 ? (
        <EmptyState title="אין תאריכים חסומים" />
      ) : (
        <div className="flex flex-col gap-1.5">
          {blockedDates.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-700">
                {formatDateHe(b.date)}
                {b.reason && <span className="text-slate-400"> · {b.reason}</span>}
              </span>
              <button onClick={() => removeBlockedDate(b.id)} className="p-1 rounded-md hover:bg-red-50 text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
