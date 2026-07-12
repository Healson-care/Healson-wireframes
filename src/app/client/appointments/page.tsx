"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Calendar, Clock, Info, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Appointment, AppointmentStatus, WaitlistEntry, WaitlistStatus } from "@/types";

function formatAppointmentDate(dateIso: string) {
  return new Date(dateIso).toLocaleDateString("he-IL", { weekday: "long", day: "2-digit", month: "2-digit" });
}

// Explains, in the patient's own words, what each status of the booking
// lifecycle means and when it changes — shown both in the legend panel and
// as a hover tooltip on each item's badge.
const APPOINTMENT_STATUS_DESCRIPTIONS: Record<AppointmentStatus, string> = {
  "ממתין לתשלום מקדמה": "בחרתם מועד — המקום שמור זמנית עד שתשלימו את תשלום המקדמה",
  "מאושר": "תשלום המקדמה התקבל, התור נקבע סופית",
  "שולם במלואו": "היתרה שולמה במלואה לפני מועד התור",
  "בוצע": "התור התקיים והשירות ניתן",
  "בוטל": "התור בוטל, או שהזמן שנשמר לתשלום פג ולא שולם",
};

const WAITLIST_STATUS_LABELS: Record<WaitlistStatus, string> = {
  "ממתין": "ממתין ברשימת המתנה",
  "נוצר קשר": "נוצר קשר",
  "בוטל": "בוטל",
};

const WAITLIST_STATUS_TONE: Record<WaitlistStatus, "warning" | "info" | "danger"> = {
  "ממתין": "warning",
  "נוצר קשר": "info",
  "בוטל": "danger",
};

const WAITLIST_STATUS_DESCRIPTIONS: Record<WaitlistStatus, string> = {
  "ממתין": "אין תור פנוי במועד המבוקש — ניצור קשר אם יתפנה",
  "נוצר קשר": "הצוות יצר איתכם קשר לגבי הבקשה",
  "בוטל": "בקשת ההמתנה בוטלה",
};

const LEGEND_TONE_DOT: Record<string, string> = {
  warning: "bg-warning-text",
  info: "bg-info-text",
  success: "bg-success-text",
  danger: "bg-danger-text",
  purple: "bg-purple-500",
};

const APPOINTMENT_STATUS_TONE: Record<AppointmentStatus, string> = {
  "ממתין לתשלום מקדמה": "warning",
  "מאושר": "info",
  "שולם במלואו": "purple",
  "בוצע": "success",
  "בוטל": "danger",
};

