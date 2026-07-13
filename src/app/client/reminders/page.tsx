"use client";

import { motion } from "framer-motion";
import { Bell, Calendar, Clock, MapPin } from "lucide-react";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { useStore } from "@/lib/store";
import { useUpcomingAppointments } from "@/lib/useUpcomingAppointments";
import { AppointmentReminderPlan } from "@/components/patient/AppointmentReminderPlan";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

function formatAppointmentDate(dateIso: string) {
  return new Date(dateIso).toLocaleDateString("he-IL", { weekday: "long", day: "2-digit", month: "2-digit" });
}

export default function ClientRemindersPage() {
  const providers = useStore((s) => s.providers);
  const upcomingAppointments = useUpcomingAppointments();

  return (
    <ClientLayout>
      <PageHeader title="תזכורות" description="לוח התזכורות שיישלחו לכם לקראת התורים הקרובים" />

      {upcomingAppointments.length === 0 ? (
        <EmptyState icon={<Bell className="h-10 w-10" />} title="אין לך תזכורות קרובות" description="קבעו תור חדש דרך מסך החיפוש כדי לראות כאן את לוח התזכורות שלו" />
      ) : (
        <div className="flex flex-col gap-4">
          {upcomingAppointments.map((a, i) => {
            const provider = providers.find((p) => p.id === a.provider_id);
            return (
              <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: i * 0.04 }}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-medium text-slate-900">{a.service_name}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" /> {a.provider_name}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {formatAppointmentDate(a.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {a.time}
                        </span>
                      </p>
                    </div>
                    <StatusBadge status={a.status} kind="appointment" />
                  </div>

                  <AppointmentReminderPlan appointment={a} provider={provider} />
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </ClientLayout>
  );
}
