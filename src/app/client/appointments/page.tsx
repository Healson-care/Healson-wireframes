"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import {
  ArrowLeft,
  Calendar,
  CalendarRange,
  ChevronDown,
  Clock,
  CreditCard,
  Info,
  MapPin,
  Phone,
  ShieldCheck,
  Smartphone,
  Star,
  Stethoscope,
  Wallet,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn, formatCurrency } from "@/lib/utils";
import {
  APPOINTMENT_STATUSES,
  Appointment,
  AppointmentStatus,
  WaitlistEntry,
  WaitlistStatus,
} from "@/types";

function formatAppointmentDate(dateIso: string) {
  return new Date(dateIso).toLocaleDateString("he-IL", { weekday: "long", day: "2-digit", month: "2-digit" });
}

function formatShortDate(dateIso: string) {
  return new Date(dateIso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
}

// Cancellation policy: free to cancel while still "ממתין לתשלום מקדמה"
// (nothing charged yet). Once the deposit is paid, cancellation is only
// allowed within 48h of that payment, and the refund is the deposit minus a
// service fee of 5% of the total price or ₪100, whichever is lower. Past the
// 48h window the appointment can no longer be cancelled.
const CANCELLATION_WINDOW_HOURS = 48;
const REFUND_FEE_RATE = 0.05;
const REFUND_FEE_CAP = 100;

type CancellationInfo = { canCancel: boolean; refundAmount: number | null };

function getCancellationInfo(appointment: Appointment): CancellationInfo {
  if (appointment.status === "ממתין לתשלום מקדמה") {
    return { canCancel: true, refundAmount: null };
  }
  if (appointment.status !== "מאושר" && appointment.status !== "שולם במלואו") {
    return { canCancel: false, refundAmount: null };
  }
  if (!appointment.deposit_paid_at) return { canCancel: false, refundAmount: null };
  const hoursSincePaid = (Date.now() - new Date(appointment.deposit_paid_at).getTime()) / (1000 * 60 * 60);
  if (hoursSincePaid > CANCELLATION_WINDOW_HOURS) return { canCancel: false, refundAmount: null };
  const deposit = appointment.deposit_amount ?? 0;
  const price = appointment.price ?? 0;
  const fee = Math.min(price * REFUND_FEE_RATE, REFUND_FEE_CAP);
  const refundAmount = Math.max(0, Math.round(deposit - fee));
  return { canCancel: true, refundAmount };
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
      <div className="h-px bg-slate-100 my-3" />
      <p className="text-xs text-slate-500 leading-relaxed">
        <span className="font-medium text-slate-700">מדיניות ביטול:</span> ניתן לבטל תור ללא עלות עד לתשלום המקדמה.
        עד 48 שעות ממועד תשלום המקדמה ניתן לבטל ולקבל החזר מקדמה בניכוי דמי טיפול (5% מסך העסקה או ₪100 — הנמוך
        מביניהם). לאחר מכן לא ניתן לבטל את התור.
      </p>
    </Card>
  );
}

function PayDepositDialog({
  appointment,
  onClose,
  onPaid,
}: {
  appointment: Appointment | null;
  onClose: () => void;
  onPaid: (id: string) => void;
}) {
  const [payMethod, setPayMethod] = useState<"card" | "apple" | "google">("card");
  const [paying, setPaying] = useState(false);

  return (
    <Dialog
      open={!!appointment}
      onClose={onClose}
      title="תשלום מקדמה"
      description={
        appointment
          ? `${appointment.service_name} · ${appointment.provider_name} · ${formatAppointmentDate(appointment.date)} ${appointment.time}`
          : undefined
      }
    >
      <div className="grid grid-cols-3 gap-2 mb-4">
        <button
          onClick={() => setPayMethod("card")}
          className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium ${payMethod === "card" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500"}`}
        >
          <CreditCard className="h-4 w-4" /> כרטיס אשראי
        </button>
        <button
          onClick={() => setPayMethod("apple")}
          className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium ${payMethod === "apple" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500"}`}
        >
          <Smartphone className="h-4 w-4" /> Apple Pay
        </button>
        <button
          onClick={() => setPayMethod("google")}
          className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium ${payMethod === "google" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500"}`}
        >
          <Smartphone className="h-4 w-4" /> Google Pay
        </button>
      </div>
      {payMethod === "card" && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="col-span-2">
            <Input placeholder="מספר כרטיס" dir="ltr" defaultValue="4580 •••• •••• 1234" />
          </div>
          <Input placeholder="MM/YY" dir="ltr" defaultValue="08/28" />
          <Input placeholder="CVV" dir="ltr" defaultValue="•••" />
        </div>
      )}
      <p className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-4">
        <ShieldCheck className="h-3.5 w-3.5" /> תשלום מאובטח בתקן PCI DSS · מצב הדגמה, לא מתבצע חיוב אמיתי
      </p>
      <Button
        size="lg"
        className="w-full"
        loading={paying}
        onClick={() => {
          if (!appointment) return;
          setPaying(true);
          setTimeout(() => {
            onPaid(appointment.id);
            setPaying(false);
          }, 1200);
        }}
      >
        שלם מקדמה ואשר תור
      </Button>
    </Dialog>
  );
}

type HistoryItem = { kind: "appointment"; data: Appointment } | { kind: "waitlist"; data: WaitlistEntry };

// Both appointments and waitlist entries carry a "status" string, so a single
// filter row covers both kinds. "נוצר קשר" is left out — a waitlist request
// never actually shows that status to the patient, only "ממתין"/"בוטל".
const STATUS_FILTER_OPTIONS: { value: AppointmentStatus | WaitlistStatus; label: string }[] = [
  ...APPOINTMENT_STATUSES.map((s) => ({ value: s, label: s })),
  { value: "ממתין" as WaitlistStatus, label: WAITLIST_STATUS_LABELS["ממתין"] },
];

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
      )}
    >
      {children}
      {active && <X className="h-3 w-3" />}
    </button>
  );
}

