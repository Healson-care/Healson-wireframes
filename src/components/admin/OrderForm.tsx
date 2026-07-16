"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CatalogItem, Lead, Order, ORDER_PAYMENT_STATUSES, ORDER_STATUSES, Patient, ProviderProfile } from "@/types";

export type OrderSource = "patient" | "lead" | "manual";

export interface OrderFormValues {
  source: OrderSource;
  patient_id: string;
  lead_id: string;
  manual_name: string;
  provider_id: string;
  catalog_item_id: string;
  item_name: string;
  final_price: number;
  status: Order["status"];
  payment_status: NonNullable<Order["payment_status"]>;
}

const EMPTY: OrderFormValues = {
  source: "patient",
  patient_id: "",
  lead_id: "",
  manual_name: "",
  provider_id: "",
  catalog_item_id: "",
  item_name: "",
  final_price: 0,
  status: "ממתין",
  payment_status: "ממתין",
};

export function OrderForm({
  open,
  onClose,
  onSubmit,
  patients,
  leads,
  providers,
  catalog,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: OrderFormValues) => void;
  patients: Patient[];
  leads: Lead[];
  providers: ProviderProfile[];
  catalog: CatalogItem[];
}) {
  const [form, setForm] = useState<OrderFormValues>(EMPTY);
  const [wasOpen, setWasOpen] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setForm(EMPTY);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const itemsForProvider = form.provider_id
    ? catalog.filter((c) => !c.provider_id || c.provider_id === form.provider_id)
    : catalog;

  function pickCatalogItem(id: string) {
    const item = catalog.find((c) => c.id === id);
    setForm((f) => ({
      ...f,
      catalog_item_id: id,
      item_name: item?.name_he ?? f.item_name,
      final_price: item?.base_price ?? f.final_price,
    }));
  }

  return (
    <Dialog open={open} onClose={onClose} title="הזמנה חדשה" description="הוספה ידנית של הזמנה — כולל מיגרציה מליד ישן">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(form);
        }}
        className="flex flex-col gap-3"
      >
        <Select
          label="מקור המטופל"
          value={form.source}
          onChange={(e) => setForm({ ...form, source: e.target.value as OrderSource })}
        >
          <option value="patient">מטופל קיים</option>
          <option value="lead">ליד ישן (מיגרציה)</option>
          <option value="manual">הזנה ידנית</option>
        </Select>

        {form.source === "patient" && (
          <Select
            label="מטופל"
            required
            value={form.patient_id}
            onChange={(e) => setForm({ ...form, patient_id: e.target.value })}
          >
            <option value="">בחר מטופל...</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
                {p.phone ? ` — ${p.phone}` : ""}
              </option>
            ))}
          </Select>
        )}

        {form.source === "lead" && (
          <Select label="ליד" required value={form.lead_id} onChange={(e) => setForm({ ...form, lead_id: e.target.value })}>
            <option value="">בחר ליד...</option>
            {leads
              .filter((l) => l.status !== "הומר")
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.full_name}
                  {l.phone ? ` — ${l.phone}` : ""}
                </option>
              ))}
          </Select>
        )}

        {form.source === "manual" && (
          <Input
            label="שם מטופל"
            required
            value={form.manual_name}
            onChange={(e) => setForm({ ...form, manual_name: e.target.value })}
          />
        )}

        <Select
          label="ספק"
          required
          value={form.provider_id}
          onChange={(e) => setForm({ ...form, provider_id: e.target.value, catalog_item_id: "" })}
        >
          <option value="">בחר ספק...</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title ? `${p.title} ` : ""}
              {p.display_name}
            </option>
          ))}
        </Select>

        <Select label="שירות מהקטלוג" value={form.catalog_item_id} onChange={(e) => pickCatalogItem(e.target.value)}>
          <option value="">בחר שירות (אופציונלי)...</option>
          {itemsForProvider.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_he}
            </option>
          ))}
        </Select>

        <Input
          label="שם השירות"
          required
          value={form.item_name}
          onChange={(e) => setForm({ ...form, item_name: e.target.value })}
        />
        <Input
          label="מחיר סופי"
          type="number"
          required
          value={form.final_price}
          onChange={(e) => setForm({ ...form, final_price: Number(e.target.value) || 0 })}
        />

        <Select
          label="סטטוס הזמנה"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as Order["status"] })}
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>

        <Select
          label="סטטוס תשלום"
          value={form.payment_status}
          onChange={(e) =>
            setForm({ ...form, payment_status: e.target.value as NonNullable<Order["payment_status"]> })
          }
        >
          {ORDER_PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>

        <Button type="submit" className="mt-1">
          שמור הזמנה
        </Button>
      </form>
    </Dialog>
  );
}
