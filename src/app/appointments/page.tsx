"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { GeneralAppointmentForm, GeneralAppointmentFormValues } from "@/components/admin/GeneralAppointmentForm";
import { cn, formatDateHe } from "@/lib/utils";
import { addDays, addMonths, findSchedulingConflict, isoDate, monthGridDays, suggestNextFreeSlot } from "@/lib/calendar";
import { Appointment, APPOINTMENT_STATUSES, DOCUMENT_CATEGORIES } from "@/types";
import {
  AlertTriangle,
  CalendarRange,
  Check,
  CreditCard,
  Download,
  FileText,
  FolderOpen,
  List,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";

function startOfWeek(d: Date) {
  const date = new Date(d);
  date.setDate(date.getDate() - date.getDay());
  date.setHours(0, 0, 0, 0);
  return date;
}

function AdminAppointmentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const appointmentParam = searchParams.get("appointment");
  const initialDay = dateParam ? new Date(dateParam) : new Date();

  const appointments = useStore((s) => s.appointments);
  const documents = useStore((s) => s.documents);
  const patients = useStore((s) => s.patients);
  const providers = useStore((s) => s.providers);
  const updateAppointment = useStore((s) => s.updateAppointment);
  const addAppointment = useStore((s) => s.addAppointment);
  const addDocument = useStore((s) => s.addDocument);
  const showToast = useStore((s) => s.showToast);

  const [weekAnchor, setWeekAnchor] = useState(initialDay);
  const [monthAnchor, setMonthAnchor] = useState(initialDay);
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [view, setView] = useState<"week" | "month">("week");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ date: "", time: "", duration_minutes: 30, notes: "" });
  const [docsApptId, setDocsApptId] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState<string | undefined>(undefined);

  const weekStart = startOfWeek(weekAnchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const dayAppointments = useMemo(() => {
    const dayIso = isoDate(selectedDay);
    return appointments
      .filter((a) => a.date === dayIso)
      .filter((a) => statusFilter === "all" || a.status === statusFilter)
      .filter((a) => !query || a.client_name.includes(query) || a.provider_name.includes(query))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, selectedDay, statusFilter, query]);

  const overdueBalanceAppointments = useMemo(() => {
    const todayIso = isoDate(new Date());
    return appointments.filter((a) => a.status === "מאושר" && a.date <= todayIso);
  }, [appointments]);

  function countForDay(d: Date) {
    return appointments.filter((a) => a.date === isoDate(d)).length;
  }

  function docsForAppointment(id: string) {
    return documents.filter((d) => d.appointment_id === id);
  }

  const docsApptAppointment = docsApptId ? appointments.find((a) => a.id === docsApptId) : undefined;
  const editingAppointment = editId ? appointments.find((a) => a.id === editId) : undefined;
  const editConflict = editingAppointment
    ? findSchedulingConflict(
        appointments,
        editingAppointment.provider_id ?? "",
        editForm.date,
        editForm.time,
        editForm.duration_minutes,
        editId ?? undefined
      )
    : undefined;
  const editSuggestedSlot =
    editConflict && editingAppointment
      ? suggestNextFreeSlot(
          appointments,
          editingAppointment.provider_id ?? "",
          editForm.date,
          editForm.time,
          editForm.duration_minutes,
          editId ?? undefined
        )
      : undefined;

  function openEdit(id: string) {
    const appt = appointments.find((a) => a.id === id);
    if (!appt) return;
    setEditId(id);
    setEditForm({ date: appt.date, time: appt.time, duration_minutes: appt.duration_minutes, notes: appt.notes ?? "" });
  }

  function openBooking(dateIso?: string) {
    setBookingDate(dateIso);
    setBookOpen(true);
  }

  function handleCollectBalance(a: Appointment) {
    updateAppointment(a.id, { status: "שולם במלואו" });
    if (a.created_by_id) {
      addDocument({
        patient_id: a.created_by_id,
        category: "receipt",
        title: `קבלה על יתרה - ${a.service_name}`,
        uploaded_by: "system",
        appointment_id: a.id,
        file: { file_name: "קבלה.pdf", uploaded_at: new Date().toISOString(), data_url: "data:application/pdf;base64," },
      });
    }
    showToast("היתרה נגבתה בהצלחה", { variant: "success" });
  }

  function handleBookAppointment(values: GeneralAppointmentFormValues) {
    const provider = providers.find((p) => p.id === values.provider_id);
    if (!provider) return;

    let clientName = values.manual_name.trim();
    let clientPhone = values.manual_phone || undefined;
    let createdById: string | undefined;
    let kupah: ReturnType<typeof useStore.getState>["patients"][number]["kupah"] | undefined;

    if (values.source === "patient") {
      const patient = patients.find((p) => p.id === values.patient_id);
      if (!patient) return;
      clientName = patient.full_name;
      clientPhone = patient.phone;
      createdById = patient.id;
      kupah = patient.kupah;
    }

    addAppointment({
      client_name: clientName,
      client_phone: clientPhone,
      provider_id: provider.id,
      provider_name: provider.display_name,
      service_name: values.service_name,
      date: values.date,
      time: values.time,
      duration_minutes: values.duration_minutes,
      status: values.status,
      price: values.price ? Number(values.price) : undefined,
      kupah,
      notes: values.notes || undefined,
      created_by_id: createdById,
    });
    showToast("התור נקבע בהצלחה", { variant: "success" });
    setBookOpen(false);
    setSelectedDay(new Date(values.date));
  }

  return (
    <AppLayout>
      <PageHeader
        title="ניהול תורים"
        description="לוח תורים מרכזי עבור כל הספקים"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
              <button
                onClick={() => setView("week")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  view === "week" ? "bg-primary text-white" : "text-slate-500 hover:bg-slate-50"
                )}
              >
                <List className="h-3.5 w-3.5" /> שבועי
              </button>
              <button
                onClick={() => setView("month")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  view === "month" ? "bg-primary text-white" : "text-slate-500 hover:bg-slate-50"
                )}
              >
                <CalendarRange className="h-3.5 w-3.5" /> חודשי
              </button>
            </div>
            <Button size="sm" onClick={() => openBooking(isoDate(selectedDay))}>
              <Plus className="h-4 w-4" /> קביעת תור חדש
            </Button>
          </div>
        }
      />

      {overdueBalanceAppointments.length > 0 && (
        <div className="rounded-lg border border-danger-border bg-danger-bg px-3.5 py-2.5 mb-4 text-sm text-danger-text">
          <p className="flex items-center gap-2 font-medium mb-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {overdueBalanceAppointments.length} תורים שהמועד שלהם הגיע והיתרה עדיין לא שולמה
          </p>
          <div className="flex flex-wrap gap-1.5">
            {overdueBalanceAppointments.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-1.5 rounded-full border border-danger-border bg-white pr-1 pl-2.5 py-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(a.date);
                    setWeekAnchor(d);
                    setMonthAnchor(d);
                    setSelectedDay(d);
                  }}
                  className="text-xs font-medium text-danger-text hover:underline"
                  title="הצג את התור הזה ביומן"
                >
                  {a.client_name} · {formatDateHe(a.date)}
                </button>
                <button
                  type="button"
                  onClick={() => handleCollectBalance(a)}
                  className="flex items-center gap-1 rounded-full bg-danger-bg px-1.5 py-0.5 text-[11px] font-medium text-danger-text hover:opacity-80"
                  title="גבה יתרה עכשיו"
                >
                  <CreditCard className="h-3 w-3" /> גבה
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Input
          placeholder="חיפוש לפי מטופל או ספק..."
          icon={<Search className="h-4 w-4" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[180px]">
          <option value="all">כל הסטטוסים</option>
          {APPOINTMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      {view === "month" ? (
        <Card className="p-3 mb-4">
          <div className="flex items-center justify-between mb-3">
            <Button variant="outline" size="sm" onClick={() => setMonthAnchor(addMonths(monthAnchor, -1))}>
              חודש קודם
            </Button>
            <span className="text-sm font-medium text-slate-600">
              {monthAnchor.toLocaleDateString("he-IL", { month: "long", year: "numeric" })}
            </span>
            <Button variant="outline" size="sm" onClick={() => setMonthAnchor(addMonths(monthAnchor, 1))}>
              חודש הבא
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {monthGridDays(monthAnchor).map((d) => {
              const isSelected = isoDate(d) === isoDate(selectedDay);
              const inMonth = d.getMonth() === monthAnchor.getMonth();
              const count = countForDay(d);
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => {
                    setSelectedDay(d);
                    setView("week");
                    setWeekAnchor(d);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg p-2 text-xs min-h-[52px]",
                    isSelected
                      ? "bg-primary text-white"
                      : inMonth
                      ? "bg-slate-50 text-slate-600 hover:bg-slate-100"
                      : "bg-white text-slate-300 hover:bg-slate-50"
                  )}
                >
                  <span className="font-semibold">{d.getDate()}</span>
                  {count > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[10px]",
                        isSelected ? "bg-white/20" : "bg-primary/10 text-primary"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card className="p-3 mb-4">
          <div className="flex items-center justify-between mb-3">
            <Button variant="outline" size="sm" onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}>
              שבוע קודם
            </Button>
            <span className="text-sm font-medium text-slate-600">
              {weekStart.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })} -{" "}
              {addDays(weekStart, 6).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })}
            </span>
            <Button variant="outline" size="sm" onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}>
              שבוע הבא
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((d) => {
              const isSelected = isoDate(d) === isoDate(selectedDay);
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelectedDay(d)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg p-2 text-xs",
                    isSelected ? "bg-primary text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <span>{d.toLocaleDateString("he-IL", { weekday: "short" })}</span>
                  <span className="font-semibold">{d.getDate()}</span>
                  {countForDay(d) > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[10px]",
                        isSelected ? "bg-white/20" : "bg-primary/10 text-primary"
                      )}
                    >
                      {countForDay(d)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={isoDate(selectedDay)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {dayAppointments.length === 0 ? (
            <EmptyState
              title="אין תורים ביום זה"
              description={query || statusFilter !== "all" ? "נסה לשנות את החיפוש או הסינון" : "בחר יום אחר בלוח למעלה, או קבע תור חדש"}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {dayAppointments.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: i * 0.03 }}
                >
                  <Card className={cn("p-4", a.id === appointmentParam && "ring-2 ring-primary")} interactive>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{a.time} · {a.duration_minutes} דק׳</p>
                        <p className="text-sm text-slate-700 mt-1">{a.client_name} · {a.client_phone}</p>
                        <p className="text-xs text-slate-500">{a.service_name}</p>
                        <p className="text-xs text-slate-400">{a.provider_name} · {a.kupah}</p>
                        <button
                          onClick={() => setDocsApptId(a.id)}
                          className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                        >
                          <FileText className="h-3 w-3" /> {docsForAppointment(a.id).length} מסמכים מקושרים
                        </button>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <StatusBadge status={a.status} kind="appointment" />
                        {a.status === "מאושר" && a.date <= isoDate(new Date()) && (
                          <Badge tone="red" title="התאריך הגיע והיתרה טרם שולמה">
                            <AlertTriangle className="h-3 w-3" /> יתרה לא שולמה
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 justify-end">
                      {a.status === "ממתין לתשלום מקדמה" && (
                        <Button size="sm" onClick={() => { updateAppointment(a.id, { status: "מאושר" }); showToast("התור אושר", { variant: "success" }); }}>
                          <Check className="h-3.5 w-3.5" /> אשר
                        </Button>
                      )}
                      {a.status === "מאושר" && (
                        <Button size="sm" variant="outline" onClick={() => handleCollectBalance(a)}>
                          <CreditCard className="h-3.5 w-3.5" /> גבה יתרה
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openEdit(a.id)}>
                        <Pencil className="h-3.5 w-3.5" /> עריכה
                      </Button>
                      {a.status !== "בוטל" && a.status !== "בוצע" && (
                        <Button size="sm" variant="destructive" onClick={() => setCancelId(a.id)}>
                          <X className="h-3.5 w-3.5" /> בטל
                        </Button>
                      )}
                      {a.created_by_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/crm/${a.created_by_id}?appointment=${a.id}`)}
                        >
                          <FolderOpen className="h-3.5 w-3.5" /> תיק מטופל
                        </Button>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <GeneralAppointmentForm
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        onSubmit={handleBookAppointment}
        providers={providers}
        patients={patients}
        initialDate={bookingDate}
        appointments={appointments}
      />

      <ConfirmDialog
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        title="ביטול תור"
        destructive
        confirmLabel="בטל תור"
        onConfirm={() => {
          if (cancelId) {
            updateAppointment(cancelId, { status: "בוטל" });
            showToast("התור בוטל", { variant: "success" });
          }
        }}
      />

      <Dialog open={!!editId} onClose={() => setEditId(null)} title="עריכת תור">
        <div className="flex flex-col gap-3">
          <Input type="date" label="תאריך" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
          <Input type="time" label="שעה" value={editForm.time} onChange={(e) => setEditForm({ ...editForm, time: e.target.value })} />
          <Input
            type="number"
            label="משך (דקות)"
            value={editForm.duration_minutes}
            onChange={(e) => setEditForm({ ...editForm, duration_minutes: Number(e.target.value) })}
          />
          {editConflict && (
            <div className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-bg px-3 py-2.5 text-sm text-danger-text">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p>לספק כבר יש תור ב-{editConflict.time} ({editConflict.client_name})</p>
                {editSuggestedSlot ? (
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, time: editSuggestedSlot })}
                    className="mt-1 font-medium hover:underline"
                  >
                    בחר את השעה הפנויה הבאה — {editSuggestedSlot}
                  </button>
                ) : (
                  <p className="mt-1 text-xs">אין שעה פנויה נוספת ליום זה</p>
                )}
              </div>
            </div>
          )}
          <Textarea label="הערות" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
          <Button
            onClick={() => {
              if (editId) {
                updateAppointment(editId, editForm);
                showToast("התור עודכן", { variant: "success" });
              }
              setEditId(null);
            }}
          >
            שמור שינויים
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={!!docsApptId}
        onClose={() => setDocsApptId(null)}
        title="מסמכים מקושרים לתור"
        description={docsApptAppointment ? `${docsApptAppointment.client_name} · ${formatDateHe(docsApptAppointment.date)}` : undefined}
      >
        {docsApptId && docsForAppointment(docsApptId).length === 0 ? (
          <EmptyState icon={<FileText className="h-10 w-10" />} title="אין מסמכים לתור זה" />
        ) : (
          <div className="flex flex-col gap-2">
            {docsApptId &&
              docsForAppointment(docsApptId).map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{d.title}</p>
                    <p className="text-xs text-slate-400">
                      {DOCUMENT_CATEGORIES.find((c) => c.id === d.category)?.label ?? d.category}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {d.status && <Badge tone={d.status === "ממתין למילוי" ? "warning" : "success"}>{d.status}</Badge>}
                    {d.file && (
                      <Button size="sm" variant="outline" onClick={() => showToast("הקובץ הורד (מצב הדגמה)", { variant: "success" })}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
        {docsApptAppointment?.created_by_id && (
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={() => router.push(`/crm/${docsApptAppointment.created_by_id}?appointment=${docsApptAppointment.id}`)}
          >
            <FolderOpen className="h-4 w-4" /> לתיק המטופל המלא
          </Button>
        )}
      </Dialog>
    </AppLayout>
  );
}

export default function AdminAppointmentsPage() {
  return (
    <Suspense fallback={<AppLayout>{null}</AppLayout>}>
      <AdminAppointmentsPageContent />
    </Suspense>
  );
}
