"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Search, CalendarDays, UserRound } from "lucide-react";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { useStore } from "@/lib/store";
import { useUpcomingAppointments } from "@/lib/useUpcomingAppointments";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Misc";

const QUICK_ACTIONS = [
  { href: "/client/search", label: "חיפוש שירותים", icon: Search },
  { href: "/client/appointments", label: "היסטוריית תורים", icon: CalendarDays },
  { href: "/client/profile", label: "הפרופיל שלי", icon: UserRound },
];

function formatUpcomingDate(dateIso: string) {
  return new Date(dateIso).toLocaleDateString("he-IL", { weekday: "long", day: "2-digit", month: "2-digit" });
}

export default function ClientHomePage() {
  const currentUser = useStore((s) => s.currentUser);
  const upcomingAppointments = useUpcomingAppointments(3);

  const firstName = currentUser?.full_name?.split(" ")[0] ?? "";

  return (
    <ClientLayout>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl bg-gradient-to-l from-primary to-primary-dark p-6 text-white shadow-md mb-6"
      >
        <h1 className="text-xl font-bold">שלום, {firstName} 👋</h1>
        <p className="text-sm text-white/80 mt-1">
          מוכנים לחפש שירות בריאות, לעקוב אחר תורים או לבדוק תוצאות מעבדה?
        </p>
      </motion.div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        {QUICK_ACTIONS.map((a, i) => (
          <motion.div key={a.href} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: i * 0.04 }}>
            <Link
              href={a.href}
              className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm transition-all hover:border-primary hover:shadow-md hover:-translate-y-0.5"
            >
              <a.icon className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium text-slate-700">{a.label}</span>
            </Link>
          </motion.div>
        ))}
      </div>

      <h2 className="text-sm font-semibold text-slate-700 mb-3">התורים הקרובים שלך</h2>
      {upcomingAppointments.length === 0 ? (
        <EmptyState title="אין לך תורים קרובים" description="חפשו שירות בריאות וקבעו תור חדש" />
      ) : (
        <div className="flex flex-col gap-2">
          {upcomingAppointments.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: i * 0.04 }}
            >
              <Link
                href="/client/appointments"
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 transition-all hover:border-primary hover:shadow-sm"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{a.service_name}</p>
                  <p className="text-xs text-slate-500">{a.provider_name}</p>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatUpcomingDate(a.date)} · {a.time}
                  </p>
                  <StatusBadge status={a.status} kind="appointment" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </ClientLayout>
  );
}
