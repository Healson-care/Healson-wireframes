"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function ClientAppointmentsPage() {
  const appointments = useStore((s) => s.appointments);
  const updateAppointment = useStore((s) => s.updateAppointment);
  const showToast = useStore((s) => s.showToast);
  const currentUser = useStore((s) => s.currentUser);
  const patient = useCurrentPatient();

  const [selectedDay, setSelectedDay] = useState(new Date());
  const [cancelId, setCancelId] = useState<string | null>(null);

  const myAppointments = appointments.filter(
    (a) => a.created_by_id === patient?.id || a.created_by_id === currentUser?.id
  );

  const dayAppointments = useMemo(() => {
    const dayIso = isoDate(selectedDay);
    return myAppointments
      .filter((a) => a.date === dayIso)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [myAppointments, selectedDay]);

  function shiftDay(delta: number) {
    const next = new Date(selectedDay);
    next.setDate(next.getDate() + delta);
    setSelectedDay(next);
  }

  return (
    <ClientLayout>
      <PageHeader title="התורים שלי" description="צפייה ומעקב אחר התורים שנקבעו" />

      <Card className="p-3 mb-4">
        <div className="flex items-center justify-between">
          <button onClick={() => shiftDay(-1)} className="rounded-lg p-2 hover:bg-slate-100">
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-slate-700">
            {selectedDay.toLocaleDateString("he-IL", { weekday: "long", day: "2-digit", month: "2-digit" })}
          </span>
          <button onClick={() => shiftDay(1)} className="rounded-lg p-2 hover:bg-slate-100">
            <ChevronLeft className="h-4 w-4" />
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
            <EmptyState title="אין תורים ביום זה" description="ניתן לקבוע תור חדש דרך מסך החיפוש" />
          ) : (
            <div className="flex flex-col gap-3">
              {dayAppointments.map((a, i) => (
                <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: i * 0.03 }}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                          <Clock className="h-4 w-4 text-primary" /> {a.time}
                        </div>
                        <p className="text-sm text-slate-700 mt-1">{a.service_name}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" /> {a.provider_name}
                        </p>
                      </div>
                      <StatusBadge status={a.status} kind="appointment" />
                    </div>
                    {a.status !== "בוטל" && a.status !== "הושלם" && (
                      <div className="mt-3 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => setCancelId(a.id)}>
                          בטל תור
                        </Button>
                      </div>
                    )}
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
