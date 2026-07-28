"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ProviderLayout } from "@/components/layouts/ProviderLayout";
import { useStore } from "@/lib/store";
import { useCurrentProvider } from "@/lib/useCurrentPatient";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Input, Textarea } from "@/components/ui/Input";
import { Building2, Check, ChevronLeft, ChevronRight, FolderOpen, Pencil, X } from "lucide-react";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Sunday-start week, matching the Israeli convention used elsewhere (DAY_KEYS).
function startOfWeek(d: Date) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

const WEEKDAY_SHORT = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export default function ProviderAppointmentsPage() {
  const provider = useCurrentProvider();
  const appointments = useStore((s) => s.appointments);
  const providers = useStore((s) => s.providers);
  const updateAppointment = useStore((s) => s.updateAppointment);
  const showToast = useStore((s) => s.showToast);

  const [selectedDay, setSelectedDay] = useState(new Date());
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ date: "", time: "", duration_minutes: 30, notes: "" });

  // §PRV-10 — the unified calendar: the provider's own appointments PLUS the
  // ones they deliver inside a unit (practitioner_id === me, owned by the unit).
  // The unit-owned ones are shown as a read-only reflection — the unit manages
  // them — so a doctor sees their whole day across every context in one place.
  const myAppointments = useMemo(
    () =>
      provider
        ? appointments.filter((a) => a.provider_id === provider.id || a.practitioner_id === provider.id)
        : [],
    [appointments, provider]
  );
  const unitNameById = useMemo(() => new Map(providers.map((p) => [p.id, p.display_name])), [providers]);

  const dayAppointments = useMemo(() => {
    const dayIso = isoDate(selectedDay);
    return myAppointments.filter((a) => a.date === dayIso).sort((a, b) => a.time.localeCompare(b.time));
  }, [myAppointments, selectedDay]);

  // Week strip — lets you see the whole week at a glance (how many appointments
  // per day) and jump straight to any of its days, instead of only stepping one
  // day at a time.
  const countByDate = useMemo(() => {
    const m = new Map<string, number>();
    myAppointments.forEach((a) => m.set(a.date, (m.get(a.date) ?? 0) + 1));
    return m;
  }, [myAppointments]);
  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDay);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [selectedDay]);
  const todayIso = isoDate(new Date());

  function shiftDay(delta: number) {
    const next = new Date(selectedDay);
    next.setDate(next.getDate() + delta);
    setSelectedDay(next);
  }

  function openEdit(id: string) {
    const appt = appointments.find((a) => a.id === id);
    if (!appt) return;
    setEditId(id);
    setEditForm({ date: appt.date, time: appt.time, duration_minutes: appt.duration_minutes, notes: appt.notes ?? "" });
  }

  return (
    <ProviderLayout>
      <PageHeader title="ניהול תורים" description="היומן המאוחד שלך — התורים במרפאות שלך ושיבוצי היחידה (לצפייה בלבד)" />

      {/* Full-width date toolbar — day nav on one side, a "היום" reset on the
          other, so the control anchors the page instead of floating stranded. */}
      <Card className="p-2.5 mb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftDay(-1)}
              aria-label="יום קודם"
              className="focus-ring rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="min-w-[150px] text-center text-sm sm:text-base font-semibold text-slate-800">
              {selectedDay.toLocaleDateString("he-IL", { weekday: "long", day: "2-digit", month: "2-digit" })}
            </span>
            <button
              onClick={() => shiftDay(1)}
              aria-label="יום הבא"
              className="focus-ring rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSelectedDay(new Date())}>
            היום
          </Button>
        </div>

        {/* Week view — the whole week at a glance, click any day to jump to it. */}
        <div className="mt-2.5 flex items-center gap-1 border-t border-slate-100 pt-2.5">
          <button
            onClick={() => shiftDay(-7)}
            aria-label="שבוע קודם"
            className="focus-ring shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <div className="grid flex-1 grid-cols-7 gap-1">
            {weekDays.map((d) => {
              const dIso = isoDate(d);
              const isSelected = dIso === isoDate(selectedDay);
              const isToday = dIso === todayIso;
              const count = countByDate.get(dIso) ?? 0;
              return (
                <button
                  key={dIso}
                  onClick={() => setSelectedDay(d)}
                  className={`focus-ring flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-xs transition-colors ${
                    isSelected
                      ? "bg-primary text-white"
                      : isToday
                      ? "bg-primary/10 text-primary"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-[10px] font-medium opacity-80">{WEEKDAY_SHORT[d.getDay()]}</span>
                  <span className="font-semibold">{d.getDate()}</span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      count === 0 ? "opacity-0" : isSelected ? "bg-white" : "bg-primary"
                    }`}
                  />
                </button>
              );
            })}
          </div>
          <button
            onClick={() => shiftDay(7)}
            aria-label="שבוע הבא"
            className="focus-ring shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
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
            <EmptyState title="אין תורים ביום זה" description="עבור ליום אחר כדי לראות תורים" />
          ) : (
            <div className="flex flex-col gap-3">
              {dayAppointments.map((a, i) => {
                // Owned by a unit (delivered by me, but the unit's calendar) →
                // read-only reflection: I can open the patient, but scheduling
                // actions belong to the unit.
                const reflected = !!provider && a.provider_id !== provider.id;
                const unitName = reflected ? unitNameById.get(a.provider_id ?? "") : undefined;
                return (
                <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: i * 0.03 }}>
                  <Card className={`p-4 ${reflected ? "border-dashed bg-slate-50/60" : ""}`} interactive>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{a.time} · {a.duration_minutes} דק׳</p>
                        <p className="text-sm text-slate-700 mt-1">{a.client_name}</p>
                        <p className="text-xs text-slate-500">{a.service_name}</p>
                        {a.client_phone && <p className="text-xs text-slate-400">{a.client_phone}</p>}
                        {reflected && (
                          <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-indigo-600">
                            <Building2 className="h-3 w-3" /> {unitName ?? "יחידה"} · שיקוף — מנוהל על ידי היחידה
                          </p>
                        )}
                      </div>
                      <StatusBadge status={a.status} kind="appointment" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 justify-end">
                      {reflected ? (
                        a.created_by_id && (
                          <Link href={`/provider/patients/${a.created_by_id}`}>
                            <Button size="sm" variant="outline">
                              <FolderOpen className="h-3.5 w-3.5" /> פתח תיק מטופל
                            </Button>
                          </Link>
                        )
                      ) : (
                        <>
                          {a.status === "ממתין לתשלום מקדמה" && (
                            <Button
                              size="sm"
                              onClick={() => {
                                updateAppointment(a.id, { status: "מאושר" });
                                showToast("התור אושר", { variant: "success" });
                              }}
                            >
                              <Check className="h-3.5 w-3.5" /> אשר
                            </Button>
                          )}
                          {(a.status === "מאושר" || a.status === "שולם במלואו") && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                updateAppointment(a.id, { status: "בוצע" });
                                showToast("התור סומן כבוצע", { variant: "success" });
                              }}
                            >
                              סמן כבוצע
                            </Button>
                          )}
                          {a.created_by_id && (
                            <Link href={`/provider/patients/${a.created_by_id}`}>
                              <Button size="sm" variant="outline">
                                <FolderOpen className="h-3.5 w-3.5" /> פתח תיק מטופל
                              </Button>
                            </Link>
                          )}
                          <Button size="sm" variant="outline" onClick={() => openEdit(a.id)}>
                            <Pencil className="h-3.5 w-3.5" /> עריכה
                          </Button>
                          {a.status !== "בוטל" && a.status !== "בוצע" && (
                            <Button size="sm" variant="destructive" onClick={() => setCancelId(a.id)}>
                              <X className="h-3.5 w-3.5" /> בטל
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </Card>
                </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <ConfirmDialog
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        title="ביטול תור"
        description="האם לבטל את התור?"
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
    </ProviderLayout>
  );
}