export default function ClientAppointmentsPage() {
  const appointments = useStore((s) => s.appointments);
  const waitlist = useStore((s) => s.waitlist);
  const providers = useStore((s) => s.providers);
  const updateAppointment = useStore((s) => s.updateAppointment);
  const showToast = useStore((s) => s.showToast);
  const currentUser = useStore((s) => s.currentUser);
  const patient = useCurrentPatient();

  const [cancelAppointment, setCancelAppointment] = useState<Appointment | null>(null);
  const [payDepositAppointment, setPayDepositAppointment] = useState<Appointment | null>(null);

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateDialogOpen, setDateDialogOpen] = useState(false);

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  function toggleExpanded(id: string) {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

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

  const filteredItems = useMemo(() => {
    return historyItems.filter((item) => {
      if (statusFilter && item.data.status !== statusFilter) return false;
      if (dateFrom && item.data.date < dateFrom) return false;
      if (dateTo && item.data.date > dateTo) return false;
      return true;
    });
  }, [historyItems, statusFilter, dateFrom, dateTo]);

  const hasActiveFilters = !!statusFilter || !!dateFrom || !!dateTo;

  function clearFilters() {
    setStatusFilter(null);
    setDateFrom("");
    setDateTo("");
  }

  return (
    <ClientLayout>
      <PageHeader title="היסטוריית תורים" description="כל התורים ובקשות ההמתנה שלכם, מסודרים לפי מועד" />

      <StatusLegend />

      {historyItems.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
            <div className="flex gap-1.5 w-max">
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.value}
                  active={statusFilter === opt.value}
                  onClick={() => setStatusFilter(statusFilter === opt.value ? null : opt.value)}
                >
                  {opt.label}
                </FilterChip>
              ))}
            </div>
          </div>

          <button
            onClick={() => setDateDialogOpen(true)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              dateFrom || dateTo
                ? "border-primary bg-primary/5 text-primary"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            {dateFrom || dateTo
              ? `${dateFrom ? formatShortDate(dateFrom) : "…"}-${dateTo ? formatShortDate(dateTo) : "…"}`
              : "תאריכים"}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              title="נקה סינון"
              className="flex shrink-0 items-center justify-center rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <Dialog open={dateDialogOpen} onClose={() => setDateDialogOpen(false)} title="סינון לפי תאריכים">
        <div className="flex items-center gap-2 mb-4">
          <Input
            type="date"
            label="מתאריך"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            type="date"
            label="עד תאריך"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
            className="h-9 rounded-lg border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50"
          >
            נקה
          </button>
          <Button size="sm" onClick={() => setDateDialogOpen(false)}>
            החל
          </Button>
        </div>
      </Dialog>

      {historyItems.length === 0 ? (
        <EmptyState title="אין לך תורים" description="ניתן לקבוע תור חדש דרך מסך החיפוש" />
      ) : filteredItems.length === 0 ? (
        <EmptyState title="אין תוצאות" description="לא נמצאו תורים או בקשות התואמים את הסינון שבחרתם" />
      ) : (
        <div className="flex flex-col gap-3">
          {filteredItems.map((item, i) => {
            const isExpanded = !!expandedIds[item.data.id];
            const provider = providers.find((p) => p.id === item.data.provider_id);
            return (
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
                    item.data.status === "ממתין לתשלום מקדמה" ? (
                      <button
                        onClick={() => setPayDepositAppointment(item.data)}
                        title={`${APPOINTMENT_STATUS_DESCRIPTIONS[item.data.status]} — לחצו לתשלום`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-warning-border bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning-text underline decoration-dotted underline-offset-2 transition hover:bg-warning-text hover:text-white hover:no-underline hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-warning-text/40"
                      >
                        <CreditCard className="h-3 w-3" />
                        {item.data.status}
                        <span className="opacity-75">· לתשלום</span>
                      </button>
                    ) : (
                      <StatusBadge
                        status={item.data.status}
                        kind="appointment"
                        title={APPOINTMENT_STATUS_DESCRIPTIONS[item.data.status]}
                      />
                    )
                  ) : (
                    <Badge tone={WAITLIST_STATUS_TONE[item.data.status]} title={WAITLIST_STATUS_DESCRIPTIONS[item.data.status]}>
                      {WAITLIST_STATUS_LABELS[item.data.status]}
                    </Badge>
                  )}
                </div>
                {item.kind === "appointment" && item.data.status !== "בוטל" && item.data.status !== "בוצע" && (
                  <div className="mt-3 flex items-center justify-end gap-2">
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
                    {getCancellationInfo(item.data).canCancel ? (
                      <Button variant="outline" size="sm" onClick={() => setCancelAppointment(item.data)}>
                        בטל תור
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">חלף המועד לביטול תור זה</span>
                    )}
                  </div>
                )}

                <button
                  onClick={() => toggleExpanded(item.data.id)}
                  className="mt-3 flex w-full items-center justify-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600"
                >
                  {isExpanded ? "הצג פחות" : "פרטים נוספים"}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2.5 text-sm">
                        {item.kind === "appointment" && item.data.price !== undefined && (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-slate-500">
                              <Wallet className="h-3.5 w-3.5" /> מחיר
                            </span>
                            <span className="font-medium text-slate-800">
                              {formatCurrency(item.data.price)}
                              {item.data.deposit_amount !== undefined && (
                                <span className="text-xs font-normal text-slate-400">
                                  {" "}
                                  (מקדמה {formatCurrency(item.data.deposit_amount)})
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                        {item.kind === "appointment" && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">משך הפגישה</span>
                            <span className="font-medium text-slate-800">{item.data.duration_minutes} דק׳</span>
                          </div>
                        )}
                        {item.kind === "appointment" && provider?.clinic_locations[0] && (
                          <div className="flex items-start justify-between">
                            <span className="text-slate-500">סניף</span>
                            <span className="text-left">
                              <span className="block font-medium text-slate-800">{provider.clinic_locations[0].name}</span>
                              <span className="text-xs text-slate-400">
                                {provider.clinic_locations[0].address}, {provider.clinic_locations[0].city}
                              </span>
                            </span>
                          </div>
                        )}
                        {item.kind === "appointment" && item.data.notes && (
                          <div>
                            <span className="block text-slate-500 mb-0.5">הערות</span>
                            <p className="text-slate-700">{item.data.notes}</p>
                          </div>
                        )}

                        {provider && (
                          <div className="flex flex-col gap-1.5 rounded-lg bg-slate-50 p-3">
                            <p className="flex items-center gap-1.5 font-medium text-slate-800">
                              <Stethoscope className="h-3.5 w-3.5 text-primary" />
                              {provider.title} {provider.display_name}
                              {provider.specialty && ` · ${provider.specialty}`}
                            </p>
                            {provider.rating !== undefined && (
                              <p className="flex items-center gap-1 text-xs text-slate-500">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {provider.rating.toFixed(1)}
                                {provider.review_count !== undefined && ` (${provider.review_count} ביקורות)`}
                              </p>
                            )}
                            {provider.clinic_locations[0]?.phone && (
                              <p className="flex items-center gap-1 text-xs text-slate-500">
                                <Phone className="h-3 w-3" /> {provider.clinic_locations[0].phone}
                              </p>
                            )}
                          </div>
                        )}

                        {item.data.status === "בוטל" && (
                          <Link href="/client/search">
                            <Button size="sm" className="w-full mt-1">
                              קבע תור חדש <ArrowLeft className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!cancelAppointment}
        onClose={() => setCancelAppointment(null)}
        title="ביטול תור"
        description={
          cancelAppointment && getCancellationInfo(cancelAppointment).refundAmount !== null
            ? `יוחזרו לכם ${formatCurrency(getCancellationInfo(cancelAppointment).refundAmount ?? 0)} מתוך המקדמה ששולמה, בניכוי דמי טיפול (5% מסך העסקה או ₪100 — הנמוך מביניהם).`
            : "טרם שולמה מקדמה עבור תור זה, כך שהביטול הוא ללא עלות."
        }
        destructive
        confirmLabel="בטל תור"
        onConfirm={() => {
          if (!cancelAppointment) return;
          const { refundAmount } = getCancellationInfo(cancelAppointment);
          updateAppointment(cancelAppointment.id, { status: "בוטל" });
          showToast(refundAmount ? `התור בוטל, ${formatCurrency(refundAmount)} יוחזרו לאמצעי התשלום` : "התור בוטל", {
            variant: "success",
          });
        }}
      />

      <PayDepositDialog
        appointment={payDepositAppointment}
        onClose={() => setPayDepositAppointment(null)}
        onPaid={(id) => {
          updateAppointment(id, { status: "מאושר", deposit_paid_at: new Date().toISOString() });
          showToast("התשלום התקבל, התור אושר", { variant: "success" });
          setPayDepositAppointment(null);
        }}
      />
    </ClientLayout>
  );
}
