"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { Clinic, DayKey, LOCATION_TYPE_LABELS } from "@/types";
import { DAY_LABELS } from "@/lib/medical-tree";
import { Pencil, CalendarClock } from "lucide-react";

const DAYS: DayKey[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

type DayForm = Record<DayKey, { open: boolean; start: string; end: string }>;

function hoursToForm(hours: Clinic["hours"]): DayForm {
  return DAYS.reduce((acc, d) => {
    const h = hours[d];
    return { ...acc, [d]: { open: !!h, start: h?.[0] ?? "09:00", end: h?.[1] ?? "17:00" } };
  }, {} as DayForm);
}

function formToHours(form: DayForm): Clinic["hours"] {
  return DAYS.reduce((acc, d) => {
    acc[d] = form[d].open ? [form[d].start, form[d].end] : null;
    return acc;
  }, {} as Clinic["hours"]);
}

/** Sets weekly opening hours per already-created location — deliberately
 * separated from ClinicsSection (which only creates the location itself) so
 * "add a location" and "set its availability" are two distinct onboarding
 * steps, matching the provider-facing journey. */
export function AvailabilitySection({
  clinics,
  onChange,
  locationLabelSingular = "מרפאה",
  locationLabelPlural = "מרפאות",
}: {
  clinics: Clinic[];
  onChange: (clinics: Clinic[]) => void;
  locationLabelSingular?: string;
  locationLabelPlural?: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DayForm | null>(null);

  function openEdit(clinic: Clinic) {
    setEditingId(clinic.id);
    setForm(hoursToForm(clinic.hours));
  }

  function handleSave() {
    if (!editingId || !form) return;
    onChange(clinics.map((c) => (c.id === editingId ? { ...c, hours: formToHours(form) } : c)));
    setEditingId(null);
    setForm(null);
  }

  if (clinics.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock className="h-10 w-10" />}
        title={`הוסיפו ${locationLabelSingular} כדי להגדיר זמינות`}
        description={`אין עדיין ${locationLabelPlural} — יש להוסיף אחד/ת בלשונית "${locationLabelPlural}" לפני שאפשר לקבוע שעות פעילות.`}
      />
    );
  }

  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-3">
        {clinics.map((c) => {
          const hasAnyHours = Object.values(c.hours).some((h) => h !== null);
          return (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-slate-900">{c.name}</p>
                  <Badge tone="slate">{LOCATION_TYPE_LABELS[c.location_type ?? "clinic"]}</Badge>
                  {!hasAnyHours && <Badge tone="warning">אין שעות פעילות</Badge>}
                </div>
                <button onClick={() => openEdit(c)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1 text-[11px]">
                {DAYS.map((d) => (
                  <span key={d} className="rounded bg-slate-50 px-1.5 py-0.5 text-slate-500">
                    {DAY_LABELS[d]}: {c.hours[d] ? `${c.hours[d]![0]}-${c.hours[d]![1]}` : "סגור"}
                  </span>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={!!editingId}
        onClose={() => {
          setEditingId(null);
          setForm(null);
        }}
        title={`שעות פעילות — ${clinics.find((c) => c.id === editingId)?.name ?? ""}`}
        className="max-w-xl"
      >
        {form && (
          <div className="flex flex-col gap-3">
            {DAYS.map((d) => (
              <div key={d} className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 w-20 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={form[d].open}
                    onChange={(e) => setForm({ ...form, [d]: { ...form[d], open: e.target.checked } })}
                    className="h-4 w-4 rounded border-slate-300 accent-primary"
                  />
                  {DAY_LABELS[d]}
                </label>
                {form[d].open && (
                  <>
                    <input
                      type="time"
                      value={form[d].start}
                      onChange={(e) => setForm({ ...form, [d]: { ...form[d], start: e.target.value } })}
                      className="h-8 rounded-md border border-slate-300 px-2 text-sm"
                    />
                    <span className="text-slate-400">—</span>
                    <input
                      type="time"
                      value={form[d].end}
                      onChange={(e) => setForm({ ...form, [d]: { ...form[d], end: e.target.value } })}
                      className="h-8 rounded-md border border-slate-300 px-2 text-sm"
                    />
                  </>
                )}
              </div>
            ))}
            <Button onClick={handleSave}>שמור שעות פעילות</Button>
          </div>
        )}
      </Dialog>
    </div>
  );
}
