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
  { href: "/client/appointments", label: "התורים שלי", icon: CalendarDays },
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
        className="relative mb-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[var(--brand-navy)] via-[var(--brand-navy-800)] to-[var(--brand-navy-900)] p-5 text-white shadow-[0_30px_60px_-32px_rgba(15,33,64,0.8)] sm:p-7"
      >
        {/* The gold hairline and inner glow are what make the navy read as a
            brand surface rather than a coloured box — straight off /apply. */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-[var(--brand-gold)]/60 to-transparent" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(198,161,91,0.16),transparent_58%)]"
        />
        <div className="relative">
          <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/80">
            האזור האישי
          </span>
          <h1 className="font-display mt-2 text-[22px] font-bold leading-tight sm:text-[26px]">שלום, {firstName}</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">
            מוכנים לחפש שירות בריאות, לעקוב אחר תורים או לבדוק תוצאות מעבדה?
          </p>
        </div>
      </motion.div>

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
