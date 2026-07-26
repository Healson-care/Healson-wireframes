"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { cn, generateId } from "@/lib/utils";
import {
  ConsultationType,
  FACILITY_KIND_LABELS,
  FACILITY_KINDS,
  FacilityKind,
  ProviderFacility,
} from "@/types";
import { hasAnyAvailability, totalWeeklyHours } from "@/lib/schedule";
import { AlertCircle, CalendarClock, Layers, MonitorCog, Pencil, Plus, Stethoscope, Trash2 } from "lucide-react";

/** The unit's מתקנים (§PRV-08) — the machines and rooms a medical unit books
 * against: "MRI 1", "CT 1", "חדר פעולות 2".
 *
 * A facility is a queue of its own: it holds the services performed on it
 * ("MRI ראש", "MRI בטן" hang off MRI 1) and its own weekly schedule, edited in
 * the availability screen. Two facilities can serve two patients at the same
 * hour — that's the whole point of modelling them separately. */
export function FacilitiesSection({
  facilities,
  services,
  onChange,
}: {
  facilities: ProviderFacility[];
  services: ConsultationType[];
  onChange: (facilities: ProviderFacility[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<FacilityKind>("mri");
  const [model, setModel] = useState("");
  const [room, setRoom] = useState("");
  const [serviceArray, setServiceArray] = useState("");
  // Omer's shortcut: one לוז can stand for several identical machines instead
  // of creating a separate לוז per machine.
  const [multiMachine, setMultiMachine] = useState(false);
  const [capacity, setCapacity] = useState("2");
  const [isActive, setIsActive] = useState(true);
  const [serviceIds, setServiceIds] = useState<string[]>([]);

  // A service linked to no facility and to no doctor can't be scheduled at
  // resource level — the availability screen repeats this, but it belongs here
  // too since this is where the link is made.
  const unlinkedServices = services.filter((s) => !facilities.some((f) => f.service_ids.includes(s.id)));

  // Group the לוזים by מערך (service line) so the structure מערך → לוזים is
  // visible, exactly as the hierarchy models it.
  const groups: [string, ProviderFacility[]][] = [];
  facilities.forEach((f) => {
    const key = f.service_array?.trim() || "ללא מערך";
    const bucket = groups.find(([name]) => name === key);
    if (bucket) bucket[1].push(f);
    else groups.push([key, [f]]);
  });

  function openCreate() {
    setEditingId(null);
    setName("");
    setKind("mri");
    setModel("");
    setRoom("");
    setServiceArray("");
    setMultiMachine(false);
    setCapacity("2");
    setIsActive(true);
    setServiceIds([]);
    setOpen(true);
  }

  function openEdit(facility: ProviderFacility) {
    setEditingId(facility.id);
    setName(facility.name);
    setKind(facility.kind);
    setModel(facility.model ?? "");
    setRoom(facility.room ?? "");
    setServiceArray(facility.service_array ?? "");
    setMultiMachine((facility.capacity ?? 1) > 1);
    setCapacity(String(Math.max(2, facility.capacity ?? 2)));
    setIsActive(facility.is_active !== false);
    setServiceIds(facility.service_ids ?? []);
    setOpen(true);
  }

  function handleSave() {
    const existing = editingId ? facilities.find((f) => f.id === editingId) : undefined;
    const next: ProviderFacility = {
      // Spread first so the week owned by the availability screen survives an
      // edit here — this dialog owns the facility's identity and its services.
      ...existing,
      id: editingId ?? generateId("fac"),
      name: name.trim(),
      kind,
      model: model.trim() || undefined,
      room: room.trim() || undefined,
      service_array: serviceArray.trim() || undefined,
      capacity: multiMachine ? Math.max(2, Number(capacity) || 2) : 1,
      is_active: isActive,
      service_ids: serviceIds,
      created_at: existing?.created_at ?? new Date().toISOString(),
    };
    onChange(editingId ? facilities.map((f) => (f.id === editingId ? next : f)) : [...facilities, next]);
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <MonitorCog className="h-4 w-4 text-slate-400" />
          <div>
            <p className="text-sm font-medium text-slate-900">מכשירי היחידה</p>
            <p className="text-xs text-slate-500">
              {groups.length} מערכים · {facilities.length} מכשירים ·{" "}
              {facilities.filter((f) => hasAnyAvailability(f)).length} עם לוח זמנים פעיל
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> הוספת מכשיר
        </Button>
      </Card>

      {/* In-app explainer of מערך → מכשיר; scheduling (הלו״ז) lives in זמינות */}
      <div className="flex items-start gap-2 rounded-lg border border-info-border bg-info-bg px-3 py-2.5 text-xs leading-relaxed text-info-text">
        <Layers className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <b>מערך</b> = קטגוריית שירות של היחידה (מערך MRI, מערך CT…). כאן מגדירים את <b>המכשירים</b> ולאיזה מערך
          כל אחד שייך. מכשיר אחד יכול לייצג כמה יחידות זהות. את לוח הזמנים (<b>הלו״ז</b>) של כל מכשיר מגדירים
          בלשונית ‚זמינות‘ ← מערכים ולוזים.
        </span>
      </div>

      {facilities.length > 0 && unlinkedServices.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning-text">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {unlinkedServices.length} פריטים אינם מקושרים לאף מכשיר:{" "}
            {unlinkedServices
              .slice(0, 4)
              .map((s) => s.name)
              .join(", ")}
            {unlinkedServices.length > 4 ? " ועוד" : ""}. פריט שמבוצע על ידי נותן/ת שירות בלבד — שייכו אותו בלשונית
            &quot;נותני שירות&quot;.
          </span>
        </div>
      )}

      {facilities.length === 0 ? (
        <EmptyState
          icon={<MonitorCog className="h-10 w-10" />}
          title="לא הוגדרו מכשירים"
          description="הוסיפו את מכשירי היחידה (MRI 1, CT 1…), שייכו כל אחד למערך, ושייכו לו את הפריטים המבוצעים עליו. את לוח הזמנים של כל מכשיר מגדירים בלשונית ‚זמינות‘."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([arrayName, facs]) => {
            const totalStations = facs.reduce((sum, f) => sum + Math.max(1, f.capacity ?? 1), 0);
            return (
            <div key={arrayName} className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <Layers className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-slate-900">{arrayName}</p>
                <Badge tone="purple">{facs.length} מכשירים</Badge>
                {totalStations > facs.length && (
                  <span className="text-xs text-slate-400">· {totalStations} יחידות פיזיות</span>
                )}
              </div>
              <div className="grid gap-3 p-3 sm:grid-cols-2">
                {facs.map((facility) => {
            const linked = services.filter((s) => facility.service_ids.includes(s.id));
            const weekly = totalWeeklyHours(facility);
            return (
              <Card key={facility.id} className={cn("p-4", facility.is_active === false && "bg-slate-50/60")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-medium text-slate-900">{facility.name}</p>
                      <Badge tone="blue">{FACILITY_KIND_LABELS[facility.kind]}</Badge>
                      {facility.service_array && <Badge tone="purple">{facility.service_array}</Badge>}
                      {(facility.capacity ?? 1) > 1 && <Badge tone="green">מייצג {facility.capacity} מכשירים</Badge>}
                      {facility.is_active === false && <Badge tone="slate">לא פעיל</Badge>}
                    </div>
                    {(facility.model || facility.room) && (
                      <p className="mt-1 text-xs text-slate-500">
                        {[facility.model, facility.room].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                      <CalendarClock className="h-3 w-3" />
                      {hasAnyAvailability(facility)
                        ? `${weekly.toFixed(1)} שעות פעילות בשבוע`
                        : "טרם הוגדר לוח זמנים — הגדירו בלשונית זמינות"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => openEdit(facility)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                      aria-label="עריכת מכשיר"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(facility.id)}
                      className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                      aria-label="מחיקת מכשיר"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    <Stethoscope className="h-3 w-3" /> פריטים המבוצעים במכשיר
                  </p>
                  {linked.length === 0 ? (
                    <p className="text-xs text-warning-text">לא שויכו פריטים — המכשיר לא יופיע בהזמנת תורים</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {linked.map((s) => (
                        <Badge key={s.id} tone="slate">
                          {s.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
                })}
              </div>
            </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "עריכת מכשיר" : "מכשיר חדש"}
        description="מכשיר/עמדה של היחידה — MRI 1, CT 1. משייכים אותו למערך. את לוח הזמנים שלו מגדירים בלשונית ‚זמינות‘."
        className="max-w-xl"
      >
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="שם המכשיר"
              placeholder="MRI 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              hint="השם שיופיע ביומן ובשיבוץ"
              required
            />
            <Select label="סוג המכשיר" value={kind} onChange={(e) => setKind(e.target.value as FacilityKind)}>
              {FACILITY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {FACILITY_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
            <Input
              label="דגם (לא חובה)"
              placeholder="Siemens Magnetom Vida 3T"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
            <Input
              label="מיקום בתוך היחידה (לא חובה)"
              placeholder="חדר 4, קומה -1"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />
            <Input
              label="מערך (קו שירות)"
              placeholder="מערך MRI"
              value={serviceArray}
              onChange={(e) => setServiceArray(e.target.value)}
              hint="קטגוריית השירות שהמכשיר שייך אליה"
            />
          </div>

          {/* Omer's shortcut — one record can represent several identical machines */}
          <div className="rounded-lg border border-slate-200 p-3">
            <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={multiMachine}
                onChange={(e) => setMultiMachine(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-primary"
              />
              <span>
                רשומה זו מייצגת כמה מכשירים זהים
                <span className="block text-xs font-normal text-slate-500">
                  במקום ליצור רשומה לכל מכשיר. אותו לו״ז יחול על כולם — כל שעה תיפתח למספר המכשירים במקביל.
                </span>
              </span>
            </label>
            {multiMachine && (
              <Input
                label="מספר המכשירים הזהים"
                type="number"
                min={2}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="mt-2 max-w-[180px]"
              />
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-primary"
            />
            מכשיר פעיל (מכשיר לא פעיל אינו מייצר תורים — למשל בזמן תחזוקה ממושכת)
          </label>

          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Stethoscope className="h-3.5 w-3.5 text-slate-400" /> פריטים המבוצעים במכשיר זה
              </span>
              {services.length > 0 && (
                <button
                  type="button"
                  onClick={() => setServiceIds(serviceIds.length === services.length ? [] : services.map((s) => s.id))}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  {serviceIds.length === services.length ? "נקה הכל" : "בחר הכל"}
                </button>
              )}
            </div>
            {services.length === 0 ? (
              <p className="text-xs text-slate-400">
                אין עדיין פריטים בקטלוג — הוסיפו פריטים בלשונית &quot;פריטים&quot; ואז שייכו אותם למכשיר.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {services.map((s) => {
                  const picked = serviceIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        setServiceIds(picked ? serviceIds.filter((id) => id !== s.id) : [...serviceIds, s.id])
                      }
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        picked
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      )}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <p className="flex items-start gap-1.5 rounded-lg bg-info-bg px-3 py-2 text-xs text-info-text">
            <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            את לוח הזמנים (הלו״ז) של המכשיר מגדירים בלשונית &quot;זמינות&quot; ← מערכים ולוזים. מכשיר שמייצג N יחידות
            = N תורים במקביל בכל שעה.
          </p>

          <Button onClick={handleSave} disabled={!name.trim()}>
            שמור מכשיר
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="מחיקת מכשיר"
        description={(() => {
          if (!deleteId) return undefined;
          const facility = facilities.find((f) => f.id === deleteId);
          const count = facility?.service_ids.length ?? 0;
          return count === 0
            ? "לוח הזמנים של המכשיר יימחק. פעולה זו אינה הפיכה."
            : `${count} פריטים מבוצעים במכשיר זה ולא יהיו ניתנים להזמנה עד שישויכו למכשיר אחר. פעולה זו אינה הפיכה.`;
        })()}
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteId) onChange(facilities.filter((f) => f.id !== deleteId));
        }}
      />
    </div>
  );
}
