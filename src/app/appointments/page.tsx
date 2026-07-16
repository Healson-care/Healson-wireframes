"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Input, Textarea } from "@/components/ui/Input";
import { GeneralAppointmentForm, GeneralAppointmentFormValues } from "@/components/admin/GeneralAppointmentForm";
import { cn, formatDateHe } from "@/lib/utils";
import { addMonths, APPOINTMENT_CHIP_TONE, isoDate, monthGridDays, WEEKDAY_LABELS } from "@/lib/calendar";
import { DOCUMENT_CATEGORIES } from "@/types";
import { Check, Download, FileText, FolderOpen, Pencil, Plus, X } from "lucide-react";

export default function AdminAppointmentsPage() {
  const router = useRouter();
  const appointments = useStore((s) => s.appointments);
  const documents = useStore((s) => s.documents);
  const patients = useStore((s) => s.patients);
  const providers = useStore((s) => s.providers);
  const updateAppointment = useStore((s) => s.updateAppointment);
  const addAppointment = useStore((s) => s.addAppointment);
  const showToast = useStore((s) => s.showToast);

  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ date: "", time: "", duration_minutes: 30, notes: "" });
  const [docsApptId, setDocsApptId] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState<string | undefined>(undefined);

  const dayAppointments = useMemo(() => {
    const dayIso = isoDate(selectedDay);
    return appointments.filter((a) => a.date === dayIso).sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, selectedDay]);

  function appointmentsForDay(d: Date) {
    const dayIso = isoDate(d);
    return appointments.filter((a) => a.date === dayIso).sort((a, b) => a.time.localeCompare(b.time));
  }

  function docsForAppointment(id: string) {
    return documents.filter((d) => d.appointment_id === id);
  }

  const docsApptAppointment = docsApptId ? appointments.find((a) => a.id === docsApptId) : undefined;

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
          <Button size="sm" onClick={() => openBooking(isoDate(selectedDay))}>
            <Plus className="h-4 w-4" /> קביעת תור חדש
          </Button>
        }
      />

      <Card className="p-3 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">
              {calendarMonth.toLocaleDateString("he-IL", { month: "long", year: "numeric" })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCalendarMonth(new Date());
                setSelectedDay(new Date());
              }}
            >
              היום
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCalendarMonth((m) => addMonths(m, -1))}>
              חודש קודם
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCalendarMonth((m) => addMonths(m, 1))}>
              חודש הבא
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1 text-center text-xs font-medium text-slate-400">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthGridDays(calendarMonth).map((d) => {
            const dayIso = isoDate(d);
            const inMonth = d.getMonth() === calendarMonth.getMonth();
            const isToday = dayIso === isoDate(new Date());
            const isSelected = dayIso === isoDate(selectedDay);
            const dayAppts = appointmentsForDay(d);
            return (
              <div
                key={dayIso}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedDay(d)}
                onKeyDown={(e) => e.key === "Enter" && setSelectedDay(d)}
                className={cn(
                  "group relative min-h-[76px] rounded-lg border p-1.5 text-right flex flex-col gap-1 cursor-pointer transition-colors",
                  isSelected
                    ? "bg-primary/10 border-primary"
                    : inMonth
                    ? "bg-white border-slate-200 hover:border-primary/40 hover:bg-primary/5"
                    : "bg-slate-50/60 border-transparent",
                  isToday && !isSelected && "ring-2 ring-primary/50"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      inMonth ? "text-slate-700" : "text-slate-300",
                      isToday && "text-primary"
                    )}
                  >
                    {d.getDate()}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openBooking(dayIso);
                    }}
                    title="קביעת תור חדש בתאריך זה"
                    className="opacity-0 group-hover:opacity-100 rounded-md p-0.5 text-primary hover:bg-primary/10 transition-opacity"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-col gap-0.5">
                  {dayAppts.slice(0, 2).map((a) => (
                    <span
                      key={a.id}
                      className={cn(
                        "truncate rounded border px-1 py-0.5 text-[10px]",
                        APPOINTMENT_CHIP_TONE[a.status] ?? "bg-slate-100 text-slate-600 border-slate-200"
                      )}
                      title={`${a.time} · ${a.client_name} · ${a.status}`}
                    >
                      {a.time} {a.client_name}
                    </span>
                  ))}
                  {dayAppts.length > 2 && <span className="text-[10px] text-slate-400">+{dayAppts.length - 2} נוספים</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <AnimatePresence mode="wait">
        <motion.div
          key={isoDate(selectedDay)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {dayAppointments.length === 0 ? (
            <EmptyState title="אין תורים ביום זה" description="בחר יום אחר ביומן למעלה, או קבע תור חדש" />
          ) : (
            <div className="flex flex-col gap-3">
              {dayAppointments.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: i * 0.03 }}
                >
                  <Card className="p-4" interactive>
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
                      <StatusBadge status={a.status} kind="appointment" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 justify-end">
                      {a.status === "ממתין לתשלום מקדמה" && (
                        <Button size="sm" onClick={() => { updateAppointment(a.id, { status: "מאושר" }); showToast("התור אושר", { variant: "success" }); }}>
                          <Check className="h-3.5 w-3.5" /> אשר
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
