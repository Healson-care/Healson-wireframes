"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Misc";
import { formatCurrency, generateId } from "@/lib/utils";
import { INSURANCE_LAYERS, InsuranceLayer, LAYER_LABELS, PriceByLayer } from "@/types";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";

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
}: {
  items: PriceListEntry[];
  onChange: (items: PriceListEntry[]) => void;
  extraFieldKey: string;
  extraFieldLabel: string;
  extraFieldType?: "text" | "number";
  itemLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [extraValue, setExtraValue] = useState<string>("");
  const [prices, setPrices] = useState<Record<InsuranceLayer, string>>(emptyLayerPrices());

  function openCreate() {
    setEditingId(null);
    setName("");
    setExtraValue("");
    setPrices(emptyLayerPrices());
    setOpen(true);
  }

  function openEdit(item: PriceListEntry) {
    setEditingId(item.id);
    setName(item.name);
    setExtraValue(String(item[extraFieldKey] ?? ""));
    const map = emptyLayerPrices();
    item.prices.forEach((p) => (map[p.layer] = String(p.price)));
    setPrices(map);
    setOpen(true);
  }

  function handleSave() {
    // Location linking is owned by the clinics screen — preserve existing links.
    const editingExisting = editingId ? items.find((i) => i.id === editingId) : undefined;
    const newItem: PriceListEntry = {
      id: editingId ?? generateId("item"),
      name,
      [extraFieldKey]: extraFieldType === "number" ? Number(extraValue) : extraValue,
      prices: INSURANCE_LAYERS.filter((l) => prices[l] !== "").map((l) => ({ layer: l, price: Number(prices[l]) || 0 })),
      linked_clinic_ids: editingExisting?.linked_clinic_ids ?? [],
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
                  <p className="mt-1">
                    {(item.linked_clinic_ids?.length ?? 0) > 0 ? (
                      <span className="flex items-center gap-1 text-[11px] text-slate-500">
                        <MapPin className="h-3 w-3" />
                        מוצע ב-{item.linked_clinic_ids!.length} מיקומים
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <MapPin className="h-3 w-3" /> שייכו למיקום בלשונית המיקומים
                      </span>
                    )}
                  </p>
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
          <p className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            שיוך הפריט למיקומים נעשה בלשונית המיקומים — שם בוחרים לכל מיקום אילו פריטים מוצעים בו.
          </p>
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
