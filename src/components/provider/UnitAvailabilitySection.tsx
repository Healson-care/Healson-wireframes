"use client";

import { ReactNode, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/Misc";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { ScheduleEditor } from "@/components/provider/AvailabilitySection";
import { DAY_LABELS } from "@/lib/medical-tree";
import { DAY_KEYS, formatShift, getWeeklySchedule, hasAnyAvailability } from "@/lib/schedule";
import { UnitResource, buildUnitOverview, getUnitResources } from "@/lib/unit-resources";
import { AffiliatedDoctor, ConsultationType, ProviderFacility, ProviderProfile } from "@/types";
import {
  AlertCircle,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  Layers,
  MonitorCog,
  Stethoscope,
} from "lucide-react";

/** Availability for a medical unit (§PRV-08) — the unified מערכים → לוזים view.
 *
 * A unit doesn't have one calendar. Its bookable resources — מכשירים and נותני
 * שירות — are its לוזים, each with its own week (a "לוז" IS a schedule). Here
 * they're grouped by מערך (service line), and each לוז expands to edit its week.
 * The "תמונת מצב" tab is the combined read-only picture across the whole unit. */
export function UnitAvailabilitySection({
  provider,
  onChange,
}: {
  provider: ProviderProfile;
  onChange: (data: Partial<ProviderProfile>) => void;
}) {
  const providers = useStore((s) => s.providers);

  const doctorInfo = useMemo(
    () =>
      new Map(
        providers.map((p) => [p.id, { name: `${p.title ?? ""} ${p.display_name}`.trim(), specialty: p.specialty }])
      ),
    [providers]
  );

  const resources = useMemo(() => getUnitResources(provider, doctorInfo), [provider, doctorInfo]);
  const overview = useMemo(() => buildUnitOverview(provider, resources), [provider, resources]);

  const facilities = provider.facilities ?? [];
  const affiliations = provider.affiliated_doctors ?? [];
  const services = provider.consultation_types;

  return (
    <Tabs defaultValue="arrays" className="flex flex-col gap-4">
      <TabsList>
        <TabsTrigger value="arrays" icon={<Layers className="h-4 w-4" />}>
          מערכים ולוזים
        </TabsTrigger>
        <TabsTrigger value="general" icon={<CalendarClock className="h-4 w-4" />}>
          תמונת מצב
        </TabsTrigger>
      </TabsList>

      <TabsContent value="arrays">
        <ArraysView
          resources={resources}
          facilities={facilities}
          affiliations={affiliations}
          services={services}
          doctorInfo={doctorInfo}
          onChange={onChange}
        />
      </TabsContent>

      <TabsContent value="general">
        <GeneralAvailability provider={provider} overview={overview} onChange={onChange} />
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// מערכים → לוזים — the merged, expandable view
// ---------------------------------------------------------------------------

interface LozItem {
  id: string;
  resource?: UnitResource;
  kind: "facility" | "doctor";
  capacity: number;
  editor: () => ReactNode;
}

function ArraysView({
  resources,
  facilities,
  affiliations,
  services,
  doctorInfo,
  onChange,
}: {
  resources: UnitResource[];
  facilities: ProviderFacility[];
  affiliations: AffiliatedDoctor[];
  services: ConsultationType[];
  doctorInfo: Map<string, { name: string; specialty?: string }>;
  onChange: (data: Partial<ProviderProfile>) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const items: LozItem[] = [
    ...facilities.map((f) => ({
      id: f.id,
      resource: resources.find((r) => r.id === f.id),
      kind: "facility" as const,
      capacity: Math.max(1, f.capacity ?? 1),
      editor: () => (
        <ScheduleEditor
          holder={f}
          title={f.name}
          subtitle={resources.find((r) => r.id === f.id)?.subtitle}
          emptyLabel="ללוז אין עדיין לוח זמנים"
          serviceScopeLabel="כל הפריטים של הלוז"
          services={services.filter((s) => f.service_ids.includes(s.id))}
          onChange={(next) => onChange({ facilities: facilities.map((x) => (x.id === next.id ? next : x)) })}
        />
      ),
    })),
    ...affiliations.map((a) => {
      const info = doctorInfo.get(a.doctor_provider_id);
      return {
        id: a.id,
        resource: resources.find((r) => r.id === a.id),
        kind: "doctor" as const,
        capacity: 1,
        editor: () => (
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
        ),
      };
    }),
  ];

  // Group the לוזים by מערך (service line).
  const groups: [string, LozItem[]][] = [];
  items.forEach((it) => {
    const key = it.resource?.service_array?.trim() || "ללא מערך";
    const bucket = groups.find(([name]) => name === key);
    if (bucket) bucket[1].push(it);
    else groups.push([key, [it]]);
  });

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="h-10 w-10" />}
        title="לא הוגדרו לוזים"
        description="הגדירו מכשירים ונותני שירות — ולכל אחד לו״ז משלו. הם יופיעו כאן מקובצים למערכים (קווי שירות)."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* In-app explainer of the מערך → לוז model */}
      <div className="flex items-start gap-2 rounded-lg border border-info-border bg-info-bg px-3 py-2.5 text-xs leading-relaxed text-info-text">
        <Layers className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <b>מערך</b> = קטגוריית שירות (MRI, ייעוצים, בדיקות). בכל מערך יש <b>לוזים</b> — כל לוז הוא עמדה עם לו״ז
          משלה: מכשיר או נותן שירות יחיד. לוז אחד יכול לייצג כמה מכשירים זהים. לחצו על לוז כדי לערוך את הלו״ז שלו.
        </span>
      </div>

      {groups.map(([arrayName, its]) => {
        const machines = its.reduce((sum, it) => sum + it.capacity, 0);
        return (
          <div key={arrayName} className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <Layers className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-slate-900">{arrayName}</p>
              <Badge tone="purple">{its.length} לוזים</Badge>
              {machines > its.length && (
                <span className="text-xs text-slate-400">· {machines} מכשירים בפועל</span>
              )}
            </div>
            <div className="divide-y divide-slate-100">
              {its.map((it) => {
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
                          {it.kind === "doctor" ? "נותן שירות" : "מכשיר"}
                        </Badge>
                        {it.capacity > 1 && <Badge tone="green">מייצג {it.capacity} מכשירים</Badge>}
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
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// "תמונת מצב" — the whole unit at a glance
// ---------------------------------------------------------------------------

function GeneralAvailability({
  provider,
  overview,
  onChange,
}: {
  provider: ProviderProfile;
  overview: ReturnType<typeof buildUnitOverview>;
  onChange: (data: Partial<ProviderProfile>) => void;
}) {
  // A unit has exactly one location record — the unit IS the site.
  const unit = provider.clinic_locations[0];
  const allResources = [...overview.facilities, ...overview.doctors];

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-900">תמונת מצב — כל היחידה</p>
              <p className="text-xs text-slate-500">
                {overview.facilities.length} מכשירים · {overview.doctors.length} נותני שירות ·{" "}
                {overview.activeDays} ימי פעילות בשבוע · {overview.totalWeeklyHours.toFixed(1)} שעות משאב נטו
              </p>
            </div>
          </div>
          {allResources.length === 0 && <Badge tone="warning">לא הוגדרו לוזים</Badge>}
        </div>

        {/* How many resources are open on each weekday. */}
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {DAY_KEYS.map((day) => {
            const open = overview.openResourcesByDay[day] ?? 0;
            return (
              <div
                key={day}
                className={cn(
                  "rounded-lg border px-1 py-2 text-center",
                  open > 0 ? "border-success-border bg-success-bg" : "border-slate-200 bg-slate-50"
                )}
              >
                <p className={cn("text-[11px] font-medium", open > 0 ? "text-success-text" : "text-slate-400")}>
                  {DAY_LABELS[day]}
                </p>
                <p className={cn("text-sm font-semibold", open > 0 ? "text-success-text" : "text-slate-300")}>
                  {open}
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">מספר הלוזים (מכשירים + נותני שירות) הפעילים בכל יום.</p>
      </Card>

      {/* Warnings — the two ways a unit's schedule ends up not bookable. */}
      {overview.resourcesWithoutAvailability.length > 0 && (
        <WarningRow>
          {overview.resourcesWithoutAvailability.length} לוזים ללא לוח זמנים:{" "}
          {overview.resourcesWithoutAvailability.map((r) => r.name).join(", ")}. עד שיוגדר להם לוח זמנים לא ייווצרו
          תורים.
        </WarningRow>
      )}
      {overview.servicesWithoutResource.length > 0 && (
        <WarningRow>
          {overview.servicesWithoutResource.length} פריטים אינם מקושרים ללוז:{" "}
          {overview.servicesWithoutResource
            .slice(0, 4)
            .map((s) => s.name)
            .join(", ")}
          {overview.servicesWithoutResource.length > 4 ? " ועוד" : ""}. הם ייבנו לפי שעות הפעילות הכלליות של
          היחידה עד שישויכו ללוז.
        </WarningRow>
      )}

      {/* Every resource's week, read-only — editing happens in the מערכים tab. */}
      {allResources.length > 0 && (
        <Card className="p-4">
          <p className="mb-3 text-sm font-medium text-slate-800">השבוע של כל לוז</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-xs">
              <thead>
                <tr className="text-slate-500">
                  <th className="p-2 text-right font-medium">לוז</th>
                  {DAY_KEYS.map((d) => (
                    <th key={d} className="p-2 text-center font-medium">
                      {DAY_LABELS[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allResources.map(({ resource }) => (
                  <ResourceWeekRow key={resource.id} resource={resource} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* The unit's own opening hours — the fallback calendar. */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-800">
          <CalendarClock className="h-4 w-4 text-slate-400" /> שעות הפעילות של היחידה
        </p>
        <p className="mb-3 text-xs text-slate-500">
          שעות הפתיחה של היחידה כולה — מוצגות למטופלים, ומשמשות כברירת מחדל לפריטים שעדיין לא שויכו ללוז. הן
          אינן מגבילות את לוחות הזמנים של הלוזים.
        </p>
        {unit ? (
          <ScheduleEditor
            holder={unit}
            title={unit.name}
            subtitle="שעות פעילות היחידה"
            emptyLabel="לא הוגדרו שעות פעילות"
            services={provider.consultation_types}
            onChange={(next) => onChange({ clinic_locations: [next, ...provider.clinic_locations.slice(1)] })}
          />
        ) : (
          <EmptyState
            icon={<CalendarClock className="h-10 w-10" />}
            title="טרם הוגדרו פרטי היחידה"
            description='השלימו את כתובת היחידה בלשונית "פרטי היחידה" כדי להגדיר שעות פעילות.'
          />
        )}
      </div>
    </div>
  );
}

function ResourceWeekRow({ resource }: { resource: UnitResource }) {
  const schedule = getWeeklySchedule(resource);
  return (
    <tr className="border-t border-slate-100">
      <td className="p-2 align-top">
        <p className="font-medium text-slate-800">{resource.name}</p>
        <p className="text-[10px] text-slate-400">
          {resource.kind === "facility" ? "מכשיר" : "נותן/ת שירות"}
          {resource.service_array ? ` · ${resource.service_array}` : ""}
          {resource.service_ids.length > 0 ? ` · ${resource.service_ids.length} פריטים` : ""}
        </p>
      </td>
      {DAY_KEYS.map((day) => {
        const shifts = schedule[day] ?? [];
        return (
          <td key={day} className="p-1.5 text-center align-top">
            {shifts.length === 0 ? (
              <span className="text-slate-300">—</span>
            ) : (
              <div className="flex flex-col gap-0.5">
                {shifts.map((s) => (
                  <span
                    key={s.id}
                    dir="ltr"
                    className="rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary"
                  >
                    {formatShift(s)}
                  </span>
                ))}
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
}

function WarningRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning-text">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
