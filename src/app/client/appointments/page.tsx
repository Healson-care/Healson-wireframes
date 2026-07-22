"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { Popover } from "@/components/ui/Popover";
import { AppointmentReminderPlan } from "@/components/patient/AppointmentReminderPlan";
import { SlotPicker } from "@/components/book/SlotPicker";
import { WaitlistJoinDialog } from "@/components/book/WaitlistJoinDialog";
import {
  ArrowLeft,
  BellRing,
  Calendar,
  CalendarClock,
  CalendarRange,
  Check,
  ChevronDown,
  Circle,
  ClipboardList,
  Clock,
  CreditCard,
  FileText,
  ListFilter,
  MapPin,
  Phone,
  ShieldCheck,
  Smartphone,
  Star,
  Stethoscope,
  Upload,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn, formatCurrency } from "@/lib/utils";
import { fileToDataUrl, validateDocumentFile } from "@/lib/file";
import {
  Appointment,
  AppointmentStatus,
  DOCUMENT_CATEGORIES,
  WaitlistEntry,
  WaitlistStatus,
} from "@/types";

function formatAppointmentDate(dateIso: string) {
  return new Date(dateIso).toLocaleDateString("he-IL", { weekday: "long", day: "2-digit", month: "2-digit" });
}

function formatShortDate(dateIso: string) {
  return new Date(dateIso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isPastDate(dateIso?: string) {
  return !!dateIso && dateIso < todayIso();
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

function CancellationPolicy() {
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-3 mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-xs font-semibold text-slate-700"
      >
        מדיניות ביטול
        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="text-xs text-slate-500 leading-relaxed pt-2">
              ניתן לבטל תור ללא עלות עד לתשלום המקדמה. עד 48 שעות ממועד תשלום המקדמה ניתן לבטל ולקבל החזר מקדמה
              בניכוי דמי טיפול (5% מסך העסקה או ₪100 — הנמוך מביניהם). לאחר מכן לא ניתן לבטל את התור.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function PaymentMethodFields({
  payMethod,
  onPayMethodChange,
  saveCard,
  onSaveCardChange,
}: {
  payMethod: "card" | "apple" | "google";
  onPayMethodChange: (method: "card" | "apple" | "google") => void;
  saveCard: boolean;
  onSaveCardChange: (checked: boolean) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <button
          onClick={() => onPayMethodChange("card")}
          className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium ${payMethod === "card" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500"}`}
        >
          <CreditCard className="h-4 w-4" /> כרטיס אשראי
        </button>
        <button
          onClick={() => onPayMethodChange("apple")}
          className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium ${payMethod === "apple" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500"}`}
        >
          <Smartphone className="h-4 w-4" /> Apple Pay
        </button>
        <button
          onClick={() => onPayMethodChange("google")}
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
          <label className="col-span-2 flex items-center gap-2 text-xs text-slate-500 mt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={saveCard}
              onChange={(e) => onSaveCardChange(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            שמור את פרטי הכרטיס לתשלומים הבאים (הדגמה)
          </label>
        </div>
      )}
      <p className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-4">
        <ShieldCheck className="h-3.5 w-3.5" /> תשלום מאובטח בתקן PCI DSS · מצב הדגמה, לא מתבצע חיוב אמיתי
      </p>
    </>
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
  const [saveCard, setSaveCard] = useState(false);

  const price = appointment?.price ?? 0;
  const depositAmount = appointment?.deposit_amount ?? Math.round(price * 0.3);
  const balanceAmount = price - depositAmount;

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
      <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">מקדמה לתשלום</span>
          <span className="text-lg font-bold text-primary">{formatCurrency(depositAmount)}</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          לשריון התור נדרש תשלום מקדמה עכשיו. היתרה תיגבה במועד התור.
        </p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-slate-400">יתרה לתשלום בתור</span>
          <span className="text-[11px] text-slate-400">{formatCurrency(balanceAmount)}</span>
        </div>
      </div>
      <PaymentMethodFields
        payMethod={payMethod}
        onPayMethodChange={setPayMethod}
        saveCard={saveCard}
        onSaveCardChange={setSaveCard}
      />
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
        שלם {formatCurrency(depositAmount)} ואשר תור
      </Button>
    </Dialog>
  );
}

function PayBalanceDialog({
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
  const [saveCard, setSaveCard] = useState(false);

  const price = appointment?.price ?? 0;
  const depositAmount = appointment?.deposit_amount ?? Math.round(price * 0.3);
  const balanceAmount = price - depositAmount;

  return (
    <Dialog
      open={!!appointment}
      onClose={onClose}
      title="תשלום יתרה"
      description={
        appointment
          ? `${appointment.service_name} · ${appointment.provider_name} · ${formatAppointmentDate(appointment.date)} ${appointment.time}`
          : undefined
      }
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">יתרה לתשלום</span>
          <span className="text-lg font-bold text-primary">{formatCurrency(balanceAmount)}</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          זהו התשלום האחרון להשלמת התור — המקדמה כבר שולמה קודם.
        </p>
      </div>
      <PaymentMethodFields
        payMethod={payMethod}
        onPayMethodChange={setPayMethod}
        saveCard={saveCard}
        onSaveCardChange={setSaveCard}
      />
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
        שלם {formatCurrency(balanceAmount)}
      </Button>
    </Dialog>
  );
}

function RescheduleDialog({
  appointment,
  onClose,
  onRescheduled,
}: {
  appointment: Appointment | null;
  onClose: () => void;
  onRescheduled: (id: string, date: string, time: string, clinicId: string) => void;
}) {
  const providers = useStore((s) => s.providers);
  const appointments = useStore((s) => s.appointments);
  const [waitlistSlot, setWaitlistSlot] = useState<{ date?: string; time?: string; label?: string } | null>(null);

  const provider = appointment ? providers.find((p) => p.id === appointment.provider_id) : undefined;
  // Exclude the appointment being rescheduled from the occupancy check —
  // otherwise its own current slot would show up as "taken" by itself.
  const otherAppointments = useMemo(
    () => (appointment ? appointments.filter((a) => a.id !== appointment.id) : appointments),
    [appointments, appointment]
  );

  return (
    <>
      <Dialog
        open={!!appointment && !!provider}
        onClose={onClose}
        title="עדכון מועד התור"
        description={appointment ? `${appointment.service_name} · ${appointment.provider_name}` : undefined}
      >
        {appointment && provider && (
          <SlotPicker
            provider={provider}
            appointments={otherAppointments}
            onSelectSlot={(date, time, _label, clinicId) => onRescheduled(appointment.id, date, time, clinicId)}
            onJoinWaitlist={(date, time, label) => setWaitlistSlot({ date, time, label })}
            serviceId={
              provider.consultation_types.find((s) => s.name === appointment.service_name)?.id
            }
          />
        )}
      </Dialog>

      <WaitlistJoinDialog
        provider={provider ?? null}
        slot={waitlistSlot}
        onClose={() => setWaitlistSlot(null)}
        clientName={appointment?.client_name ?? ""}
        clientPhone={appointment?.client_phone}
        createdById={appointment?.created_by_id}
      />
    </>
  );
}

type HistoryItem = { kind: "appointment"; data: Appointment } | { kind: "waitlist"; data: WaitlistEntry };

// Earliest-first sort key shared by every section — general waitlist requests
// with no date/time sort first, as the most open-ended entries.
function historySortKey(item: HistoryItem) {
  return (item.data.date ?? "") + (item.data.time ?? "");
}

// Which of the three page sections an item belongs to. Deliberately keyed off
// the *actual* date rather than status alone: an appointment can be stuck at
// "מאושר" past its own date (balance never paid — see the open product note
// in CLAUDE.local.md), and it should still fall into history rather than
// linger under "תורים קרובים" forever.
type ItemBucket = "upcoming" | "pending" | "history";

function classifyItem(item: HistoryItem): ItemBucket {
  const { status } = item.data;
  if (item.kind === "appointment") {
    if (status === "בוטל" || status === "בוצע" || isPastDate(item.data.date)) return "history";
    return status === "ממתין לתשלום מקדמה" ? "pending" : "upcoming";
  }
  if (status === "בוטל" || isPastDate(item.data.date)) return "history";
  return "pending";
}

const UPCOMING_STATUS_OPTIONS: { value: AppointmentStatus; label: string; description: string }[] = [
  { value: "מאושר", label: "מאושר", description: APPOINTMENT_STATUS_DESCRIPTIONS["מאושר"] },
  { value: "שולם במלואו", label: "שולם במלואו", description: APPOINTMENT_STATUS_DESCRIPTIONS["שולם במלואו"] },
];

const PENDING_STATUS_OPTIONS: { value: AppointmentStatus | WaitlistStatus; label: string; description: string }[] = [
  {
    value: "ממתין לתשלום מקדמה",
    label: "ממתין לתשלום מקדמה",
    description: APPOINTMENT_STATUS_DESCRIPTIONS["ממתין לתשלום מקדמה"],
  },
  { value: "ממתין" as WaitlistStatus, label: WAITLIST_STATUS_LABELS["ממתין"], description: WAITLIST_STATUS_DESCRIPTIONS["ממתין"] },
  {
    value: "נוצר קשר" as WaitlistStatus,
    label: WAITLIST_STATUS_LABELS["נוצר קשר"],
    description: WAITLIST_STATUS_DESCRIPTIONS["נוצר קשר"],
  },
];

const HISTORY_STATUS_OPTIONS: { value: AppointmentStatus | WaitlistStatus; label: string; description: string }[] = [
  { value: "בוצע", label: "בוצע", description: APPOINTMENT_STATUS_DESCRIPTIONS["בוצע"] },
  { value: "בוטל", label: "בוטל", description: "התור בוטל, או שבקשת ההמתנה בוטלה" },
];

function SectionJumpTab({ label, count, targetId }: { label: string; count: number; targetId: string }) {
  return (
    <button
      onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })}
      className="text-xs font-medium text-slate-500 underline decoration-slate-300 decoration-dotted underline-offset-2 transition-colors hover:text-primary hover:decoration-primary"
    >
      {label} <span className="text-slate-400">({count})</span>
    </button>
  );
}

function AppointmentListCard({
  item,
  index,
  highlightId,
  isExpanded,
  onToggleExpanded,
  onPayDeposit,
  onPayBalance,
  onCancel,
  onReschedule,
}: {
  item: HistoryItem;
  index: number;
  highlightId: string | null;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onPayDeposit: (appointment: Appointment) => void;
  onPayBalance: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
  onReschedule: (appointment: Appointment) => void;
}) {
  const router = useRouter();
  const providers = useStore((s) => s.providers);
  const documents = useStore((s) => s.documents);
  const addDocument = useStore((s) => s.addDocument);
  const updateDocument = useStore((s) => s.updateDocument);
  const showToast = useStore((s) => s.showToast);

  const provider = providers.find((p) => p.id === item.data.provider_id);
  const bookedClinicId = item.kind === "appointment" ? item.data.clinic_id : undefined;
  const bookedClinic =
    provider?.clinic_locations.find((c) => c.id === bookedClinicId) ??
    provider?.clinic_locations.find((c) => c.is_primary) ??
    provider?.clinic_locations[0];
  const linkedDocs = item.kind === "appointment" ? documents.filter((d) => d.appointment_id === item.data.id) : [];
  // The pre-appointment checklist — every linked doc still waiting on the
  // patient, regardless of category (named required docs from
  // ConsultationType.required_documents, plus questionnaires).
  const pendingRequiredDocs = linkedDocs.filter((d) => d.status === "ממתין למילוי");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  function handleFillQuestionnaire(docId: string) {
    updateDocument(docId, { status: "זמין" });
    showToast("השאלון מולא בהצלחה", { variant: "success" });
  }

  // Fulfils one specific checklist item (a named required document) by
  // attaching the uploaded file directly to its existing placeholder record,
  // rather than creating a new document.
  async function handleFulfillRequiredDoc(docId: string, file: File | null) {
    if (!file) return;
    const validationError = validateDocumentFile(file);
    if (validationError) {
      showToast(validationError, { variant: "destructive" });
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    updateDocument(docId, {
      status: "זמין",
      file: { file_name: file.name, uploaded_at: new Date().toISOString(), data_url: dataUrl },
    });
    showToast("המסמך הועלה בהצלחה", { variant: "success" });
  }

  // For anything NOT on the required-documents checklist — patients can add
  // as many of these as they like, each becomes its own "other" document.
  async function handleUploadDocument(e: React.FormEvent) {
    e.preventDefault();
    if (item.kind !== "appointment" || !uploadTitle.trim()) return;
    setUploading(true);
    addDocument({
      patient_id: item.data.created_by_id ?? "",
      category: "other",
      title: uploadTitle.trim(),
      uploaded_by: "patient",
      appointment_id: item.data.id,
      file: uploadFile
        ? { file_name: uploadFile.name, uploaded_at: new Date().toISOString(), data_url: await fileToDataUrl(uploadFile) }
        : undefined,
    });
    setUploading(false);
    setUploadOpen(false);
    setUploadTitle("");
    setUploadFile(null);
    showToast("המסמך הועלה בהצלחה", { variant: "success" });
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: index * 0.03 }}>
      <Card id={`appt-${item.data.id}`} className={cn("p-4", highlightId === item.data.id && "ring-2 ring-primary")}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-900">
              {item.data.date ? (
                <>
                  <Calendar className="h-4 w-4 shrink-0 text-primary" /> {formatAppointmentDate(item.data.date)}
                  {item.data.time && (
                    <span className="flex items-center gap-1 font-normal text-slate-500">
                      <Clock className="h-3.5 w-3.5" /> {item.data.time}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <BellRing className="h-4 w-4 shrink-0 text-primary" /> כל מועד פנוי
                </>
              )}
            </div>
            {item.kind === "appointment" && <p className="text-sm text-slate-700 mt-1">{item.data.service_name}</p>}
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" /> {item.data.provider_name}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {item.kind === "appointment" ? (
              item.data.status === "ממתין לתשלום מקדמה" ? (
                <button
                  onClick={() => onPayDeposit(item.data)}
                  title={`${APPOINTMENT_STATUS_DESCRIPTIONS[item.data.status]} — לחצו לתשלום`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-warning-border bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning-text underline decoration-dotted underline-offset-2 transition hover:bg-warning-text hover:text-white hover:no-underline hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-warning-text/40"
                >
                  <CreditCard className="h-3 w-3" />
                  {item.data.status}
                  <span className="opacity-75">· לתשלום</span>
                </button>
              ) : (
                <Popover
                  align="end"
                  trigger={
                    <span className="inline-flex cursor-pointer underline decoration-dotted underline-offset-2">
                      <StatusBadge
                        status={item.data.status}
                        kind="appointment"
                        title={APPOINTMENT_STATUS_DESCRIPTIONS[item.data.status]}
                      />
                    </span>
                  }
                >
                  {() => (
                    <p className="text-xs leading-relaxed text-slate-600">
                      {APPOINTMENT_STATUS_DESCRIPTIONS[item.data.status]}
                    </p>
                  )}
                </Popover>
              )
            ) : (
              <Popover
                align="end"
                trigger={
                  <span className="inline-flex cursor-pointer underline decoration-dotted underline-offset-2">
                    <Badge tone={WAITLIST_STATUS_TONE[item.data.status]} title={WAITLIST_STATUS_DESCRIPTIONS[item.data.status]}>
                      {WAITLIST_STATUS_LABELS[item.data.status]}
                    </Badge>
                  </span>
                }
              >
                {() => (
                  <p className="text-xs leading-relaxed text-slate-600">
                    {WAITLIST_STATUS_DESCRIPTIONS[item.data.status]}
                  </p>
                )}
              </Popover>
            )}
            {item.kind === "appointment" && pendingRequiredDocs.length > 0 && (
              <button
                onClick={() => !isExpanded && onToggleExpanded()}
                title="יש מסמכים שממתינים לכם לפני התור — לחצו לפרטים"
                className="flex items-center gap-1 rounded-full border border-warning-border bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning-text"
              >
                <ClipboardList className="h-3 w-3" /> {pendingRequiredDocs.length} מסמכים נדרשים
              </button>
            )}
          </div>
        </div>

        <button
          onClick={onToggleExpanded}
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
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-4 text-sm">
                {item.kind === "appointment" && (
                  <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3">
                    {item.data.price !== undefined && (
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
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">משך הפגישה</span>
                      <span className="font-medium text-slate-800">{item.data.duration_minutes} דק׳</span>
                    </div>
                    {bookedClinic && (
                      <div className="flex items-start justify-between">
                        <span className="text-slate-500">סניף</span>
                        <span className="text-left">
                          <span className="block font-medium text-slate-800">{bookedClinic.name}</span>
                          <span className="text-xs text-slate-400">
                            {bookedClinic.address}, {bookedClinic.city}
                          </span>
                        </span>
                      </div>
                    )}
                    {item.data.notes && (
                      <div className="pt-2 border-t border-slate-200">
                        <span className="block text-slate-500 mb-0.5">הערות</span>
                        <p className="text-slate-700">{item.data.notes}</p>
                      </div>
                    )}
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
                    {bookedClinic?.phone && (
                      <a
                        href={`tel:${bookedClinic.phone}`}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Phone className="h-3 w-3" /> {bookedClinic.phone}
                      </a>
                    )}
                  </div>
                )}

                {item.kind === "appointment" && (
                  <div className="flex flex-col gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <FileText className="h-3.5 w-3.5 text-primary" /> מסמכים
                    </p>
                    {pendingRequiredDocs.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
                          <ClipboardList className="h-3.5 w-3.5 text-primary" /> מסמכים נדרשים לפני התור ({pendingRequiredDocs.length})
                        </p>
                        <div className="flex flex-col gap-2">
                          {pendingRequiredDocs.map((d) => (
                            <div
                              key={d.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                            >
                              <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-700">
                                <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                                <span className="truncate">{d.title}</span>
                              </span>
                              {d.category === "questionnaire" ? (
                                <Button variant="outline" size="sm" className="shrink-0" onClick={() => handleFillQuestionnaire(d.id)}>
                                  מלא עכשיו
                                </Button>
                              ) : (
                                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-primary hover:text-primary">
                                  <Upload className="h-3.5 w-3.5" /> העלאה
                                  <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="hidden"
                                    onChange={(e) => handleFulfillRequiredDoc(d.id, e.target.files?.[0] ?? null)}
                                  />
                                </label>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      {linkedDocs.length > 0 && (
                        <Popover
                          trigger={
                            <span className="flex items-center gap-1 text-xs text-primary hover:underline">
                              <FileText className="h-3 w-3" /> מסמכים מקושרים ({linkedDocs.length})
                            </span>
                          }
                        >
                          {(close) => (
                            <div className="flex flex-col gap-2 text-sm">
                              <p className="font-semibold text-slate-900">מסמכים לתור זה</p>
                              <div className="flex flex-col gap-1.5">
                                {linkedDocs.map((d) => {
                                  const isPending = d.status === "ממתין למילוי";
                                  return (
                                    <div
                                      key={d.id}
                                      className={cn(
                                        "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5",
                                        isPending ? "bg-warning-bg" : "bg-slate-50"
                                      )}
                                    >
                                      <span className={cn("text-xs font-medium truncate", isPending ? "text-warning-text" : "text-slate-700")}>
                                        {d.title}
                                      </span>
                                      <span className={cn("shrink-0 text-[10px]", isPending ? "text-warning-text" : "text-slate-400")}>
                                        {isPending ? "ממתין למילוי" : DOCUMENT_CATEGORIES.find((c) => c.id === d.category)?.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                              <Button
                                size="sm"
                                className="mt-1 w-full"
                                onClick={() => {
                                  close();
                                  router.push(`/client/documents?appointment=${item.data.id}`);
                                }}
                              >
                                לצפייה מלאה במסמכים
                              </Button>
                            </div>
                          )}
                        </Popover>
                      )}
                      <button
                        onClick={() => setUploadOpen(true)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Upload className="h-3 w-3" /> הוספת מסמך אחר
                      </button>
                    </div>
                  </div>
                )}

                {item.kind === "appointment" &&
                  item.data.status !== "בוטל" &&
                  item.data.status !== "בוצע" && (
                    <AppointmentReminderPlan appointment={item.data} provider={provider} />
                  )}

                {item.kind === "appointment" && item.data.status !== "בוטל" && item.data.status !== "בוצע" && (
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    {/* "שלם יתרה" only appears once the deposit is paid ("מאושר").
                        TODO(product, unresolved): nothing here flags or blocks an
                        appointment whose date arrives with the balance still
                        unpaid — see the note on AppointmentStatus in types/index.ts
                        and README.md. */}
                    {item.data.status === "מאושר" && (
                      <Button size="sm" onClick={() => onPayBalance(item.data)}>
                        שלם יתרה
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => onReschedule(item.data)}>
                      <CalendarClock className="h-3.5 w-3.5" /> עדכון תור
                    </Button>
                    {getCancellationInfo(item.data).canCancel ? (
                      <Button variant="outline" size="sm" onClick={() => onCancel(item.data)}>
                        בטל תור
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">חלף המועד לביטול תור זה</span>
                    )}
                  </div>
                )}

                {item.data.status === "בוטל" && (
                  <div className="flex justify-end border-t border-slate-100 pt-3">
                    <Link href="/client/search">
                      <Button size="sm">
                        קבע מחדש <ArrowLeft className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {item.kind === "appointment" && (
        <Dialog
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          title="הוספת מסמך אחר"
          description="מסמך שאינו ברשימת המסמכים הנדרשים לתור זה — אפשר להוסיף כמה שצריך"
        >
          <form onSubmit={handleUploadDocument} className="flex flex-col gap-3">
            <Input
              label="שם המסמך"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder='לדוגמה: "תוצאות בדיקה נוספת"'
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">קובץ</label>
              <FileDropzone file={uploadFile} onFileChange={setUploadFile} />
            </div>
            <Button type="submit" loading={uploading} className="mt-2">
              <Upload className="h-4 w-4" /> העלה
            </Button>
          </form>
        </Dialog>
      )}
    </motion.div>
  );
}

// One collapsible group of checkboxes inside the combined filter popover —
// shared markup for the status/provider/service sections so the panel stays
// visually consistent without three near-duplicate blocks.
function FilterChecklist({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: string[];
  options: { value: string; label: string }[];
  onChange: (values: string[]) => void;
}) {
  function toggle(value: string) {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  }
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-slate-500">{label}</p>
      <div className="flex flex-col gap-0.5">
        {options.map((opt) => {
          const checked = values.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-right text-sm transition-colors",
                checked ? "font-medium text-primary" : "text-slate-700 hover:bg-slate-50"
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  checked ? "border-primary bg-primary text-white" : "border-slate-300"
                )}
              >
                {checked && <Check className="h-3 w-3" />}
              </span>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AppointmentSection({
  id,
  title,
  description,
  items,
  statusOptions,
  emptyTitle,
  emptyDescription,
  showEmptyState,
  showDateFilter = true,
  showProviderFilter = false,
  showServiceFilter = false,
  highlightId,
  expandedIds,
  onToggleExpanded,
  onPayDeposit,
  onPayBalance,
  onCancel,
  onReschedule,
}: {
  id: string;
  title: string;
  description?: string;
  items: HistoryItem[];
  statusOptions: { value: AppointmentStatus | WaitlistStatus; label: string; description: string }[];
  emptyTitle?: string;
  emptyDescription?: string;
  showEmptyState?: boolean;
  showDateFilter?: boolean;
  showProviderFilter?: boolean;
  showServiceFilter?: boolean;
  highlightId: string | null;
  expandedIds: Record<string, boolean>;
  onToggleExpanded: (id: string) => void;
  onPayDeposit: (appointment: Appointment) => void;
  onPayBalance: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
  onReschedule: (appointment: Appointment) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [providerFilter, setProviderFilter] = useState<string[]>([]);
  const [serviceFilter, setServiceFilter] = useState<string[]>([]);

  const providerOptions = useMemo(() => {
    const names = new Set(items.map((item) => item.data.provider_name));
    return [...names].sort().map((name) => ({ value: name, label: name }));
  }, [items]);

  const serviceOptions = useMemo(() => {
    const names = new Set(
      items.filter((item): item is { kind: "appointment"; data: Appointment } => item.kind === "appointment").map((item) => item.data.service_name)
    );
    return [...names].sort().map((name) => ({ value: name, label: name }));
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter.length > 0 && !statusFilter.includes(item.data.status)) return false;
      if (dateFrom && item.data.date && item.data.date < dateFrom) return false;
      if (dateTo && item.data.date && item.data.date > dateTo) return false;
      if (providerFilter.length > 0 && !providerFilter.includes(item.data.provider_name)) return false;
      if (serviceFilter.length > 0 && (item.kind !== "appointment" || !serviceFilter.includes(item.data.service_name))) return false;
      return true;
    });
  }, [items, statusFilter, dateFrom, dateTo, providerFilter, serviceFilter]);

  const hasActiveFilters =
    statusFilter.length > 0 ||
    (showDateFilter && (!!dateFrom || !!dateTo)) ||
    providerFilter.length > 0 ||
    serviceFilter.length > 0;

  const activeFilterCount =
    (statusFilter.length > 0 ? 1 : 0) +
    (providerFilter.length > 0 ? 1 : 0) +
    (serviceFilter.length > 0 ? 1 : 0) +
    (showDateFilter && (dateFrom || dateTo) ? 1 : 0);

  function clearFilters() {
    setStatusFilter([]);
    setDateFrom("");
    setDateTo("");
    setProviderFilter([]);
    setServiceFilter([]);
  }

  // Nothing here and nothing to say about it — stay out of the way instead
  // of stacking an empty box under every section header.
  if (items.length === 0 && !showEmptyState) return null;

  return (
    <section id={id} className="mb-6 scroll-mt-20">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && <p className="text-xs text-slate-500 mt-0.5 mb-3">{description}</p>}

      {items.length === 0 ? (
        <EmptyState title={emptyTitle ?? "אין פריטים"} description={emptyDescription ?? ""} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5 mb-3 mt-3">
            <Popover
              trigger={
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    hasActiveFilters
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <ListFilter className="h-3.5 w-3.5" />
                  סינון
                  {hasActiveFilters && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5" />
                </span>
              }
            >
              {(close) => (
                <div className="flex w-60 flex-col gap-3">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <button
                      onClick={clearFilters}
                      disabled={!hasActiveFilters}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      נקה הכל
                    </button>
                    <Button size="sm" onClick={close}>
                      החל
                    </Button>
                  </div>
                  <FilterChecklist
                    label="סטטוס"
                    values={statusFilter}
                    options={statusOptions.map((opt) => ({ value: opt.value, label: opt.label }))}
                    onChange={setStatusFilter}
                  />
                  {showProviderFilter && (
                    <FilterChecklist
                      label="נותן שירות"
                      values={providerFilter}
                      options={providerOptions}
                      onChange={setProviderFilter}
                    />
                  )}
                  {showServiceFilter && (
                    <FilterChecklist
                      label="סוג טיפול"
                      values={serviceFilter}
                      options={serviceOptions}
                      onChange={setServiceFilter}
                    />
                  )}
                  {showDateFilter && (
                    <div>
                      <p className="mb-1 text-xs font-semibold text-slate-500">טווח תאריכים</p>
                      <button
                        onClick={() => setDateDialogOpen(true)}
                        className={cn(
                          "flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
                          dateFrom || dateTo
                            ? "border-primary text-primary"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <CalendarRange className="h-3.5 w-3.5" />
                        {dateFrom || dateTo
                          ? `${dateFrom ? formatShortDate(dateFrom) : "…"}-${dateTo ? formatShortDate(dateTo) : "…"}`
                          : "בחירת טווח"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Popover>
          </div>

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

          {filteredItems.length === 0 ? (
            <EmptyState title="אין תוצאות" description="לא נמצאו תורים או בקשות התואמים את הסינון שבחרתם" />
          ) : (
            <div className="flex flex-col gap-3">
              {filteredItems.map((item, i) => (
                <AppointmentListCard
                  key={`${item.kind}-${item.data.id}`}
                  item={item}
                  index={i}
                  highlightId={highlightId}
                  isExpanded={!!expandedIds[item.data.id]}
                  onToggleExpanded={() => onToggleExpanded(item.data.id)}
                  onPayDeposit={onPayDeposit}
                  onPayBalance={onPayBalance}
                  onCancel={onCancel}
                  onReschedule={onReschedule}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ClientAppointmentsPageContent() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("appointment");

  const appointments = useStore((s) => s.appointments);
  const waitlist = useStore((s) => s.waitlist);
  const updateAppointment = useStore((s) => s.updateAppointment);
  const addDocument = useStore((s) => s.addDocument);
  const showToast = useStore((s) => s.showToast);
  const currentUser = useStore((s) => s.currentUser);
  const patient = useCurrentPatient();

  const [cancelAppointment, setCancelAppointment] = useState<Appointment | null>(null);
  const [payDepositAppointment, setPayDepositAppointment] = useState<Appointment | null>(null);
  const [payBalanceAppointment, setPayBalanceAppointment] = useState<Appointment | null>(null);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<Appointment | null>(null);

  // Arrived here via a "קשור לתור" link on a document — pre-expand that
  // appointment's details on mount.
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() =>
    highlightId ? { [highlightId]: true } : {}
  );
  function toggleExpanded(id: string) {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  useEffect(() => {
    if (!highlightId) return;
    document.getElementById(`appt-${highlightId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId]);

  const isMine = (entry: { created_by_id?: string }) =>
    entry.created_by_id === patient?.id || entry.created_by_id === currentUser?.id;

  const myAppointments = appointments.filter(isMine);
  const myWaitlistEntries = waitlist.filter(isMine);

  const historyItems = useMemo<HistoryItem[]>(
    () => [
      ...myAppointments.map((a): HistoryItem => ({ kind: "appointment", data: a })),
      ...myWaitlistEntries.map((w): HistoryItem => ({ kind: "waitlist", data: w })),
    ],
    [myAppointments, myWaitlistEntries]
  );

  // Split into three sections: confirmed future appointments, requests still
  // waiting on the patient/clinic to move forward, and everything whose date
  // has already passed (see classifyItem for why that's date-based, not
  // status-based).
  const upcomingItems = useMemo(
    () =>
      historyItems
        .filter((i) => classifyItem(i) === "upcoming")
        .sort((a, b) => historySortKey(a).localeCompare(historySortKey(b))),
    [historyItems]
  );
  const pendingItems = useMemo(
    () =>
      historyItems
        .filter((i) => classifyItem(i) === "pending")
        .sort((a, b) => historySortKey(a).localeCompare(historySortKey(b))),
    [historyItems]
  );
  const pastItems = useMemo(
    () =>
      historyItems
        .filter((i) => classifyItem(i) === "history")
        .sort((a, b) => historySortKey(b).localeCompare(historySortKey(a))),
    [historyItems]
  );

  return (
    <ClientLayout>
      <PageHeader title="התורים שלי" description="כל התורים ובקשות ההמתנה שלכם, לפי תאריך" />

      {historyItems.length === 0 ? (
        <EmptyState title="אין לך תורים" description="ניתן לקבוע תור חדש דרך מסך החיפוש" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mb-4">
            <SectionJumpTab label="תורים קרובים" count={upcomingItems.length} targetId="section-upcoming" />
            <span className="text-xs text-slate-300">·</span>
            <SectionJumpTab label="ממתינים לאישור" count={pendingItems.length} targetId="section-pending" />
            <span className="text-xs text-slate-300">·</span>
            <SectionJumpTab label="היסטוריית תורים" count={pastItems.length} targetId="section-history" />
          </div>

          <AppointmentSection
            id="section-upcoming"
            title="תורים קרובים"
            description="התורים המאושרים הקרובים שלכם, מהמוקדם למאוחר"
            items={upcomingItems}
            statusOptions={UPCOMING_STATUS_OPTIONS}
            emptyTitle="אין תורים קרובים"
            emptyDescription="ניתן לקבוע תור חדש דרך מסך החיפוש"
            showEmptyState
            showDateFilter={false}
            highlightId={highlightId}
            expandedIds={expandedIds}
            onToggleExpanded={toggleExpanded}
            onPayDeposit={setPayDepositAppointment}
            onPayBalance={setPayBalanceAppointment}
            onCancel={setCancelAppointment}
            onReschedule={setRescheduleAppointment}
          />

          <AppointmentSection
            id="section-pending"
            title="ממתינים לאישור"
            description="תורים שטרם שולמה עבורם מקדמה, ובקשות המתנה שטרם נענו"
            items={pendingItems}
            statusOptions={PENDING_STATUS_OPTIONS}
            emptyTitle="אין בקשות ממתינות"
            emptyDescription="כל התורים שלכם מאושרים, או מופיעים בהיסטוריה"
            showEmptyState
            highlightId={highlightId}
            expandedIds={expandedIds}
            onToggleExpanded={toggleExpanded}
            onPayDeposit={setPayDepositAppointment}
            onPayBalance={setPayBalanceAppointment}
            onCancel={setCancelAppointment}
            onReschedule={setRescheduleAppointment}
          />

          <AppointmentSection
            id="section-history"
            title="היסטוריית תורים"
            description="תורים שהתקיימו, בוטלו, או שתאריכם כבר חלף"
            items={pastItems}
            statusOptions={HISTORY_STATUS_OPTIONS}
            showProviderFilter
            showServiceFilter
            highlightId={highlightId}
            expandedIds={expandedIds}
            onToggleExpanded={toggleExpanded}
            onPayDeposit={setPayDepositAppointment}
            onPayBalance={setPayBalanceAppointment}
            onCancel={setCancelAppointment}
            onReschedule={setRescheduleAppointment}
          />

          <CancellationPolicy />
        </>
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

      <PayBalanceDialog
        appointment={payBalanceAppointment}
        onClose={() => setPayBalanceAppointment(null)}
        onPaid={(id) => {
          updateAppointment(id, { status: "שולם במלואו" });
          const patientId = patient?.id ?? currentUser?.id;
          if (patientId && payBalanceAppointment) {
            addDocument({
              patient_id: patientId,
              category: "receipt",
              title: `קבלה על יתרה - ${payBalanceAppointment.service_name}`,
              uploaded_by: "system",
              appointment_id: id,
              file: {
                file_name: "קבלה.pdf",
                uploaded_at: new Date().toISOString(),
                data_url: "data:application/pdf;base64,",
              },
            });
          }
          showToast("היתרה שולמה במלואה", { variant: "success" });
          setPayBalanceAppointment(null);
        }}
      />

      <RescheduleDialog
        appointment={rescheduleAppointment}
        onClose={() => setRescheduleAppointment(null)}
        onRescheduled={(id, date, time, clinicId) => {
          updateAppointment(id, { date, time, clinic_id: clinicId });
          showToast("מועד התור עודכן", { variant: "success" });
          setRescheduleAppointment(null);
        }}
      />
    </ClientLayout>
  );
}

export default function ClientAppointmentsPage() {
  return (
    <Suspense fallback={<ClientLayout>{null}</ClientLayout>}>
      <ClientAppointmentsPageContent />
    </Suspense>
  );
}
