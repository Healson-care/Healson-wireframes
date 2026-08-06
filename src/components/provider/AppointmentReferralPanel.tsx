"use client";

import { useState } from "react";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Input";
import { useStore } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
import {
  balanceLine,
  formatBalanceDue,
  getAppointmentPaymentState,
  paymentStateTone,
  usesCommitment,
} from "@/lib/appointment-payments";
import { Appointment, LAYER_LABELS } from "@/types";
import { Check, FileText, Hourglass, ShieldCheck, Wallet, X } from "lucide-react";

/** Everything the referral gate needs on one appointment (payments meeting §7):
 * the document the patient uploaded, and — while the booking sits in
 * "ממתין לאישור הפניה" — the approve / reject decision. Rejecting frees the
 * held slot, so it always asks for a reason first.
 *
 * Shared by the diary's appointment dialog and the "בקשות ממתינות" inbox, so
 * the decision reads and behaves identically wherever the provider meets it. */
export function ReferralReviewPanel({
  appointment,
  compact = false,
}: {
  appointment: Appointment;
  compact?: boolean;
}) {
  const approve = useStore((s) => s.approveAppointmentReferral);
  const reject = useStore((s) => s.rejectAppointmentReferral);
  const showToast = useStore((s) => s.showToast);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const pending = appointment.status === "ממתין לאישור הפניה";
  if (!appointment.referral_document && !pending && !appointment.referral_decision) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
      {!compact && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <FileText className="h-3.5 w-3.5" /> הפניה
        </p>
      )}

      {appointment.referral_document ? (
        <a
          href={appointment.referral_document.data_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-2 text-xs hover:bg-slate-100"
        >
          <span className="flex items-center gap-1.5 text-slate-700">
            <FileText className="h-3.5 w-3.5 text-slate-400" />
            {appointment.referral_document.file_name}
          </span>
          <span className="text-primary">צפייה בהפניה</span>
        </a>
      ) : (
        <p className="text-xs text-slate-400">המטופל טרם העלה מסמך הפניה.</p>
      )}

      {pending && appointment.slot_hold_expires_at && (
        <p className="flex items-center gap-1.5 text-[11px] text-amber-700">
          <Hourglass className="h-3 w-3" />
          המועד משוריין למטופל עד {formatBalanceDue(appointment.slot_hold_expires_at)} — לאחר מכן הוא משתחרר
          אוטומטית ליומן.
        </p>
      )}

      {appointment.referral_decision === "rejected" && (
        <p className="text-[11px] text-danger-text">
          ההפניה נדחתה{appointment.referral_rejection_reason ? `: ${appointment.referral_rejection_reason}` : ""}
        </p>
      )}
      {appointment.referral_decision === "approved" && (
        <p className="flex items-center gap-1.5 text-[11px] text-success-text">
          <ShieldCheck className="h-3 w-3" /> ההפניה אושרה
        </p>
      )}

      {pending && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-2">
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              setReason("");
              setRejectOpen(true);
            }}
          >
            <X className="h-3.5 w-3.5" /> דחיית הפניה
          </Button>
          <Button
            size="sm"
            onClick={() => {
              approve(appointment.id);
              showToast("ההפניה אושרה — התור ממשיך לשלב התשלום", { variant: "success" });
            }}
          >
            <Check className="h-3.5 w-3.5" /> אישור הפניה
          </Button>
        </div>
      )}

      <Dialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="דחיית הפניה"
        description="דחיית ההפניה מבטלת את התור ומשחררת את המועד ליומן. הסיבה תישלח למטופל."
      >
        <div className="flex flex-col gap-3">
          <Textarea
            label="סיבת הדחייה"
            placeholder="למשל: ההפניה אינה כוללת את קוד הבדיקה הנדרש, או שתוקפה פג."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3}
            onClick={() => {
              reject(appointment.id, reason.trim());
              setRejectOpen(false);
              showToast("ההפניה נדחתה והמועד שוחרר", { variant: "default" });
            }}
          >
            דחה ושחרר את המועד
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

/** The money picture of one appointment (payments meeting §7): which funding
 * route it runs on, what was already collected, and what is still owed — plus
 * the commitment document on the routes that use one instead of a deposit.
 *
 * `showMoney` is false for an individual provider (see showsPatientPaymentStatus):
 * the funding route and its התחייבות are still theirs to read, the collection
 * state is not. With no commitment on the route there is nothing money-free
 * left to show, so the panel renders nothing at all. */
export function AppointmentPaymentPanel({
  appointment: a,
  showMoney = true,
}: {
  appointment: Appointment;
  showMoney?: boolean;
}) {
  const state = getAppointmentPaymentState(a);
  const commitment = usesCommitment(a);
  const balance = balanceLine(a);

  if (!showMoney && !commitment) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          {showMoney ? (
            <>
              <Wallet className="h-3.5 w-3.5" /> תשלום
            </>
          ) : (
            <>
              <FileText className="h-3.5 w-3.5" /> התחייבות משלם
            </>
          )}
        </p>
        <div className="flex items-center gap-1.5">
          {a.funding_layer && (
            <Badge tone="slate">
              {LAYER_LABELS[a.funding_layer]} ({a.funding_layer})
            </Badge>
          )}
          {showMoney && <Badge tone={paymentStateTone(state)}>{state}</Badge>}
        </div>
      </div>

      {commitment ? (
        <>
          <p className="text-xs text-slate-500">
            {showMoney
              ? "במסלול זה לא נגבית מקדמה — התור מאושר על סמך התחייבות המשלם."
              : "התור מאושר על סמך התחייבות המשלם."}
          </p>
          {a.commitment_document ? (
            <a
              href={a.commitment_document.data_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-2 text-xs hover:bg-slate-100"
            >
              <span className="flex items-center gap-1.5 text-slate-700">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                {a.commitment_document.file_name}
              </span>
              <span className="text-primary">צפייה בהתחייבות</span>
            </a>
          ) : (
            <p className="text-xs text-amber-700">ממתין להעלאת טופס התחייבות מהמטופל.</p>
          )}
        </>
      ) : (
        <div className="grid gap-1.5 text-xs sm:grid-cols-2">
          <div className="flex justify-between rounded-md bg-slate-50 px-2 py-1.5">
            <span className="text-slate-500">מקדמה</span>
            <span className="font-medium text-slate-800">
              {a.deposit_amount != null ? formatCurrency(a.deposit_amount) : "—"}
              {a.deposit_paid_at && " ✓"}
            </span>
          </div>
          <div className="flex justify-between rounded-md bg-slate-50 px-2 py-1.5">
            <span className="text-slate-500">יתרה</span>
            <span className="font-medium text-slate-800">
              {a.balance_amount != null ? formatCurrency(a.balance_amount) : "—"}
            </span>
          </div>
          {balance && <p className="text-[11px] text-slate-500 sm:col-span-2">{balance}</p>}
        </div>
      )}
    </div>
  );
}

/** One-glance payment chip, for lists and cards. */
export function PaymentStateBadge({ appointment }: { appointment: Appointment }) {
  const state = getAppointmentPaymentState(appointment);
  return <Badge tone={paymentStateTone(state)}>{state}</Badge>;
}

/** Status + payment together — the pair a provider reads on every row. */
export function AppointmentStateBadges({ appointment }: { appointment: Appointment }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusBadge status={appointment.status} kind="appointment" />
      <PaymentStateBadge appointment={appointment} />
    </div>
  );
}
