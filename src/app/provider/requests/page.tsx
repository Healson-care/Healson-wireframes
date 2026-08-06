"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ProviderLayout } from "@/components/layouts/ProviderLayout";
import { useCurrentProvider } from "@/lib/useCurrentPatient";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/Misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import {
  AppointmentPaymentPanel,
  PaymentStateBadge,
  ReferralReviewPanel,
} from "@/components/provider/AppointmentReferralPanel";
import { formatCurrency } from "@/lib/utils";
import {
  appointmentStatusLabel,
  formatBalanceDue,
  showsPatientPaymentStatus,
  usesCommitment,
} from "@/lib/appointment-payments";
import { Appointment, isCancelledAppointment } from "@/types";
import { CalendarDays, FolderOpen, Hourglass, Inbox, Wallet } from "lucide-react";

/** The work queue behind the diary (payments meeting §7).
 *
 * A booking for anything other than a consultation arrives with a referral and
 * holds a slot until the unit decides on it, and a booking on a commitment route
 * sits waiting for its טופס 17. Both are time-boxed obligations rather than
 * calendar events, so they get a list of their own — the diary answers "what is
 * my day", this answers "what is waiting on me".
 *
 * Three tabs, in the order they demand attention:
 *   הפניות לאישור  — the unit must approve or reject; a slot is held meanwhile.
 *   ממתין להתחייבות — waiting on the patient's commitment document.
 *   גבייה פתוחה     — deposit or balance still uncollected. Units only: an
 *                     individual provider never collects from the patient, so
 *                     the tab is not part of their portal at all (see
 *                     showsPatientPaymentStatus). */
const ALL_TABS = [
  { key: "referrals", label: "הפניות לאישור", icon: Inbox },
  { key: "commitments", label: "ממתין להתחייבות", icon: Hourglass },
  { key: "collection", label: "גבייה פתוחה", icon: Wallet },
] as const;

type TabKey = (typeof ALL_TABS)[number]["key"];

export default function ProviderRequestsPage() {
  const provider = useCurrentProvider();
  const appointments = useStore((s) => s.appointments);
  const [tab, setTab] = useState<TabKey>("referrals");

  const mine = useMemo(
    () => appointments.filter((a) => a.provider_id === provider?.id),
    [appointments, provider?.id]
  );

  const seesPayments = showsPatientPaymentStatus(provider);
  const tabs = ALL_TABS.filter((t) => t.key !== "collection" || seesPayments);

  const referrals = mine.filter((a) => a.status === "ממתין לאישור הפניה");
  const commitments = mine.filter((a) => a.status === "ממתין להתחייבות");
  const collection = seesPayments
    ? mine.filter(
        (a) =>
          !isCancelledAppointment(a.status) &&
          !usesCommitment(a) &&
          (a.status === "ממתין לתשלום מקדמה" || a.status === "ממתין לתשלום יתרה")
      )
    : [];

  const byTab: Record<TabKey, Appointment[]> = {
    referrals,
    commitments,
    collection,
  };
  const counts: Record<TabKey, number> = {
    referrals: referrals.length,
    commitments: commitments.length,
    collection: collection.length,
  };
  const rows = [...byTab[tab]].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return (
    <ProviderLayout>
      {provider ? (
        <>
          <PageHeader
            title="בקשות ממתינות"
            description={
              seesPayments
                ? "כל מה שממתין לפעולה לפני שהתור נסגר סופית — אישור הפניות, טפסי התחייבות וגבייה פתוחה. מועד שממתין לאישור משוריין למטופל ומשתחרר אוטומטית אם לא מטפלים בו."
                : "כל מה שממתין לפעולה לפני שהתור נסגר סופית — אישור הפניות וטפסי התחייבות. מועד שממתין לאישור משוריין למטופל ומשתחרר אוטומטית אם לא מטפלים בו."
            }
          />

          <div className={`mb-4 grid gap-3 ${seesPayments ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <StatCard label="הפניות לאישור" value={counts.referrals} tone="purple" />
            <StatCard label="ממתין להתחייבות" value={counts.commitments} tone="amber" />
            {seesPayments && <StatCard label="גבייה פתוחה" value={counts.collection} tone="blue" />}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`focus-ring flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t.key ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {counts[t.key] > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                      tab === t.key ? "bg-white/25" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {counts[t.key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-10 w-10" />}
              title="אין בקשות ממתינות"
              description={
                seesPayments
                  ? "כשמטופל יזמין תור שמצריך הפניה, התחייבות או גבייה — הוא יופיע כאן."
                  : "כשמטופל יזמין תור שמצריך הפניה או טופס התחייבות — הוא יופיע כאן."
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {rows.map((a) => (
                <RequestCard key={a.id} appointment={a} tab={tab} showMoney={seesPayments} />
              ))}
            </div>
          )}
        </>
      ) : (
        <DashboardSkeleton />
      )}
    </ProviderLayout>
  );
}

function RequestCard({
  appointment: a,
  tab,
  showMoney,
}: {
  appointment: Appointment;
  tab: TabKey;
  showMoney: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">{a.client_name}</CardTitle>
          <p className="text-sm text-slate-600">{a.service_name}</p>
          <p dir="ltr" className="mt-1 flex items-center gap-1.5 text-xs font-medium tabular-nums text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" />
            {a.date} · {a.time}
            {typeof a.price === "number" && <span> · {formatCurrency(a.price)}</span>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge
            status={a.status}
            kind="appointment"
            label={appointmentStatusLabel(a.status, showMoney)}
          />
          {showMoney && <PaymentStateBadge appointment={a} />}
          {a.slot_hold_expires_at && a.status === "ממתין לאישור הפניה" && (
            <Badge tone="amber">משוריין עד {formatBalanceDue(a.slot_hold_expires_at)}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {tab === "referrals" ? (
          <ReferralReviewPanel appointment={a} />
        ) : (
          <AppointmentPaymentPanel appointment={a} showMoney={showMoney} />
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {a.created_by_id && (
            <Link href={`/provider/patients/${a.created_by_id}`}>
              <Button size="sm" variant="outline">
                <FolderOpen className="h-3.5 w-3.5" /> פתח תיק מטופל
              </Button>
            </Link>
          )}
          <Link href="/provider/appointments">
            <Button size="sm" variant="ghost">
              <CalendarDays className="h-3.5 w-3.5" /> הצג ביומן
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
