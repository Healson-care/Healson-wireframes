"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { generateId } from "@/lib/utils";
import { Clinic, LocationType, LOCATION_TYPE_LABELS } from "@/types";
import { Plus, Pencil, Trash2, Star, MapPin } from "lucide-react";

const PHYSICAL_LOCATION_TYPES: LocationType[] = ["clinic", "store"];

const EMPTY_HOURS: Clinic["hours"] = {
  sunday: null,
  monday: null,
  tuesday: null,
  wednesday: null,
  thursday: null,
  friday: null,
  saturday: null,
};

export function ClinicsSection({
  clinics,
  onChange,
  allowedLocationTypes = ["clinic"],
  locationLabelSingular = "מרפאה",
  locationLabelPlural = "מרפאות",
}: {
  clinics: Clinic[];
  onChange: (clinics: Clinic[]) => void;
  allowedLocationTypes?: LocationType[];
  locationLabelSingular?: string;
  locationLabelPlural?: string;
}) {
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", address: "", city: "", phone: "" });
  const [locationType, setLocationType] = useState<LocationType>(allowedLocationTypes[0] ?? "clinic");
  const isPhysical = PHYSICAL_LOCATION_TYPES.includes(locationType);

  function openCreate() {
    setEditingId(null);
    setForm({ name: "", address: "", city: "", phone: "" });
    setLocationType(allowedLocationTypes[0] ?? "clinic");
    setOpen(true);
  }

  function openEdit(clinic: Clinic) {
    setEditingId(clinic.id);
    setForm({ name: clinic.name, address: clinic.address, city: clinic.city, phone: clinic.phone });
    setLocationType(clinic.location_type ?? allowedLocationTypes[0] ?? "clinic");
    setOpen(true);
  }

  function handleSave() {
    const newClinic: Clinic = {
      id: editingId ?? generateId("clinic"),
      name: form.name,
      address: form.address,
      city: form.city,
      phone: form.phone,
      is_primary: editingId ? clinics.find((c) => c.id === editingId)?.is_primary ?? false : clinics.length === 0,
      hours: editingId ? clinics.find((c) => c.id === editingId)?.hours ?? EMPTY_HOURS : EMPTY_HOURS,
      location_type: locationType,
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
          <Plus className="h-4 w-4" /> הוסף {locationLabelSingular}
        </Button>
      </div>

      {clinics.length === 0 ? (
        <EmptyState icon={<MapPin className="h-10 w-10" />} title={`אין ${locationLabelPlural} מוגדרות`} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {clinics.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-900">{c.name}</p>
                    {c.is_primary && <Badge tone="green">{locationLabelSingular} ראשית</Badge>}
                    {allowedLocationTypes.length > 1 && (
                      <Badge tone="slate">{LOCATION_TYPE_LABELS[c.location_type ?? "clinic"]}</Badge>
                    )}
                  </div>
                  {(c.address || c.city) && (
                    <p className="text-xs text-slate-500 mt-1">{c.address}{c.address && c.city ? ", " : ""}{c.city}</p>
                  )}
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

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? `עריכת ${locationLabelSingular}` : `${locationLabelSingular} חדש/ה`}
        className="max-w-xl"
      >
        <div className="flex flex-col gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            {allowedLocationTypes.length > 1 && (
              <Select
                label="סוג המיקום"
                value={locationType}
                onChange={(e) => setLocationType(e.target.value as LocationType)}
                className="sm:col-span-2"
              >
                {allowedLocationTypes.map((t) => (
                  <option key={t} value={t}>
                    {LOCATION_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            )}
            <Input label={`שם ה${locationLabelSingular}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="עיר" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required={isPhysical} />
            <Input label="כתובת" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required={isPhysical} />
            <Input label="טלפון" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </div>
          {!isPhysical && (
            <p className="text-xs text-slate-500">
              עבור {LOCATION_TYPE_LABELS[locationType].toLowerCase()} אין צורך בכתובת פיזית — ניתן להשלים אזורי שירות בפרטי הפרופיל.
            </p>
          )}
          <p className="text-xs text-slate-500">
            את שעות הפעילות אפשר להגדיר בשלב הבא, בלשונית &quot;זמינות&quot;.
          </p>
          <Button onClick={handleSave}>שמור {locationLabelSingular}</Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={`מחיקת ${locationLabelSingular}`}
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteId) onChange(clinics.filter((c) => c.id !== deleteId));
        }}
      />
    </div>
  );
}
