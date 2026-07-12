"use client";

import { useMemo, useState } from "react";
import { ProviderLayout } from "@/components/layouts/ProviderLayout";
import { useStore } from "@/lib/store";
import { useCurrentProvider } from "@/lib/useCurrentPatient";
import { PageHeader } from "@/components/ui/Misc";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { formatCurrency, formatDateHe } from "@/lib/utils";
import { Order } from "@/types";
import { ShoppingCart, X } from "lucide-react";

export default function ProviderOrdersPage() {
  const provider = useCurrentProvider();
  const orders = useStore((s) => s.orders);
  const updateOrder = useStore((s) => s.updateOrder);
  const showToast = useStore((s) => s.showToast);

  const [cancelId, setCancelId] = useState<string | null>(null);

  const myOrders = useMemo(
    () =>
      orders
        .filter((o) => o.provider_id === provider?.id)
        .sort((a, b) => (a.created_date < b.created_date ? 1 : -1)),
    [orders, provider]
  );

  return (
    <ProviderLayout>
      <PageHeader title="ניהול הזמנות" description="הזמנות נכנסות מהמטופלים שלך, סטטוס ואפשרות ביטול" />

      <DataTable<Order>
        rows={myOrders}
        rowKey={(o) => o.id}
        emptyIcon={<ShoppingCart className="h-10 w-10" />}
        emptyTitle="אין הזמנות עדיין"
        columns={
          [
            {
              key: "patient",
              header: "מטופל",
              sortable: true,
              sortValue: (o) => o.patient_name,
              render: (o) => <span className="font-medium text-slate-900">{o.patient_name}</span>,
            },
            { key: "item", header: "שירות", render: (o) => <span className="text-slate-600">{o.item_name}</span> },
            {
              key: "price",
              header: "מחיר",
              sortable: true,
              sortValue: (o) => o.final_price,
              render: (o) => <span className="text-slate-700">{formatCurrency(o.final_price)}</span>,
            },
            {
              key: "date",
              header: "תאריך",
              sortable: true,
              sortValue: (o) => o.created_date,
              render: (o) => <span className="text-slate-500">{formatDateHe(o.created_date)}</span>,
            },
            {
              key: "status",
              header: "סטטוס",
              render: (o) => <StatusBadge status={o.status} kind="order" />,
            },
          ] satisfies DataTableColumn<Order>[]
        }
        rowActions={(o) =>
          o.status !== "בוטל" && o.status !== "הושלם" ? (
            <Button variant="destructive" size="sm" onClick={() => setCancelId(o.id)}>
              <X className="h-3.5 w-3.5" /> בטל הזמנה
            </Button>
          ) : null
        }
      />

      <ConfirmDialog
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        title="ביטול הזמנה"
        description="האם לבטל את ההזמנה? פעולה זו אינה הפיכה."
        destructive
        confirmLabel="בטל הזמנה"
        onConfirm={() => {
          if (cancelId) {
            updateOrder(cancelId, { status: "בוטל" });
            showToast("ההזמנה בוטלה", { variant: "success" });
          }
        }}
      />
    </ProviderLayout>
  );
}
