"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { APPOINTMENT_STATUSES } from "@/types";
import { Check, Pencil, Trash2, X, Search, CalendarRange, List } from "lucide-react";

function startOfWeek(d: Date) {
  const date = new Date(d);
  date.setDate(date.getDate() - date.getDay());
  date.setHours(0, 0, 0, 0);
  return date;
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}
function addMonths(d: Date, n: number) {
  const date = new Date(d);
  date.setMonth(date.getMonth() + n);
  return date;
}

export default function AdminAppointmentsPage() {
  const appointments = useStore((s) => s.appointments);
  const updateAppointment = useStore((s) => s.updateAppointment);
  const deleteAppointment = useStore((s) => s.deleteAppointment);
  const showToast = useStore((s) => s.showToast);

  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [monthAnchor, setMonthAnchor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [view, setView] = useState<"week" | "month">("week");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ date: "", time: "", duration_minutes: 30, notes: "" });

  const weekStart = startOfWeek(weekAnchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const monthGridStart = startOfWeek(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1));
  const monthDays = Array.from({ length: 42 }, (_, i) => addDays(monthGridStart, i));

  const dayAppointments = useMemo(() => {
    const dayIso = isoDate(selectedDay);
    return appointments
      .filter((a) => a.date === dayIso)
      .filter((a) => statusFilter === "all" || a.status === statusFilter)
      .filter((a) => !query || a.client_name.includes(query) || a.provider_name.includes(query))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, selectedDay, statusFilter, query]);

  function countForDay(d: Date) {
    return appointments.filter((a) => a.date === isoDate(d)).length;
  }

  function openEdit(id: string) {
    const appt = appointments.find((a) => a.id === id);
    if (!appt) return;
    setEditId(id);
    setEditForm({ date: appt.date, time: appt.time, duration_minutes: appt.duration_minutes, notes: appt.notes ?? "" });
  }

  return (
    <AppLayout>
      <PageHeader
        title="ניהול תורים"
        description="לוח תורים מרכזי עבור כל הספקים"
        actions={
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
        }
      />

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
            {monthDays.map((d) => {
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
              description={query || statusFilter !== "all" ? "נסה לשנות את החיפוש או הסינון" : "בחר יום אחר בלוח למעלה"}
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
                  <Card className="p-4" interactive>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{a.time} · {a.duration_minutes} דק׳</p>
                        <p className="text-sm text-slate-700 mt-1">{a.client_name} · {a.client_phone}</p>
                        <p className="text-xs text-slate-500">{a.service_name}</p>
                        <p className="text-xs text-slate-400">{a.provider_name} · {a.kupah}</p>
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
                      <Button size="sm" variant="ghost" onClick={() => setDeleteId(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" /> מחק
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

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

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="מחיקת תור"
        description="פעולה זו אינה הפיכה."
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteId) {
            deleteAppointment(deleteId);
            showToast("התור נמחק", { variant: "success" });
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
    </AppLayout>
  );
}
