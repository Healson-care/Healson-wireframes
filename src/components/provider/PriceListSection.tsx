"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Misc";
import { formatCurrency, generateId } from "@/lib/utils";
import { Clinic, INSURANCE_LAYERS, InsuranceLayer, LAYER_LABELS, PriceByLayer } from "@/types";
import { Plus, Pencil, Trash2, CalendarDays, TriangleAlert } from "lucide-react";

export interface PriceListEntry {
  id: string;
  name: string;
  prices: PriceByLayer[];
  linked_clinic_ids?: string[];
  [extra: string]: unknown;
}

/** S/K/B/H per-layer price inputs, shared by PriceListSection and
 * ServiceCatalogSection's create/edit dialogs. */
export function LayerPriceInputs({
  prices,
  onChange,
}: {
  prices: Record<InsuranceLayer, string>;
  onChange: (prices: Record<InsuranceLayer, string>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {INSURANCE_LAYERS.map((l) => (
        <Input
          key={l}
          label={`מחיר ${LAYER_LABELS[l]} (${l})`}
          type="number"
          value={prices[l]}
          onChange={(e) => onChange({ ...prices, [l]: e.target.value })}
        />
      ))}
    </div>
  );
}

export function emptyLayerPrices(): Record<InsuranceLayer, string> {
  return { S: "", K: "", B: "", H: "" };
}

export function PriceListSection({
  items,
  onChange,
  extraFieldKey,
  extraFieldLabel,
  extraFieldType = "text",
  itemLabel,
  clinics,
}: {
  items: PriceListEntry[];
  onChange: (items: PriceListEntry[]) => void;
  extraFieldKey: string;
  extraFieldLabel: string;
  extraFieldType?: "text" | "number";
  itemLabel: string;
  clinics?: Clinic[];
}) {
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [extraValue, setExtraValue] = useState<string>("");
  const [prices, setPrices] = useState<Record<InsuranceLayer, string>>(emptyLayerPrices());
  const [linkedClinicIds, setLinkedClinicIds] = useState<string[]>([]);

  function openCreate() {
    setEditingId(null);
    setName("");
    setExtraValue("");
    setPrices(emptyLayerPrices());
    setLinkedClinicIds([]);
    setOpen(true);
  }

  function openEdit(item: PriceListEntry) {
    setEditingId(item.id);
    setName(item.name);
    setExtraValue(String(item[extraFieldKey] ?? ""));
    const map = emptyLayerPrices();
    item.prices.forEach((p) => (map[p.layer] = String(p.price)));
    setPrices(map);
    setLinkedClinicIds(item.linked_clinic_ids ?? []);
    setOpen(true);
  }

  function toggleLinkedClinic(id: string) {
    setLinkedClinicIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function handleSave() {
    const newItem: PriceListEntry = {
      id: editingId ?? generateId("item"),
      name,
      [extraFieldKey]: extraFieldType === "number" ? Number(extraValue) : extraValue,
      prices: INSURANCE_LAYERS.filter((l) => prices[l] !== "").map((l) => ({ layer: l, price: Number(prices[l]) || 0 })),
      ...(clinics ? { linked_clinic_ids: linkedClinicIds } : {}),
    };
    if (editingId) {
      onChange(items.map((i) => (i.id === editingId ? newItem : i)));
    } else {
      onChange([...items, newItem]);
    }
    setOpen(false);
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> הוסף {itemLabel}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState title={`אין ${itemLabel} מוגדרים`} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    {extraFieldLabel}: {String(item[extraFieldKey])}
                  </p>
                  {clinics && (
                    <p className="mt-1">
                      {(item.linked_clinic_ids?.length ?? 0) > 0 ? (
                        <span className="flex items-center gap-1 text-[11px] text-slate-500">
                          <CalendarDays className="h-3 w-3" />
                          {item.linked_clinic_ids!.length} יומנים מקושרים
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-warning-text font-medium">
                          <TriangleAlert className="h-3 w-3" /> לא משויך ליומן
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleteId(item.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
                {item.prices.map((p) => (
                  <div key={p.layer} className="flex justify-between rounded-md bg-slate-50 px-2 py-1">
                    <span className="text-slate-500">{LAYER_LABELS[p.layer]}</span>
                    <span className="font-medium text-slate-700">{formatCurrency(p.price)}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={editingId ? `עריכת ${itemLabel}` : `${itemLabel} חדש`}>
        <div className="flex flex-col gap-3">
          <Input label="שם" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            label={extraFieldLabel}
            type={extraFieldType}
            value={extraValue}
            onChange={(e) => setExtraValue(e.target.value)}
            required
          />
          {clinics && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">יומנים מקושרים</p>
              {clinics.length === 0 ? (
                <p className="flex items-center gap-1.5 rounded-lg bg-warning-bg border border-warning-border px-3 py-2 text-xs text-warning-text">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> יש להוסיף יומן לפני שניתן לשייך שירות זה — עבור/י לטאב &quot;יומנים&quot;
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {clinics.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={linkedClinicIds.includes(c.id)}
                        onChange={() => toggleLinkedClinic(c.id)}
                        className="h-4 w-4 rounded border-slate-300 accent-primary"
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-slate-400">מחיר לשכבת ביטוח — השאירו ריק אם הספק לא עובד מול שכבה זו</p>
          <LayerPriceInputs prices={prices} onChange={setPrices} />
          <Button onClick={handleSave}>שמור</Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={`מחיקת ${itemLabel}`}
        description="פעולה זו אינה הפיכה."
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteId) onChange(items.filter((i) => i.id !== deleteId));
        }}
      />
    </div>
  );
}
