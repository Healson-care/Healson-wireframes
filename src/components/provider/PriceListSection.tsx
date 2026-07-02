"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Misc";
import { formatCurrency, generateId } from "@/lib/utils";
import { KUPOT, Kupah, PriceByKupah } from "@/types";
import { Plus, Pencil, Trash2 } from "lucide-react";

export interface PriceListEntry {
  id: string;
  name: string;
  prices: PriceByKupah[];
  [extra: string]: unknown;
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
  const [prices, setPrices] = useState<Record<Kupah, string>>({
    כללית: "",
    מכבי: "",
    מאוחדת: "",
    לאומית: "",
  });

  function openCreate() {
    setEditingId(null);
    setName("");
    setExtraValue("");
    setPrices({ כללית: "", מכבי: "", מאוחדת: "", לאומית: "" });
    setOpen(true);
  }

  function openEdit(item: PriceListEntry) {
    setEditingId(item.id);
    setName(item.name);
    setExtraValue(String(item[extraFieldKey] ?? ""));
    const map: Record<Kupah, string> = { כללית: "", מכבי: "", מאוחדת: "", לאומית: "" };
    item.prices.forEach((p) => (map[p.kupah] = String(p.price)));
    setPrices(map);
    setOpen(true);
  }

  function handleSave() {
    const newItem: PriceListEntry = {
      id: editingId ?? generateId("item"),
      name,
      [extraFieldKey]: extraFieldType === "number" ? Number(extraValue) : extraValue,
      prices: KUPOT.map((k) => ({ kupah: k, price: Number(prices[k]) || 0 })),
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
                  <div key={p.kupah} className="flex justify-between rounded-md bg-slate-50 px-2 py-1">
                    <span className="text-slate-500">{p.kupah}</span>
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
          <div className="grid grid-cols-2 gap-2">
            {KUPOT.map((k) => (
              <Input
                key={k}
                label={`מחיר (${k})`}
                type="number"
                value={prices[k]}
                onChange={(e) => setPrices({ ...prices, [k]: e.target.value })}
                required
              />
            ))}
          </div>
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
