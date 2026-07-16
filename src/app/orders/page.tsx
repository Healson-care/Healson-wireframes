"use client";

import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, StatCard } from "@/components/ui/Misc";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { OrderForm, OrderFormValues } from "@/components/admin/OrderForm";
import { formatCurrency, formatDateHe } from "@/lib/utils";
import { Order, ORDER_STATUSES, OrderStatus } from "@/types";
import { Plus, Search, ShoppingCart } from "lucide-react";

export default function OrdersPage() {
  const orders = useStore((s) => s.orders);
  const updateOrder = useStore((s) => s.updateOrder);
  const addOrder = useStore((s) => s.addOrder);
  const patients = useStore((s) => s.patients);
  const leads = useStore((s) => s.leads);
  const providers = useStore((s) => s.providers);
  const catalog = useStore((s) => s.catalog);
  const convertLead = useStore((s) => s.convertLead);
  const defaultCommissionRate = useStore((s) => s.defaultCommissionRate);
  const commissionRateByServiceType = useStore((s) => s.commissionRateByServiceType);
  const showToast = useStore((s) => s.showToast);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [orderFormOpen, setOrderFormOpen] = useState(false);

  function handleOrderSubmit(values: OrderFormValues) {
    let patientId: string | undefined;
    let patientName: string;

    if (values.source === "patient") {
      const patient = patients.find((p) => p.id === values.patient_id);
      if (!patient) return showToast("יש לבחור מטופל", { variant: "destructive" });
      if (patient.processing_restricted) {
        return showToast("לא ניתן ליצור הזמנה — עיבוד הנתונים של מטופל זה חסום", { variant: "destructive" });
      }
      patientId = patient.id;
      patientName = patient.full_name;
    } else if (values.source === "lead") {
      const lead = leads.find((l) => l.id === values.lead_id);
      if (!lead) return showToast("יש לבחור ליד", { variant: "destructive" });
      const newPatient = convertLead(lead.id);
      patientId = newPatient?.id;
      patientName = newPatient?.full_name ?? lead.full_name;
    } else {
      if (!values.manual_name.trim()) return showToast("יש להזין שם מטופל", { variant: "destructive" });
      patientName = values.manual_name;
    }

    const provider = providers.find((p) => p.id === values.provider_id);
    if (!provider) return showToast("יש לבחור ספק", { variant: "destructive" });

    const catalogItem = catalog.find((c) => c.id === values.catalog_item_id);
    const commissionRate =
      provider.commission_rate ??
      (catalogItem ? commissionRateByServiceType[catalogItem.service_type] : undefined) ??
      defaultCommissionRate;
    const commissionAmount = Math.round((values.final_price * commissionRate) / 100);

    addOrder({
      item_id: catalogItem?.id,
      item_name: values.item_name,
      provider_id: provider.id,
      provider_name: provider.display_name,
      created_by_id: patientId,
      patient_name: patientName,
      final_price: values.final_price,
      status: values.status,
      payment_status: values.payment_status,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      provider_payout_amount: values.final_price - commissionAmount,
    });
    showToast("ההזמנה נוספה בהצלחה", { variant: "success" });
    setOrderFormOpen(false);
  }

  const filtered = useMemo(() => {
    return orders
      .filter((o) => (status === "all" ? true : o.status === status))
      .filter((o) => !query || o.patient_name.includes(query) || o.provider_name.includes(query))
      .sort((a, b) => (a.created_date < b.created_date ? 1 : -1));
  }, [orders, query, status]);

  const totalRevenue = orders.filter((o) => o.status === "הושלם").reduce((s, o) => s + o.final_price, 0);

  return (
    <AppLayout>
      <PageHeader
        title="הזמנות"
        description="ניהול עסקאות והזמנות במערכת"
        actions={
          <Button size="sm" onClick={() => setOrderFormOpen(true)}>
            <Plus className="h-4 w-4" /> הזמנה חדשה
          </Button>
        }
      />

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

      <OrderForm
        open={orderFormOpen}
        onClose={() => setOrderFormOpen(false)}
        onSubmit={handleOrderSubmit}
        patients={patients}
        leads={leads}
        providers={providers}
        catalog={catalog}
      />
    </AppLayout>
  );
}
