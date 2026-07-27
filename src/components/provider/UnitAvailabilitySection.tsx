"use client";

import { ReactNode, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/Misc";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { ScheduleEditor } from "@/components/provider/AvailabilitySection";
import { DAY_LABELS } from "@/lib/medical-tree";
import {
  DAY_KEYS,
  formatShift,
  getWeeklySchedule,
  hasAnyAvailability,
  totalWeeklyHours,
} from "@/lib/schedule";
import { UnitResource, getUnitResources } from "@/lib/unit-resources";
import { UnitScheduleCalendar } from "@/components/provider/schedule/UnitScheduleCalendar";
import {
  AffiliatedDoctor,
  ConsultationType,
  OrganizationBranch,
  ProviderFacility,
  ProviderProfile,
  ResourceSchedule,
  ServiceArray,
  emptyWeeklySchedule,
} from "@/types";
import {
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  CopyPlus,
  Layers,
  Link2,
  MapPinned,
  MonitorCog,
  Plus,
  Stethoscope,
  Trash2,
} from "lucide-react";

/** Availability for a medical unit (§PRV-08) — the unified מערכים → עמדות view.
 *
 * A unit doesn't have one calendar. Its bookable resources — עמדות ציוד and נותני
 * שירות — are its עמדות, each with its own week (a "עמדה" IS a schedule). Here
 * they're grouped by מערך (service line), and each עמדה expands to edit its week.
 * The "תמונת מצב" tab is the combined read-only picture across the whole unit. */
export function UnitAvailabilitySection({
  provider,
  onChange,
}: {
  provider: ProviderProfile;
  onChange: (data: Partial<ProviderProfile>) => void;
}) {
  const providers = useStore((s) => s.providers);
  const organizationBranches = useStore((s) => s.organizationBranches);
  const serviceArrays = useStore((s) => s.serviceArrays);
  const appointments = useStore((s) => s.appointments);

  const doctorInfo = useMemo(
    () =>
      new Map(
        providers.map((p) => [p.id, { name: `${p.title ?? ""} ${p.display_name}`.trim(), specialty: p.specialty }])
      ),
    [providers]
  );

  // This unit's branches and the מערכים defined in them (§PRV-08 hierarchy).
  const unitBranches = useMemo(
    () => organizationBranches.filter((b) => b.unit_id === provider.id),
    [organizationBranches, provider.id]
  );
  const unitArrays = useMemo(() => {
    const branchIds = new Set(unitBranches.map((b) => b.id));
    return serviceArrays.filter((a) => branchIds.has(a.branch_id));
  }, [serviceArrays, unitBranches]);

  const resources = useMemo(
    () => getUnitResources(provider, doctorInfo, unitArrays),
    [provider, doctorInfo, unitArrays]
  );

  const facilities = provider.facilities ?? [];
  const affiliations = provider.affiliated_doctors ?? [];
  const services = provider.consultation_types;
  const sharedSchedules = provider.resource_schedules ?? [];

  return (
    <Tabs defaultValue="calendar" className="flex flex-col gap-4">
      <TabsList>
        {/* The calendar leads: "when are we open and where are the holes" is
            the question a unit opens this screen with. Editing a specific
            לו״ז is the follow-up, not the entry point. */}
        <TabsTrigger value="calendar" icon={<CalendarDays className="h-4 w-4" />}>
          יומן
        </TabsTrigger>
        <TabsTrigger value="arrays" icon={<Layers className="h-4 w-4" />}>
          מערכים ועמדות
        </TabsTrigger>
        <TabsTrigger value="shared" icon={<CopyPlus className="h-4 w-4" />}>
          לו״זים משותפים
        </TabsTrigger>
      </TabsList>

      <TabsContent value="calendar">
        <UnitScheduleCalendar
          provider={provider}
          resources={resources}
          unitArrays={unitArrays}
          unitBranches={unitBranches}
          appointments={appointments.filter((a) => a.provider_id === provider.id)}
          onChange={onChange}
        />
      </TabsContent>

      <TabsContent value="arrays">
        <ArraysView
          unitId={provider.id}
          resources={resources}
          facilities={facilities}
          affiliations={affiliations}
          services={services}
          sharedSchedules={sharedSchedules}
          unitArrays={unitArrays}
          unitBranches={unitBranches}
          doctorInfo={doctorInfo}
          onChange={onChange}
        />
      </TabsContent>

      <TabsContent value="shared">
        <SharedSchedulesView unitId={provider.id} resources={resources} services={services} sharedSchedules={sharedSchedules} />
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// מערכים → עמדות — the merged, expandable view
// ---------------------------------------------------------------------------

interface LozItem {
  id: string;
  resource?: UnitResource;
  kind: "facility" | "doctor";
  capacity: number;
  /** The shared לו״ז this resource follows, if any. */
  scheduleId?: string;
  editor: () => ReactNode;
}

function ArraysView({
  unitId,
  resources,
  facilities,
  affiliations,
  services,
  sharedSchedules,
  unitArrays,
  unitBranches,
  doctorInfo,
  onChange,
}: {
  unitId: string;
  resources: UnitResource[];
  facilities: ProviderFacility[];
  affiliations: AffiliatedDoctor[];
  services: ConsultationType[];
  sharedSchedules: ResourceSchedule[];
  unitArrays: ServiceArray[];
  unitBranches: OrganizationBranch[];
  doctorInfo: Map<string, { name: string; specialty?: string }>;
  onChange: (data: Partial<ProviderProfile>) => void;
}) {
  const applyResourceSchedule = useStore((s) => s.applyResourceSchedule);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // The "מקור לו״ז" control shown at the top of every expanded resource: pick an
  // independent (inline) לו״ז or attach the resource to a shared one.
  const sourcePicker = (kind: "facility" | "doctor", id: string, scheduleId?: string): ReactNode => (
    <ScheduleSourcePicker
      sharedSchedules={sharedSchedules}
      value={scheduleId}
      onChange={(nextId) =>
        applyResourceSchedule(
          unitId,
          nextId,
          kind === "facility" ? { facilityIds: [id] } : { doctorAffiliationIds: [id] }
        )
      }
    />
  );

  // The "מערך" control: assign a resource to a first-class מערך (which also
  // places it in that מערך's branch). Sets service_array_id on the resource.
  const arrayPicker = (kind: "facility" | "doctor", id: string, arrayId?: string): ReactNode => (
    <ArrayPicker
      arrays={unitArrays}
      branches={unitBranches}
      value={arrayId}
      onChange={(nextId) => {
        if (kind === "facility") {
          onChange({
            facilities: facilities.map((x) =>
              x.id === id ? { ...x, service_array_id: nextId ?? undefined } : x
            ),
          });
        } else {
          onChange({
            affiliated_doctors: affiliations.map((x) =>
              x.id === id ? { ...x, service_array_id: nextId ?? undefined } : x
            ),
          });
        }
      }}
    />
  );

  // The read-only preview shown instead of the editor when a resource follows a
  // shared לו״ז — its hours are edited once, in the "לו״זים משותפים" tab.
  const sharedPreview = (resource: UnitResource | undefined, scheduleId: string): ReactNode => {
    const shared = sharedSchedules.find((s) => s.id === scheduleId);
    return (
      <div className="rounded-lg border border-info-border bg-info-bg/50 p-3 text-xs text-info-text">
        <p className="flex items-center gap-1.5 font-medium">
          <Link2 className="h-3.5 w-3.5" /> עוקב אחרי הלו״ז המשותף {shared ? `"${shared.name}"` : ""}
        </p>
        <p className="mt-1 text-slate-500">
          עריכת השעות מתבצעת פעם אחת בלשונית &quot;לו״זים משותפים&quot;; שינוי שם משפיע על כל המשאבים החולקים אותו. כאן ניתן רק
          לבחור מקור לו״ז אחר.
        </p>
        {resource && <div className="mt-2">{<WeekStrip resource={resource} />}</div>}
      </div>
    );
  };

  const items: LozItem[] = [
    ...facilities.map((f) => ({
      id: f.id,
      resource: resources.find((r) => r.id === f.id),
      kind: "facility" as const,
      capacity: Math.max(1, f.capacity ?? 1),
      scheduleId: f.schedule_id,
      editor: () => (
        <div className="flex flex-col gap-3">
          {arrayPicker("facility", f.id, f.service_array_id)}
          {sourcePicker("facility", f.id, f.schedule_id)}
          {f.schedule_id ? (
            sharedPreview(resources.find((r) => r.id === f.id), f.schedule_id)
          ) : (
            <ScheduleEditor
              holder={f}
              title={f.name}
              subtitle={resources.find((r) => r.id === f.id)?.subtitle}
              emptyLabel="לעמדה אין עדיין לוח זמנים"
              serviceScopeLabel="כל הפריטים של העמדה"
              services={services.filter((s) => f.service_ids.includes(s.id))}
              onChange={(next) => onChange({ facilities: facilities.map((x) => (x.id === next.id ? next : x)) })}
            />
          )}
        </div>
      ),
    })),
    ...affiliations.map((a) => {
      const info = doctorInfo.get(a.doctor_provider_id);
      return {
        id: a.id,
        resource: resources.find((r) => r.id === a.id),
        kind: "doctor" as const,
        capacity: 1,
        scheduleId: a.schedule_id,
        editor: () => (
          <div className="flex flex-col gap-3">
            {arrayPicker("doctor", a.id, a.service_array_id)}
            {sourcePicker("doctor", a.id, a.schedule_id)}
            {a.schedule_id ? (
              sharedPreview(resources.find((r) => r.id === a.id), a.schedule_id)
            ) : (
              <ScheduleEditor
                holder={a}
                title={info?.name ?? "נותן/ת שירות"}
                subtitle={[a.role, info?.specialty].filter(Boolean).join(" · ") || undefined}
                emptyLabel="אין עדיין לוח זמנים"
                serviceScopeLabel="כל הפריטים של נותן/ת השירות"
                services={services.filter((s) => a.service_ids.includes(s.id))}
                onChange={(next) =>
                  onChange({ affiliated_doctors: affiliations.map((x) => (x.id === next.id ? next : x)) })
                }
              />
            )}
          </div>
        ),
      };
    }),
  ];

  // Nest the עמדות by the unit's real structure: סניף → מערך → עמדות.
  type ArrayGroup = { key: string; name: string; items: LozItem[] };
  type BranchGroup = { branchId: string; branchName: string; arrays: ArrayGroup[] };
  const branchGroups: BranchGroup[] = [];
  items.forEach((it) => {
    const res = it.resource;
    const branchId = res?.branch_id || "__none__";
    const branchName = unitBranches.find((b) => b.id === branchId)?.name || "ללא סניף";
    // Key by service_array_id so two same-named מערכים in different branches stay
    // distinct; fall back to the (legacy) name string, then "ללא מערך".
    const arrayKey = res?.service_array_id || res?.service_array?.trim() || "__noarray__";
    const arrayName = res?.service_array?.trim() || "ללא מערך";
    let bg = branchGroups.find((g) => g.branchId === branchId);
    if (!bg) {
      bg = { branchId, branchName, arrays: [] };
      branchGroups.push(bg);
    }
    let ag = bg.arrays.find((a) => a.key === arrayKey);
    if (!ag) {
      ag = { key: arrayKey, name: arrayName, items: [] };
      bg.arrays.push(ag);
    }
    ag.items.push(it);
  });

  const renderRow = (it: LozItem) => {
    const res = it.resource;
    const open = expanded.has(it.id);
    const avail = res ? hasAnyAvailability(res) : false;
    return (
      <div key={it.id} className="px-3 py-2.5">
        <button
          type="button"
          onClick={() => toggle(it.id)}
          className="flex w-full items-center justify-between gap-2 text-right"
        >
          <span className="flex flex-wrap items-center gap-1.5">
            {it.kind === "facility" ? (
              <MonitorCog className="h-4 w-4 shrink-0 text-slate-400" />
            ) : (
              <Stethoscope className="h-4 w-4 shrink-0 text-info-text" />
            )}
            <span className="font-medium text-slate-900">{res?.name}</span>
            <Badge tone={it.kind === "doctor" ? "blue" : "slate"}>
              {it.kind === "doctor" ? "נותן שירות" : "ציוד"}
            </Badge>
            {it.capacity > 1 && <Badge tone="green">מייצג {it.capacity} מכשירים</Badge>}
            {it.scheduleId && (
              <Badge tone="blue">
                לו״ז משותף
                {(() => {
                  const s = sharedSchedules.find((x) => x.id === it.scheduleId);
                  return s ? `: ${s.name}` : "";
                })()}
              </Badge>
            )}
            {!avail && <Badge tone="warning">ללא לו״ז</Badge>}
          </span>
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400" />
          )}
        </button>
        {open && <div className="mt-3">{it.editor()}</div>}
      </div>
    );
  };

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="h-10 w-10" />}
        title="לא הוגדרו עמדות"
        description="הגדירו עמדות — ציוד או נותני שירות — ולכל אחת לו״ז משלה. הן יופיעו כאן מקובצות למערכים (קווי שירות)."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* In-app explainer of the סניף → מערך → עמדה model */}
      <div className="flex items-start gap-2 rounded-lg border border-info-border bg-info-bg px-3 py-2.5 text-xs leading-relaxed text-info-text">
        <Layers className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          המבנה: <b>סניף</b> → <b>מערך</b> (קו שירות: MRI, ייעוצים, בדיקות…) → <b>עמדות</b>. כל עמדה הוא עמדה עם לו״ז
          משלה — פריט ציוד או נותן שירות יחיד (עמדה אחת יכולה לייצג כמה מכשירים זהים). שייכו כל עמדה למערך דרך הבורר שבתוכו;
          סניפים ומערכים מוגדרים במסך ניהול הספק.
        </span>
      </div>

      {branchGroups.map((bg) => (
        <div key={bg.branchId} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 px-0.5">
            <MapPinned className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold text-slate-900">{bg.branchName}</p>
            <span className="text-xs text-slate-400">
              · {bg.arrays.length} מערכים · {bg.arrays.reduce((n, a) => n + a.items.length, 0)} עמדות
            </span>
          </div>

          {bg.arrays.map((ag) => {
            const machines = ag.items.reduce((sum, it) => sum + it.capacity, 0);
            return (
              <div key={ag.key} className="mr-2 overflow-hidden rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                  <Layers className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-slate-900">{ag.name}</p>
                  <Badge tone="purple">{ag.items.length} עמדות</Badge>
                  {machines > ag.items.length && (
                    <span className="text-xs text-slate-400">· {machines} מכשירים בפועל</span>
                  )}
                </div>
                <div className="divide-y divide-slate-100">{ag.items.map(renderRow)}</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared schedules (לו״זים משותפים)
// ---------------------------------------------------------------------------

/** The "מקור לו״ז" control on a resource: independent (inline) or a shared לו״ז. */
function ScheduleSourcePicker({
  sharedSchedules,
  value,
  onChange,
}: {
  sharedSchedules: ResourceSchedule[];
  value?: string;
  onChange: (scheduleId: string | null) => void;
}) {
  return (
    <label className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-medium text-slate-600">מקור לו״ז:</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="focus-ring h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs"
      >
        <option value="">עצמאי (לו״ז ייעודי)</option>
        {sharedSchedules.map((s) => (
          <option key={s.id} value={s.id}>
            לו״ז משותף: {s.name}
          </option>
        ))}
      </select>
      {sharedSchedules.length === 0 && (
        <span className="text-slate-400">אין עדיין לו״זים משותפים — צרו אחד בלשונית &quot;לו״זים משותפים&quot;.</span>
      )}
    </label>
  );
}

/** The "מערך" control on a resource: assign it to a first-class מערך, grouped
 * by branch. Empty = "ללא מערך" (falls back to the unit's general hours). */
function ArrayPicker({
  arrays,
  branches,
  value,
  onChange,
}: {
  arrays: ServiceArray[];
  branches: OrganizationBranch[];
  value?: string;
  onChange: (arrayId: string | null) => void;
}) {
  return (
    <label className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-medium text-slate-600">מערך:</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="focus-ring h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs"
      >
        <option value="">ללא מערך</option>
        {branches.map((b) => {
          const branchArrays = arrays.filter((a) => a.branch_id === b.id);
          if (branchArrays.length === 0) return null;
          return (
            <optgroup key={b.id} label={b.name}>
              {branchArrays.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
      {arrays.length === 0 && (
        <span className="text-slate-400">לא הוגדרו מערכים — מוגדרים בניהול הספק (סניפים ומערכים).</span>
      )}
    </label>
  );
}

/** Compact read-only 7-day preview of a resource's resolved week. */
function WeekStrip({ resource }: { resource: UnitResource }) {
  const schedule = getWeeklySchedule(resource);
  return (
    <div className="grid grid-cols-7 gap-1">
      {DAY_KEYS.map((day) => {
        const shifts = schedule[day] ?? [];
        return (
          <div key={day} className="rounded border border-slate-200 bg-white px-1 py-1 text-center">
            <p className="text-[10px] font-medium text-slate-500">{DAY_LABELS[day]}</p>
            {shifts.length === 0 ? (
              <p className="text-[10px] text-slate-300">—</p>
            ) : (
              shifts.map((s) => (
                <p key={s.id} dir="ltr" className="text-[9px] font-medium text-primary">
                  {formatShift(s)}
                </p>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Create/edit/delete reusable schedules and apply each to a set of resources. */
function SharedSchedulesView({
  unitId,
  resources,
  services,
  sharedSchedules,
}: {
  unitId: string;
  resources: UnitResource[];
  services: ConsultationType[];
  sharedSchedules: ResourceSchedule[];
}) {
  const addResourceSchedule = useStore((s) => s.addResourceSchedule);
  const updateResourceSchedule = useStore((s) => s.updateResourceSchedule);
  const deleteResourceSchedule = useStore((s) => s.deleteResourceSchedule);
  const applyResourceSchedule = useStore((s) => s.applyResourceSchedule);
  const showToast = useStore((s) => s.showToast);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<ResourceSchedule | null>(null);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const create = () => {
    const res = addResourceSchedule(unitId, {
      name: `לו״ז משותף ${sharedSchedules.length + 1}`,
      schedule: emptyWeeklySchedule(),
    });
    if (res.ok && res.scheduleId) {
      const id = res.scheduleId;
      setExpanded((prev) => new Set(prev).add(id));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-lg border border-info-border bg-info-bg px-3 py-2.5 text-xs leading-relaxed text-info-text">
        <CopyPlus className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <b>לו״ז משותף</b> מוגדר פעם אחת ומוחל על כמה משאבים יחד. כל משאב עדיין מנהל תור עצמאי מאחורי הקלעים —
          שיתוף לו״ז פירושו אותן שעות פתיחה, לא אותו תור. עריכת הלו״ז כאן מעדכנת את כל המשאבים החולקים אותו.
        </span>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={create}>
          <Plus className="h-4 w-4" /> לו״ז משותף חדש
        </Button>
      </div>

      {sharedSchedules.length === 0 ? (
        <EmptyState
          icon={<CopyPlus className="h-10 w-10" />}
          title="אין עדיין לו״זים משותפים"
          description="צרו לו״ז משותף כדי להחיל אותו על כמה עמדות בבת אחת."
        />
      ) : (
        sharedSchedules.map((s) => {
          const open = expanded.has(s.id);
          const members = resources.filter((r) => r.schedule_id === s.id);
          const hours = totalWeeklyHours(s);
          const days = DAY_KEYS.filter((d) => (getWeeklySchedule(s)[d] ?? []).length > 0).length;
          return (
            <div key={s.id} className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
                <input
                  defaultValue={s.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== s.name) updateResourceSchedule(unitId, s.id, { name: v });
                  }}
                  aria-label="שם הלו״ז המשותף"
                  className="focus-ring min-w-[10rem] flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-sm font-semibold text-slate-900 hover:border-slate-200 focus:border-slate-300 focus:bg-white"
                />
                <Badge tone="blue">{members.length} משאבים</Badge>
                <span className="text-xs text-slate-400">
                  {days} ימים · {hours.toFixed(1)} שעות
                </span>
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  aria-label={open ? "כווץ" : "הרחב"}
                  className="text-slate-400 hover:text-slate-600"
                >
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(s)}
                  aria-label="מחק לו״ז משותף"
                  className="text-danger hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {open && (
                <div className="flex flex-col gap-4 p-4">
                  <ScheduleEditor
                    holder={s}
                    title={s.name}
                    subtitle="לו״ז משותף"
                    emptyLabel="הלו״ז המשותף עדיין ריק"
                    services={services}
                    onChange={(next) =>
                      updateResourceSchedule(unitId, s.id, {
                        schedule: next.schedule,
                        schedule_exceptions: next.schedule_exceptions,
                      })
                    }
                  />
                  <div>
                    <p className="mb-2 text-xs font-medium text-slate-600">משאבים המשתמשים בלו״ז זה</p>
                    {resources.length === 0 ? (
                      <p className="text-xs text-slate-400">אין עדיין משאבים ביחידה.</p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {resources.map((r) => {
                          const checked = r.schedule_id === s.id;
                          const onOther = !!r.schedule_id && r.schedule_id !== s.id;
                          return (
                            <label key={r.id} className="flex items-center gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  applyResourceSchedule(
                                    unitId,
                                    e.target.checked ? s.id : null,
                                    r.kind === "facility"
                                      ? { facilityIds: [r.id] }
                                      : { doctorAffiliationIds: [r.id] }
                                  )
                                }
                              />
                              {r.kind === "facility" ? (
                                <MonitorCog className="h-3.5 w-3.5 text-slate-400" />
                              ) : (
                                <Stethoscope className="h-3.5 w-3.5 text-info-text" />
                              )}
                              <span>{r.name}</span>
                              {onOther && <span className="text-slate-400">(משויך כעת ללו״ז אחר)</span>}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteResourceSchedule(unitId, pendingDelete.id);
          showToast("הלו״ז המשותף נמחק", {
            description: "המשאבים ששויכו אליו חזרו ללו״ז עצמאי.",
          });
        }}
        title="למחוק את הלו״ז המשותף?"
        description="המשאבים ששויכו אליו יחזרו ללו״ז עצמאי (ללא שעות), עד שיוגדר להם לו״ז מחדש."
        confirmLabel="מחיקה"
        destructive
      />
    </div>
  );
}
