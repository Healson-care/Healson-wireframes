"use client";

import Link from "next/link";
import { CalendarClock, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { providerLabel } from "@/lib/search";
import { ConsultationType, ProviderProfile } from "@/types";

/**
 * The waiting room between sending the referral and choosing a time. Two things
 * have to land here — that nothing has been booked yet, and that nothing is
 * expected of the patient in the meantime. There is deliberately no slot on
 * this screen and no hold counting down: a time is only offered once the unit
 * has said yes, so there is nothing here that can expire.
 */
export function UnitApprovalPending({
  provider,
  consultation,
  onSimulateApproval,
}: {
  provider: ProviderProfile;
  consultation?: ConsultationType;
  /** Demo affordance — stands in for the unit answering. */
  onSimulateApproval: () => void;
}) {
  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-lg border border-warning-border bg-warning-bg p-4 text-center">
        <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-white text-warning-text">
          <FileCheck2 className="h-5 w-5" />
        </span>
        <h2 className="text-lg font-bold text-warning-text">ההפניה נשלחה לאישור היחידה הרפואית</h2>
        <p className="mt-1 text-sm text-warning-text/80">
          עדיין לא נקבע מועד ולא נגבה תשלום. ברגע שהיחידה תאשר, ייפתחו לכם המועדים הפנויים לבחירה.
        </p>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <p className="mb-2 text-xs text-slate-400">הבקשה שלך</p>
        <div className="flex items-start justify-between gap-3 text-sm">
          <span className="text-slate-500">שירות</span>
          <span className="text-left font-medium text-slate-900">{consultation?.name}</span>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3 text-sm">
          <span className="text-slate-500">נותן שירות</span>
          <span className="text-left font-medium text-slate-900">
            {providerLabel(provider)}
          </span>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-slate-500">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" /> מועד
          </span>
          <span className="text-left font-medium text-slate-500">נבחר לאחר האישור</span>
        </div>

        <div className="my-3 h-px bg-slate-100" />

        <p className="text-xs text-slate-600">
          הבקשה כבר שמורה אצלכם — אין צורך להישאר בעמוד. נעדכן אתכם בהודעה ברגע שתתקבל תשובה, ואפשר לעקוב
          בכל רגע תחת &quot;התורים שלי&quot;.
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
          הדגמה: היחידה אישרה — המשך לבחירת מועד
        </Button>
      </div>
    </div>
  );
}
