"use client";

import { motion } from "framer-motion";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDateHe } from "@/lib/utils";
import { Download, ShoppingBag } from "lucide-react";

export default function ClientOrdersPage() {
  const orders = useStore((s) => s.orders);
  const currentUser = useStore((s) => s.currentUser);
  const showToast = useStore((s) => s.showToast);
  const patient = useCurrentPatient();

  const myOrders = orders
    .filter((o) => o.created_by_id === patient?.id || o.created_by_id === currentUser?.id)
    .sort((a, b) => (a.created_date < b.created_date ? 1 : -1));

  return (
    <ClientLayout>
      <PageHeader title="ההזמנות שלי" description="היסטוריית הזמנות ומעקב סטטוס" />

      {myOrders.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="h-10 w-10" />} title="אין הזמנות עדיין" />
      ) : (
        <div className="flex flex-col gap-3">
          {myOrders.map((o, i) => (
            <motion.div key={o.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: i * 0.04 }}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{o.item_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{o.provider_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDateHe(o.created_date)}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">{formatCurrency(o.final_price)}</p>
                    <StatusBadge status={o.status} kind="order" />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => showToast("הקבלה הורדה (מצב הדגמה)", { variant: "success" })}
                  >
                    <Download className="h-3.5 w-3.5" /> הורד קבלה
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </ClientLayout>
  );
}
