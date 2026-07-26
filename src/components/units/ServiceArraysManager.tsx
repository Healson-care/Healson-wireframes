"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Input";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/Misc";
import { getUnitResources } from "@/lib/unit-resources";
import { generateId } from "@/lib/utils";
import {
  FacilityKind,
  FACILITY_KINDS,
  FACILITY_KIND_LABELS,
  OrganizationBranch,
  ProviderFacility,
  ProviderProfile,
  ServiceArray,
  ServiceArrayType,
  SERVICE_ARRAY_TYPES,
  SERVICE_ARRAY_TYPE_LABELS,
} from "@/types";

import {
  CalendarClock,
  Layers,
  MapPinned,
  MonitorCog,
  Pencil,
  Plus,
  Stethoscope,
  TriangleAlert,
  Trash2,
} from "lucide-react";

// A sensible default equipment kind per service line, so "הוספת עמדה" in the
// מערך הדמיה doesn't open on "חדר טיפולים".
const SERVICE_ARRAY_DEFAULT_FACILITY_KIND: Partial<Record<ServiceArrayType, FacilityKind>> = {
  imaging: "mri",
  lab: "sampling_station",
  samples: "sampling_station",
  procedures: "procedure_room",
  treatments: "treatment_room",
  surgery: "operating_room",
  consultations: "treatment_room",
  rehab: "treatment_room",
  womens_health: "ultrasound",
};

/**
 * The dedicated מערכים screen — the unit's service lines as first-class cards,
 * across ALL branches at once.
 *
 * This exists because מערך is the level people actually think and talk at ("יש
 * לנו מערך MRI בעין כרם"), yet it used to be a row of 11px chips buried inside
 * a branch card. Here each מערך is the dominant object: its branch, its עמדות,
 * and whether those עמדות have a לו״ז — which is the one thing that decides
 * whether the מערך can be booked at all.
 *
 * Creating a מערך requires choosing its branch, so the branch↔מערך attachment
 * is done here rather than only from the branch side.
 */
