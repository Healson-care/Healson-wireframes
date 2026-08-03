"use client";

import Link from "next/link";
import { CalendarClock, Clock, FileCheck2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConsultationType, ProviderProfile, UNIT_APPROVAL_HOLD_HOURS } from "@/types";

/**
 * The waiting room between picking a slot and paying: the unit still has to
 * review the referral. Two things have to land here — that the appointment is
 * NOT confirmed yet, and that the slot is nonetheless being held, so the
 * patient doesn't feel a need to rush back or book elsewhere.
 */
export function UnitApprovalPending({
  provider,
  consultation,
  selectedSlot,
  clinicName,
  holdUntilLabel,
  onSimulateApproval,
}: {
  provider: ProviderProfile;
  consultation?: ConsultationType;
  selectedSlot: { date: string; time: string; label: string };
  clinicName?: string;
  holdUntilLabel: string;
  /** Demo affordance — stands in for the unit answering. */
  onSimulateApproval: () => void;
}) {
  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-warning-border bg-warning-bg p-5 text-center">
        <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-white text-warning-text">
          <FileCheck2 className="h-5 w-5" />
        </span>
        <h2 className="text-lg font-bold text-warning-text">ממתין לאישור היחידה הרפואית</h2>
        <p className="mt-1 text-sm text-warning-text/80">
          ההפניה נשלחה לבדיקה. התור עדיין לא סופי — לא נגבה ממך תשלום עד שהיחידה תאשר.
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-2 text-xs text-slate-400">הבקשה שלך</p>
        <div className="flex items-start justify-between gap-3 text-sm">
          <span className="text-slate-500">שירות</span>
          <span className="text-left font-medium text-slate-900">{consultation?.name}</span>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3 text-sm">
          <span className="text-slate-500">נותן שירות</span>
          <span className="text-left font-medium text-slate-900">
            {provider.title} {provider.display_name}
          </span>
        </div>
        {clinicName && (
          <div className="mt-2 flex items-start justify-between gap-3 text-sm">
            <span className="flex items-center gap-1.5 text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> מיקום
            </span>
            <span className="text-left font-medium text-slate-900">{clinicName}</span>
          </div>
        )}
        <div className="mt-2 flex items-start justify-between gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-slate-500">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" /> מועד מבוקש
          </span>
          <span className="text-left font-medium text-slate-900">
            {selectedSlot.label} · {selectedSlot.time}
          </span>
        </div>

        <div className="my-3 h-px bg-slate-100" />

        <p className="flex items-start gap-1.5 text-xs text-slate-600">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            <strong className="font-semibold">המועד שמור עבורך עד {holdUntilLabel}</strong> — כ-
            {UNIT_APPROVAL_HOLD_HOURS} שעות. אם היחידה לא תאשר עד אז, השריון ישוחרר והמועד יוצע לאחרים.
          </span>
        </p>
        <p className="mt-2 text-[11px] text-slate-400">
          נעדכן אותך בהודעה ברגע שתתקבל תשובה. אפשר לעקוב גם בכל רגע תחת &quot;התורים שלי&quot;.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Link href="/client/appointments" className="w-full">
          <Button variant="outline" className="w-full">
            מעבר לתורים שלי
          </Button>
        </Link>
        {/* Demo only: a real unit answers from its own portal. */}
        <Button variant="ghost" className="w-full text-xs" onClick={onSimulateApproval}>
          הדגמה: היחידה אישרה — המשך לתשלום
        </Button>
      </div>
    </div>
  );
}
