"use client";

import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, StatCard } from "@/components/ui/Misc";
import { Input, Select } from "@/components/ui/Input";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { formatCurrency, formatDateHe } from "@/lib/utils";
import { Order, ORDER_STATUSES, OrderStatus } from "@/types";
import { Search, ShoppingCart } from "lucide-react";

export default function OrdersPage() {
  const orders = useStore((s) => s.orders);
  const updateOrder = useStore((s) => s.updateOrder);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    return orders
      .filter((o) => (status === "all" ? true : o.status === status))
      .filter((o) => !query || o.patient_name.includes(query) || o.provider_name.includes(query))
      .sort((a, b) => (a.created_date < b.created_date ? 1 : -1));
  }, [orders, query, status]);

  const totalRevenue = orders.filter((o) => o.status === "הושלם").reduce((s, o) => s + o.final_price, 0);

  return (
    <AppLayout>
      <PageHeader title="הזמנות" description="ניהול עסקאות והזמנות במערכת" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="סה״כ הזמנות" value={orders.length} tone="blue" />
        <StatCard label="הכנסה כוללת" value={formatCurrency(totalRevenue)} tone="green" />
        <StatCard label="ממתינות" value={orders.filter((o) => o.status === "ממתין").length} tone="amber" />
        <StatCard label="בוטלו" value={orders.filter((o) => o.status === "בוטל").length} tone="rose" />
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="חיפוש לפי מטופל או ספק..."
          icon={<Search className="h-4 w-4" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[160px]">
          <option value="all">כל הסטטוסים</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      <DataTable<Order>
        rows={filtered}
        rowKey={(o) => o.id}
        emptyIcon={<ShoppingCart className="h-10 w-10" />}
        emptyTitle="לא נמצאו הזמנות"
        emptyDescription="נסה לשנות את החיפוש או הסינון"
        columns={
          [
            {
              key: "patient",
              header: "מטופל",
              sortable: true,
              sortValue: (o) => o.patient_name,
              render: (o) => <span className="font-medium text-slate-800">{o.patient_name}</span>,
            },
            {
              key: "provider",
              header: "ספק",
              sortable: true,
              sortValue: (o) => o.provider_name,
              render: (o) => <span className="text-slate-600">{o.provider_name}</span>,
            },
            { key: "item", header: "שירות", render: (o) => <span className="text-slate-600">{o.item_name}</span> },
            {
              key: "price",
              header: "מחיר",
              sortable: true,
              sortValue: (o) => o.final_price,
              render: (o) => <span className="font-medium text-slate-800">{formatCurrency(o.final_price)}</span>,
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
              render: (o) => (
                <Select
                  value={o.status}
                  onChange={(e) => updateOrder(o.id, { status: e.target.value as OrderStatus })}
                  className="h-8 text-xs w-28"
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              ),
            },
          ] satisfies DataTableColumn<Order>[]
        }
      />
    </AppLayout>
  );
}
