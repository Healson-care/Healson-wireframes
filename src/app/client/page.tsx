"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Search, CalendarDays, ShoppingBag, UserRound } from "lucide-react";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { useStore } from "@/lib/store";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Misc";
import { formatCurrency } from "@/lib/utils";

const QUICK_ACTIONS = [
  { href: "/client/search", label: "חיפוש שירותים", icon: Search },
  { href: "/client/appointments", label: "התורים שלי", icon: CalendarDays },
  { href: "/client/orders", label: "ההזמנות שלי", icon: ShoppingBag },
  { href: "/client/profile", label: "הפרופיל שלי", icon: UserRound },
];

export default function ClientHomePage() {
  const currentUser = useStore((s) => s.currentUser);
  const orders = useStore((s) => s.orders);

  const myOrders = orders
    .filter((o) => o.created_by_id === currentUser?.id || o.patient_name === currentUser?.full_name)
    .slice(0, 3);

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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
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

      <h2 className="text-sm font-semibold text-slate-700 mb-3">הזמנות אחרונות</h2>
      {myOrders.length === 0 ? (
        <EmptyState title="אין לך עדיין הזמנות" description="חפשו שירות בריאות והתחילו את המסע שלכם" />
      ) : (
        <div className="flex flex-col gap-2">
          {myOrders.map((o, i) => (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: i * 0.04 }}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">{o.item_name}</p>
                <p className="text-xs text-slate-500">{o.provider_name}</p>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(o.final_price)}</p>
                <StatusBadge status={o.status} kind="order" />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </ClientLayout>
  );
}
