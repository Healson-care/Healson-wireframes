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
import {
  UnitResource,
  buildUnitOverview,
  getUnitResources,
} from "@/lib/unit-resources";
import { AffiliatedDoctor, ProviderFacility, ProviderProfile } from "@/types";
import { AlertCircle, CalendarClock, Layers, MonitorCog, Stethoscope } from "lucide-react";

/** Availability for a medical unit (§PRV-08).
 *
 * A unit doesn't have one calendar — it has one per resource. So the week is
 * edited per מתקן and per רופא/ה, and the unit-level tab ("זמינות כללית") is
 * the combined picture: the unit's opening hours plus every resource's week
 * side by side.
 *
 * NOTE (open product decision): the general hours are DISPLAY + FALLBACK. They
 * do not clip a resource's hours, and a service linked to no resource still
 * falls back to them. If Healson later decides the unit's hours should bound
 * everything, the change is one intersection in src/lib/unit-resources.ts. */
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

  function updateFacility(next: ProviderFacility) {
    onChange({ facilities: facilities.map((f) => (f.id === next.id ? next : f)) });
  }

  function updateAffiliation(next: AffiliatedDoctor) {
    onChange({ affiliated_doctors: affiliations.map((a) => (a.id === next.id ? next : a)) });
  }

  return (
    <Tabs defaultValue="general" className="flex flex-col gap-4">
      <TabsList>
        <TabsTrigger value="general" icon={<Layers className="h-4 w-4" />}>
          זמינות כללית
        </TabsTrigger>
        <TabsTrigger value="facilities" icon={<MonitorCog className="h-4 w-4" />}>
          חדרים ({facilities.length})
        </TabsTrigger>
        <TabsTrigger value="doctors" icon={<Stethoscope className="h-4 w-4" />}>
          נותני שירות ({affiliations.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <GeneralAvailability provider={provider} overview={overview} onChange={onChange} />
      </TabsContent>

      <TabsContent value="facilities">
        <ResourcePicker
          emptyTitle="לא הוגדרו חדרים"
          emptyDescription='הוסיפו חדרים בלשונית "חדרים" — לכל מכשיר או חדר לוח זמנים משלו, והפריטים המבוצעים בו מקושרים אליו.'
          items={facilities.map((f) => ({
            id: f.id,
            label: f.name,
            hasAvailability: hasAnyAvailability(f),
            render: () => (
              <ScheduleEditor
                key={f.id}
                holder={f}
                title={f.name}
                subtitle={resources.find((r) => r.id === f.id)?.subtitle}
                emptyLabel="לחדר אין עדיין לוח זמנים"
                serviceScopeLabel="כל הפריטים של החדר"
                services={services.filter((s) => f.service_ids.includes(s.id))}
                onChange={updateFacility}
              />
            ),
          }))}
        />
      </TabsContent>

      <TabsContent value="doctors">
        <ResourcePicker
          emptyTitle="לא שויכו נותני שירות"
          emptyDescription='הוסיפו נותני שירות בלשונית "נותני שירות" — לכל נותן/ת שירות לוח זמנים משלו/ה ביחידה, והפריטים שהוא/היא מבצע/ת מקושרים אליו/ה.'
          items={affiliations.map((a) => {
            const info = doctorInfo.get(a.doctor_provider_id);
            return {
              id: a.id,
              label: info?.name ?? "נותן/ת שירות",
              hasAvailability: hasAnyAvailability(a),
              render: () => (
                <ScheduleEditor
                  key={a.id}
                  holder={a}
                  title={info?.name ?? "נותן/ת שירות"}
                  subtitle={[a.role, info?.specialty].filter(Boolean).join(" · ") || undefined}
                  emptyLabel="לנותן/ת השירות אין עדיין לוח זמנים ביחידה"
                  serviceScopeLabel="כל הפריטים של נותן/ת השירות"
                  services={services.filter((s) => a.service_ids.includes(s.id))}
                  onChange={updateAffiliation}
                />
              ),
            };
          })}
        />
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// "זמינות כללית" — the whole unit at a glance
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
                {overview.facilities.length} חדרים · {overview.doctors.length} נותני שירות ·{" "}
                {overview.activeDays} ימי פעילות בשבוע · {overview.totalWeeklyHours.toFixed(1)} שעות משאב נטו
              </p>
            </div>
          </div>
          {allResources.length === 0 && <Badge tone="warning">לא הוגדרו משאבים</Badge>}
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
        <p className="mt-2 text-[11px] text-slate-400">מספר המשאבים (חדרים + נותני שירות) הפעילים בכל יום.</p>
      </Card>

      {/* Warnings — the two ways a unit's schedule ends up not bookable. */}
      {overview.resourcesWithoutAvailability.length > 0 && (
        <WarningRow>
          {overview.resourcesWithoutAvailability.length} משאבים ללא לוח זמנים:{" "}
          {overview.resourcesWithoutAvailability.map((r) => r.name).join(", ")}. עד שיוגדר להם לוח זמנים לא ייווצרו
          תורים.
        </WarningRow>
      )}
      {overview.servicesWithoutResource.length > 0 && (
        <WarningRow>
          {overview.servicesWithoutResource.length} פריטים אינם מקושרים לחדר או לנותן/ת שירות:{" "}
          {overview.servicesWithoutResource
            .slice(0, 4)
            .map((s) => s.name)
            .join(", ")}
          {overview.servicesWithoutResource.length > 4 ? " ועוד" : ""}. הם ייבנו לפי שעות הפעילות הכלליות של
          היחידה עד שישויכו למשאב.
        </WarningRow>
      )}

      {/* Every resource's week, read-only — editing happens in its own tab. */}
      {allResources.length > 0 && (
        <Card className="p-4">
          <p className="mb-3 text-sm font-medium text-slate-800">השבוע של כל משאב</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-xs">
              <thead>
                <tr className="text-slate-500">
                  <th className="p-2 text-right font-medium">משאב</th>
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
          שעות הפתיחה של היחידה כולה — מוצגות למטופלים, ומשמשות כברירת מחדל לפריטים שעדיין לא שויכו לחדר או
          לנותן/ת שירות. הן אינן מגבילות את לוחות הזמנים של המשאבים.
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
          {resource.kind === "facility" ? "חדר" : "נותן/ת שירות"}
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

// ---------------------------------------------------------------------------
// Resource switcher — pills over one schedule editor
// ---------------------------------------------------------------------------

function ResourcePicker({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: { id: string; label: string; hasAvailability: boolean; render: () => ReactNode }[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((i) => i.id === selectedId) ?? items[0];

  if (items.length === 0) {
    return <EmptyState icon={<CalendarClock className="h-10 w-10" />} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const isActive = item.id === selected?.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              {item.label}
              {!item.hasAvailability && <span className="h-1.5 w-1.5 rounded-full bg-warning-border" />}
            </button>
          );
        })}
      </div>
      {selected?.render()}
    </div>
  );
}
