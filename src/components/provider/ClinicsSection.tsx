"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { generateId } from "@/lib/utils";
import { Clinic, DayKey } from "@/types";
import { DAY_LABELS } from "@/lib/medical-tree";
import { Plus, Pencil, Trash2, Star, MapPin } from "lucide-react";

const DAYS: DayKey[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function ClinicsSection({
  clinics,
  onChange,
}: {
  clinics: Clinic[];
  onChange: (clinics: Clinic[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", address: "", city: "", phone: "" });
  const [hours, setHours] = useState<Record<DayKey, { open: boolean; start: string; end: string }>>(
    DAYS.reduce(
      (acc, d) => ({ ...acc, [d]: { open: d !== "friday" && d !== "saturday", start: "09:00", end: "17:00" } }),
      {} as Record<DayKey, { open: boolean; start: string; end: string }>
    )
  );

  function openCreate() {
    setEditingId(null);
    setForm({ name: "", address: "", city: "", phone: "" });
    setHours(
      DAYS.reduce(
        (acc, d) => ({ ...acc, [d]: { open: d !== "friday" && d !== "saturday", start: "09:00", end: "17:00" } }),
        {} as Record<DayKey, { open: boolean; start: string; end: string }>
      )
    );
    setOpen(true);
  }

  function openEdit(clinic: Clinic) {
    setEditingId(clinic.id);
    setForm({ name: clinic.name, address: clinic.address, city: clinic.city, phone: clinic.phone });
    setHours(
      DAYS.reduce((acc, d) => {
        const h = clinic.hours[d];
        return { ...acc, [d]: { open: !!h, start: h?.[0] ?? "09:00", end: h?.[1] ?? "17:00" } };
      }, {} as Record<DayKey, { open: boolean; start: string; end: string }>)
    );
    setOpen(true);
  }

  function handleSave() {
    const hoursRecord = DAYS.reduce((acc, d) => {
      acc[d] = hours[d].open ? [hours[d].start, hours[d].end] : null;
      return acc;
    }, {} as Clinic["hours"]);

    const newClinic: Clinic = {
      id: editingId ?? generateId("clinic"),
      name: form.name,
      address: form.address,
      city: form.city,
      phone: form.phone,
      is_primary: editingId ? clinics.find((c) => c.id === editingId)?.is_primary ?? false : clinics.length === 0,
      hours: hoursRecord,
    };

    if (editingId) {
      onChange(clinics.map((c) => (c.id === editingId ? newClinic : c)));
    } else {
      onChange([...clinics, newClinic]);
    }
    setOpen(false);
  }

  function setPrimary(id: string) {
    onChange(clinics.map((c) => ({ ...c, is_primary: c.id === id })));
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> הוסף מרפאה
        </Button>
      </div>

      {clinics.length === 0 ? (
        <EmptyState icon={<MapPin className="h-10 w-10" />} title="אין מרפאות מוגדרות" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {clinics.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900">{c.name}</p>
                    {c.is_primary && <Badge tone="green">מרפאה ראשית</Badge>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{c.address}, {c.city}</p>
                  <p className="text-xs text-slate-400">{c.phone}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1 text-[11px]">
                {DAYS.map((d) => (
                  <span key={d} className="rounded bg-slate-50 px-1.5 py-0.5 text-slate-500">
                    {DAY_LABELS[d]}: {c.hours[d] ? `${c.hours[d]![0]}-${c.hours[d]![1]}` : "סגור"}
                  </span>
                ))}
              </div>
              {!c.is_primary && (
                <button
                  onClick={() => setPrimary(c.id)}
                  className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Star className="h-3 w-3" /> הגדר כראשית
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={editingId ? "עריכת מרפאה" : "מרפאה חדשה"} className="max-w-xl">
        <div className="flex flex-col gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="שם המרפאה" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="עיר" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
            <Input label="כתובת" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
            <Input label="טלפון" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </div>
          <p className="text-sm font-medium text-slate-700 mt-2">שעות פעילות</p>
          <div className="flex flex-col gap-2">
            {DAYS.map((d) => (
              <div key={d} className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 w-20 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={hours[d].open}
                    onChange={(e) => setHours({ ...hours, [d]: { ...hours[d], open: e.target.checked } })}
                    className="h-4 w-4 rounded border-slate-300 accent-primary"
                  />
                  {DAY_LABELS[d]}
                </label>
                {hours[d].open && (
                  <>
                    <input
                      type="time"
                      value={hours[d].start}
                      onChange={(e) => setHours({ ...hours, [d]: { ...hours[d], start: e.target.value } })}
                      className="h-8 rounded-md border border-slate-300 px-2 text-sm"
                    />
                    <span className="text-slate-400">—</span>
                    <input
                      type="time"
                      value={hours[d].end}
                      onChange={(e) => setHours({ ...hours, [d]: { ...hours[d], end: e.target.value } })}
                      className="h-8 rounded-md border border-slate-300 px-2 text-sm"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
          <Button onClick={handleSave}>שמור מרפאה</Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="מחיקת מרפאה"
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteId) onChange(clinics.filter((c) => c.id !== deleteId));
        }}
      />
    </div>
  );
}
