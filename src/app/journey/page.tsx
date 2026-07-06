"use client";

import { motion } from "framer-motion";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/ui/Misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { UserPlus, UserCheck, RotateCcw, UserX, Users } from "lucide-react";

export default function JourneyPage() {
  const leads = useStore((s) => s.leads);
  const patients = useStore((s) => s.patients);
  const appointments = useStore((s) => s.appointments);

  const now = new Date();
  const newPatients = patients.filter((p) => {
    const d = new Date(p.created_date);
    const days = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return days <= 30;
  }).length;
  const activePatients = patients.filter((p) => p.status === "פעיל").length;
  const returningPatients = patients.filter(
    (p) => appointments.filter((a) => a.created_by_id === p.id).length > 1
  ).length;
  const inactivePatients = patients.filter((p) => p.status === "לא פעיל").length;

  const stages = [
    { key: "leads", label: "לידים", value: leads.length, icon: Users, tone: "bg-slate-400" },
    { key: "new", label: "מטופלים חדשים (30 יום)", value: newPatients, icon: UserPlus, tone: "bg-blue-500" },
    { key: "active", label: "מטופלים פעילים", value: activePatients, icon: UserCheck, tone: "bg-emerald-500" },
    { key: "returning", label: "מטופלים חוזרים", value: returningPatients, icon: RotateCcw, tone: "bg-amber-500" },
    { key: "inactive", label: "מטופלים לא פעילים", value: inactivePatients, icon: UserX, tone: "bg-rose-500" },
  ];

  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <AppLayout>
      <PageHeader title="מסע המטופל" description="ויזואליזציה של מחזור החיים של המטופלים בפלטפורמה" />

      <Card>
        <CardHeader>
          <CardTitle>משפך מחזור חיים</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {stages.map((s, i) => (
            <motion.div
              key={s.key}
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.05 }}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${s.tone} text-white`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-700">{s.label}</span>
                  <span className="font-semibold text-slate-900">{s.value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <motion.div
                    className={`h-2 rounded-full ${s.tone}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(4, (s.value / max) * 100)}%` }}
                    transition={{ duration: 0.5, delay: 0.1 + i * 0.05, ease: "easeOut" }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-3 gap-4 mt-5">
        <Card>
          <CardHeader>
            <CardTitle>שיעור המרה (לידים → מטופלים)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              {leads.length === 0
                ? "—"
                : `${Math.round((leads.filter((l) => l.status === "הומר").length / leads.length) * 100)}%`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>שיעור פעילות</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">
              {patients.length === 0 ? "—" : `${Math.round((activePatients / patients.length) * 100)}%`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>שיעור חזרה</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">
              {patients.length === 0 ? "—" : `${Math.round((returningPatients / patients.length) * 100)}%`}
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