export function ServiceArraysManager({ provider }: { provider: ProviderProfile }) {
  const organizationBranches = useStore((s) => s.organizationBranches);
  const serviceArrays = useStore((s) => s.serviceArrays);
  const providers = useStore((s) => s.providers);
  const addServiceArray = useStore((s) => s.addServiceArray);
  const updateServiceArray = useStore((s) => s.updateServiceArray);
  const deleteServiceArray = useStore((s) => s.deleteServiceArray);
  const updateProviderById = useStore((s) => s.updateProviderById);
  const showToast = useStore((s) => s.showToast);

  const branches = useMemo(
    () => organizationBranches.filter((b) => b.unit_id === provider.id),
    [organizationBranches, provider.id]
  );
  const arrays = useMemo(() => {
    const ids = new Set(branches.map((b) => b.id));
    return serviceArrays.filter((a) => ids.has(a.branch_id));
  }, [serviceArrays, branches]);

  // Every עמדה of the unit, so each מערך card can show what's actually in it.
  const doctorInfo = useMemo(
    () =>
      new Map(
        providers.map((p) => [p.id, { name: `${p.title ?? ""} ${p.display_name}`.trim(), specialty: p.specialty }])
      ),
    [providers]
  );
  const resources = useMemo(
    () => getUnitResources(provider, doctorInfo, arrays),
    [provider, doctorInfo, arrays]
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceArray | null>(null);
  const [type, setType] = useState<ServiceArrayType>("imaging");
  const [name, setName] = useState("");
  const [branchId, setBranchId] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openAdd = (presetBranch?: string) => {
    setEditing(null);
    setType("imaging");
    setName("");
    setBranchId(presetBranch ?? branches[0]?.id ?? "");
    setDialogOpen(true);
  };
  const openEdit = (a: ServiceArray) => {
    setEditing(a);
    setType(a.type);
    setName(a.name);
    setBranchId(a.branch_id);
    setDialogOpen(true);
  };

  const save = () => {
    if (!branchId) return;
    if (editing) {
      // Moving a מערך between branches moves its עמדות with it — they resolve
      // their branch through the מערך, so nothing else needs rewriting.
      updateServiceArray(editing.id, { type, name: name.trim() || undefined, branch_id: branchId });
      showToast("המערך עודכן", { variant: "success" });
    } else {
      const r = addServiceArray(branchId, { type, name: name.trim() || undefined });
      if (!r.ok) {
        showToast(r.error ?? "הוספת המערך נכשלה", { variant: "destructive" });
        return;
      }
      showToast("המערך נוסף", { variant: "success" });
    }
    setDialogOpen(false);
  };

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "ללא סניף";

  // --- עמדה creation, done from inside the מערך it belongs to -------------
  // This is the only place a new equipment עמדה is created. Doing it from the
  // מערך card means service_array_id is never empty on a fresh עמדה, which was
  // the main way units ended up with unbookable resources.
  const [stationFor, setStationFor] = useState<ServiceArray | null>(null);
  const [stationName, setStationName] = useState("");
  const [stationKind, setStationKind] = useState<FacilityKind>("mri");
  const [stationModel, setStationModel] = useState("");
  const [stationRoom, setStationRoom] = useState("");
  const [stationCapacity, setStationCapacity] = useState(1);

  const openAddStation = (a: ServiceArray) => {
    setStationFor(a);
    setStationName("");
    setStationKind(SERVICE_ARRAY_DEFAULT_FACILITY_KIND[a.type] ?? "other");
    setStationModel("");
    setStationRoom("");
    setStationCapacity(1);
  };

  const saveStation = () => {
    if (!stationFor || !stationName.trim()) return;
    const station: ProviderFacility = {
      id: generateId("fac"),
      name: stationName.trim(),
      kind: stationKind,
      model: stationModel.trim() || undefined,
      room: stationRoom.trim() || undefined,
      is_active: true,
      service_array_id: stationFor.id,
      branch_id: stationFor.branch_id,
      capacity: Math.max(1, stationCapacity),
      service_ids: [],
      created_at: new Date().toISOString(),
    };
    updateProviderById(provider.id, { facilities: [...(provider.facilities ?? []), station] });
    showToast("העמדה נוספה למערך", {
      variant: "success",
      description: "כעת אפשר להגדיר לה לו״ז בלשונית ‚זמינות‘.",
    });
    setStationFor(null);
  };

  if (branches.length === 0) {
    return (
      <EmptyState
        icon={<MapPinned className="h-10 w-10" />}
        title="צריך קודם סניף"
        description="מערך הוא קו שירות בתוך סניף מסוים, אז יש להוסיף סניף אחד לפחות לפני שאפשר להגדיר מערכים."
        action={
          <Link href="/provider/profile/structure">
            <Button size="sm">
              <MapPinned className="h-4 w-4" /> למסך הסניפים
            </Button>
          </Link>
        }
      />
    );
  }

  const orphanResources = resources.filter((r) => !r.service_array_id);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-slate-400" />
          <div>
            <p className="text-sm font-medium text-slate-900">מערכי השירות של היחידה</p>
            <p className="text-xs text-slate-500">
              {arrays.length} מערכים · {branches.length} סניפים · {resources.length} עמדות
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => openAdd()}>
          <Plus className="h-4 w-4" /> מערך חדש
        </Button>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-info-border bg-info-bg px-3 py-2.5 text-xs leading-relaxed text-info-text">
        <Layers className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <b>מערך</b> = קו שירות בתוך סניף (מערך MRI, מערך ייעוצים…). בתוך כל מערך יש <b>עמדות</b> — ציוד או נותן/ת
          שירות — ולכל עמדה לו״ז משלה. את לוחות הזמנים מגדירים בלשונית ‚זמינות‘.
        </span>
      </div>

      {/* עמדות that belong to no מערך can never be booked through one — surface
          it here rather than letting it hide inside the availability screen. */}
      {orphanResources.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2.5 text-xs leading-relaxed text-warning-text">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {orphanResources.length} עמדות אינן משויכות לאף מערך ({orphanResources.slice(0, 3).map((r) => r.name).join(", ")}
            {orphanResources.length > 3 ? " ועוד" : ""}). שייכו אותן למערך בלשונית{" "}
            <Link href="/provider/profile/availability" className="font-semibold underline">
              זמינות
            </Link>
            .
          </span>
        </div>
      )}

      {arrays.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-10 w-10" />}
          title="אין עדיין מערכים"
          description="הוסיפו מערך ראשון — לדוגמה ‚מערך הדמיה‘ — ושייכו אליו את העמדות שמבצעות אותו."
          action={
            <Button size="sm" onClick={() => openAdd()}>
              <Plus className="h-4 w-4" /> מערך חדש
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {arrays.map((a) => {
            const members = resources.filter((r) => r.service_array_id === a.id);
            const equipment = members.filter((m) => m.kind === "facility");
            const staff = members.filter((m) => m.kind === "doctor");
            const scheduled = members.filter((m) => m.schedule || m.schedule_id).length;
            const stations = members.reduce((n, m) => n + Math.max(1, m.capacity ?? 1), 0);
            return (
              <Card key={a.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-base font-bold text-slate-900">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Layers className="h-4.5 w-4.5" />
                      </span>
                      {a.name}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <Badge tone="slate">{SERVICE_ARRAY_TYPE_LABELS[a.type]}</Badge>
                      <span className="flex items-center gap-1">
                        <MapPinned className="h-3 w-3" /> {branchName(a.branch_id)}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => openEdit(a)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      title="עריכת מערך"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(a.id)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                      title="מחיקת מערך"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* The three numbers that decide whether this מערך is bookable. */}
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 text-center">
                  <div>
                    <p className="text-lg font-bold leading-none text-slate-900">{members.length}</p>
                    <p className="mt-1 text-[11px] text-slate-500">עמדות</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold leading-none text-slate-900">{stations}</p>
                    <p className="mt-1 text-[11px] text-slate-500">קיבולת במקביל</p>
                  </div>
                  <div>
                    <p
                      className={
                        "text-lg font-bold leading-none " +
                        (members.length > 0 && scheduled === members.length ? "text-success-text" : "text-warning-text")
                      }
                    >
                      {scheduled}/{members.length}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">עם לו״ז</p>
                  </div>
                </div>

                {members.length === 0 ? (
                  <p className="flex items-center gap-1.5 rounded-lg border border-dashed border-warning-border bg-warning-bg/60 px-2.5 py-2 text-[11px] text-warning-text">
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                    אין עדיין עמדות במערך — הוא לא ניתן להזמנה.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {equipment.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700"
                      >
                        <MonitorCog className="h-3 w-3 text-slate-400" />
                        {m.name}
                        {(m.capacity ?? 1) > 1 && <span className="text-slate-400">×{m.capacity}</span>}
                      </span>
                    ))}
                    {staff.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1 rounded-full border border-info-border bg-info-bg px-2 py-0.5 text-[11px] text-info-text"
                      >
                        <Stethoscope className="h-3 w-3" />
                        {m.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                  <button
                    type="button"
                    onClick={() => openAddStation(a)}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-primary hover:bg-primary/5"
                  >
                    <Plus className="h-3.5 w-3.5" /> הוספת עמדה
                  </button>
                  <Link
                    href="/provider/profile/availability"
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-primary hover:underline"
                  >
                    <CalendarClock className="h-3.5 w-3.5" /> לוחות הזמנים
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "עריכת מערך" : "מערך חדש"}
        description={editing ? undefined : "מערך = קו שירות בתוך סניף, נבחר מקטלוג מוגדר מראש."}
      >
        <div className="flex flex-col gap-3">
          <Select label="סניף" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select label="סוג המערך" value={type} onChange={(e) => setType(e.target.value as ServiceArrayType)}>
            {SERVICE_ARRAY_TYPES.map((t) => (
              <option key={t} value={t}>
                {SERVICE_ARRAY_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <Input
            label="שם תצוגה (לא חובה)"
            placeholder={SERVICE_ARRAY_TYPE_LABELS[type]}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button onClick={save} disabled={!branchId}>
            {editing ? "שמור" : "הוסף מערך"}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={!!stationFor}
        onClose={() => setStationFor(null)}
        title={`עמדה חדשה ב${stationFor?.name ?? ""}`}
        description="עמדה = יחידת תזמון אחת: ציוד או חדר עם תור ולו״ז משלו. את נותני השירות מוסיפים בלשונית ‚נותני שירות‘."
      >
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="שם העמדה"
              placeholder="MRI 1"
              value={stationName}
              onChange={(e) => setStationName(e.target.value)}
              required
            />
            <Select
              label="סוג"
              value={stationKind}
              onChange={(e) => setStationKind(e.target.value as FacilityKind)}
            >
              {FACILITY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {FACILITY_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
            <Input
              label="דגם (לא חובה)"
              placeholder="Siemens Magnetom Vida 3T"
              value={stationModel}
              onChange={(e) => setStationModel(e.target.value)}
            />
            <Input
              label="חדר / מיקום (לא חובה)"
              placeholder="חדר 4, קומה -1"
              value={stationRoom}
              onChange={(e) => setStationRoom(e.target.value)}
            />
          </div>
          <Input
            label="כמה מכשירים זהים העמדה מייצגת?"
            type="number"
            min={1}
            value={stationCapacity}
            onChange={(e) => setStationCapacity(Number(e.target.value) || 1)}
          />
          <p className="text-xs leading-relaxed text-slate-500">
            עמדה שמייצגת יותר ממכשיר אחד מחזיקה לו״ז אחד אבל מאפשרת מספר תורים במקביל באותה שעה.
          </p>
          <Button onClick={saveStation} disabled={!stationName.trim()}>
            הוסף עמדה
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="מחיקת מערך"
        description="המערך יימחק, והעמדות ששויכו אליו יחזרו ל'ללא מערך' (ולא יהיו ניתנות להזמנה עד ששויכו מחדש)."
        destructive
        confirmLabel="מחק מערך"
        onConfirm={() => {
          if (deleteId) {
            deleteServiceArray(deleteId);
            showToast("המערך נמחק", { variant: "success" });
          }
          setDeleteId(null);
        }}
      />
    </div>
  );
}

export type { OrganizationBranch };