function StatusLegend() {
  return (
    <Card className="p-4 mb-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-3">
        <Info className="h-4 w-4 text-primary" /> מה המשמעות של כל סטטוס
      </p>
      <div className="flex flex-col gap-2">
        {(Object.keys(APPOINTMENT_STATUS_DESCRIPTIONS) as AppointmentStatus[]).map((status) => (
          <div key={status} className="flex items-start gap-2 text-xs">
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${LEGEND_TONE_DOT[APPOINTMENT_STATUS_TONE[status]]}`} />
            <span>
              <span className="font-medium text-slate-800">{status}</span>{" "}
              <span className="text-slate-500">— {APPOINTMENT_STATUS_DESCRIPTIONS[status]}</span>
            </span>
          </div>
        ))}
        <div className="flex items-start gap-2 text-xs">
          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${LEGEND_TONE_DOT[WAITLIST_STATUS_TONE["ממתין"]]}`} />
          <span>
            <span className="font-medium text-slate-800">{WAITLIST_STATUS_LABELS["ממתין"]}</span>{" "}
            <span className="text-slate-500">— {WAITLIST_STATUS_DESCRIPTIONS["ממתין"]}</span>
          </span>
        </div>
      </div>
    </Card>
  );
}

type HistoryItem = { kind: "appointment"; data: Appointment } | { kind: "waitlist"; data: WaitlistEntry };

export default function ClientAppointmentsPage() {
  const appointments = useStore((s) => s.appointments);
  const waitlist = useStore((s) => s.waitlist);
  const updateAppointment = useStore((s) => s.updateAppointment);
  const showToast = useStore((s) => s.showToast);
  const currentUser = useStore((s) => s.currentUser);
  const patient = useCurrentPatient();

  const [cancelId, setCancelId] = useState<string | null>(null);

  const isMine = (entry: { created_by_id?: string }) =>
    entry.created_by_id === patient?.id || entry.created_by_id === currentUser?.id;

  const myAppointments = appointments.filter(isMine);
  const myWaitlistEntries = waitlist.filter(isMine);

  // Single chronological list — earliest first — merging real bookings and
  // waitlist requests, rather than splitting into per-day or per-kind views.
  const historyItems = useMemo<HistoryItem[]>(() => {
    const items: HistoryItem[] = [
      ...myAppointments.map((a): HistoryItem => ({ kind: "appointment", data: a })),
      ...myWaitlistEntries.map((w): HistoryItem => ({ kind: "waitlist", data: w })),
    ];
    return items.sort((a, b) => (a.data.date + a.data.time).localeCompare(b.data.date + b.data.time));
  }, [myAppointments, myWaitlistEntries]);

  return (
    <ClientLayout>
      <PageHeader title="היסטוריית תורים" description="כל התורים ובקשות ההמתנה שלכם, מסודרים לפי מועד" />

      <StatusLegend />

      {historyItems.length === 0 ? (
        <EmptyState title="אין לך תורים" description="ניתן לקבוע תור חדש דרך מסך החיפוש" />
      ) : (
        <div className="flex flex-col gap-3">
          {historyItems.map((item, i) => (
            <motion.div key={`${item.kind}-${item.data.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: i * 0.03 }}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      <Calendar className="h-4 w-4 text-primary" /> {formatAppointmentDate(item.data.date)}
                      <span className="flex items-center gap-1 font-normal text-slate-500">
                        <Clock className="h-3.5 w-3.5" /> {item.data.time}
                      </span>
                    </div>
                    {item.kind === "appointment" && <p className="text-sm text-slate-700 mt-1">{item.data.service_name}</p>}
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" /> {item.data.provider_name}
                    </p>
                  </div>
                  {item.kind === "appointment" ? (
                    <StatusBadge
                      status={item.data.status}
                      kind="appointment"
                      title={APPOINTMENT_STATUS_DESCRIPTIONS[item.data.status]}
                    />
                  ) : (
                    <Badge tone={WAITLIST_STATUS_TONE[item.data.status]} title={WAITLIST_STATUS_DESCRIPTIONS[item.data.status]}>
                      {WAITLIST_STATUS_LABELS[item.data.status]}
                    </Badge>
                  )}
                </div>
                {item.kind === "appointment" && item.data.status !== "בוטל" && item.data.status !== "בוצע" && (
                  <div className="mt-3 flex justify-end gap-2">
                    {/* "שלם יתרה" only appears once the deposit is paid ("מאושר").
                        TODO(product, unresolved): nothing here flags or blocks an
                        appointment whose date arrives with the balance still
                        unpaid — see the note on AppointmentStatus in types/index.ts
                        and README.md. */}
                    {item.data.status === "מאושר" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          updateAppointment(item.data.id, { status: "שולם במלואו" });
                          showToast("היתרה שולמה במלואה", { variant: "success" });
                        }}
                      >
                        שלם יתרה
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setCancelId(item.data.id)}>
                      בטל תור
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        title="ביטול תור"
        description="האם אתם בטוחים שתרצו לבטל תור זה?"
        destructive
        confirmLabel="בטל תור"
        onConfirm={() => {
          if (cancelId) {
            updateAppointment(cancelId, { status: "בוטל" });
            showToast("התור בוטל", { variant: "success" });
          }
        }}
      />
    </ClientLayout>
  );
}
