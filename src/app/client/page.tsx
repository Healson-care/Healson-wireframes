"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Search, CalendarDays, UserRound } from "lucide-react";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { PatientHeroCard } from "@/components/patient/PatientHeroCard";
import { useUpcomingAppointments } from "@/lib/useUpcomingAppointments";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Misc";

const QUICK_ACTIONS = [
  { href: "/client/search", label: "חיפוש שירותים", icon: Search },
  { href: "/client/appointments", label: "התורים שלי", icon: CalendarDays },
  { href: "/client/profile", label: "הפרופיל שלי", icon: UserRound },
];

function formatUpcomingDate(dateIso: string) {
  return new Date(dateIso).toLocaleDateString("he-IL", { weekday: "long", day: "2-digit", month: "2-digit" });
}

export default function ClientHomePage() {
  const upcomingAppointments = useUpcomingAppointments(3);

  return (
    <ClientLayout>
      <PatientHeroCard />

      <div className="grid grid-cols-3 gap-3 mb-8">
        {QUICK_ACTIONS.map((a, i) => (
          <motion.div key={a.href} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: i * 0.04 }}>
            <Link
              href={a.href}
              className="focus-ring flex h-full flex-col items-center gap-2 rounded-2xl border border-white/70 bg-white/85 p-3 text-center shadow-[0_18px_40px_-28px_rgba(20,42,79,0.45)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-[var(--brand-navy)]/25 sm:p-4"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--brand-navy)]/20 bg-[var(--brand-navy)]/8 text-[var(--brand-navy)]">
                <a.icon className="h-4.5 w-4.5" />
              </span>
              <span className="text-[11px] font-semibold leading-tight text-[var(--brand-navy)] sm:text-xs">
                {a.label}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      <h2 className="font-display mb-3 text-base font-bold text-[var(--brand-navy)]">התורים הקרובים שלך</h2>
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
                className="focus-ring flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/85 p-3.5 shadow-[0_18px_40px_-30px_rgba(20,42,79,0.4)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-[var(--brand-navy)]/25"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--brand-navy)]">{a.service_name}</p>
                  <p className="truncate text-xs text-[var(--brand-ink-soft)]">{a.provider_name}</p>
                </div>
                <div className="shrink-0 text-left">
                  <p className="text-sm font-semibold text-[var(--brand-navy)]">
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
