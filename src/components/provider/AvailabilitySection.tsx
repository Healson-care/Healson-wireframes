"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { cn, generateId, formatDateHe } from "@/lib/utils";
import {
  Clinic,
  ConsultationType,
  DEFAULT_SLOT_MINUTES,
  DayKey,
  LOCATION_TYPE_LABELS,
  ScheduleBreak,
  ScheduleException,
  ScheduleShift,
  SLOT_MINUTE_OPTIONS,
  WeeklySchedule,
} from "@/types";
import { DAY_LABELS } from "@/lib/medical-tree";
import {
  DAY_KEYS,
  ScheduleHolder,
  formatShift,
  getWeeklySchedule,
  minutesToTime,
  slotTimesForShift,
  timeToMinutes,
  totalWeeklyHours,
  validateDayShifts,
  withSchedule,
} from "@/lib/schedule";
import {
  CalendarClock,
  CalendarOff,
  CalendarPlus,
  Coffee,
  Copy,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Stethoscope,
  AlertTriangle,
} from "lucide-react";

/** Full availability manager (§PRV-05).
 *
 * Replaces the old "one time range per day" editor with the model real
 * scheduling systems use: any number of shifts per day (split hours), breaks
 * inside a shift, a per-shift slot length, per-shift service scoping, days
 * that are simply not active, and one-off date exceptions (closed, or
 * different hours). Everything is edited per location, because two locations
 * of the same provider legitimately keep different weeks. */
export function AvailabilitySection({
  clinics,
  onChange,
  services = [],
  locationLabelSingular = "מרפאה",
  locationLabelPlural = "מרפאות",
}: {
  clinics: Clinic[];
  onChange: (clinics: Clinic[]) => void;
  /** The provider's own services — a shift can be limited to a subset of them. */
  services?: ConsultationType[];
  locationLabelSingular?: string;
  locationLabelPlural?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = clinics.find((c) => c.id === selectedId) ?? clinics[0];

  if (clinics.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock className="h-10 w-10" />}
        title={`הוסיפו ${locationLabelSingular} כדי להגדיר זמינות`}
        description={`אין עדיין ${locationLabelPlural} — יש להוסיף אחד/ת בלשונית "${locationLabelPlural}" לפני שאפשר לבנות לוח זמנים.`}
      />
    );
  }

  function updateClinic(next: Clinic) {
    onChange(clinics.map((c) => (c.id === next.id ? next : c)));
  }

  return (
    <div className="flex flex-col gap-4">
      {clinics.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {clinics.map((c) => {
            const isActive = c.id === selected?.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <ScheduleEditor
          key={selected.id}
          holder={selected}
          title={selected.name}
          subtitle={LOCATION_TYPE_LABELS[selected.location_type ?? "clinic"]}
          services={services.filter(
            (s) => (s.linked_clinic_ids?.length ?? 0) === 0 || s.linked_clinic_ids!.includes(selected.id)
          )}
          onChange={updateClinic}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One schedule owner's week + exceptions.
//
// Deliberately generic over the owner: a location (Clinic), a unit's מתקן
// (ProviderFacility) and an affiliated doctor all keep a week in the same
// shape, so the same editor drives all three (§PRV-08).
// ---------------------------------------------------------------------------

interface ShiftDraft {
  dayKey: DayKey | null; // null => the draft belongs to a date exception
  exceptionDate?: string;
  shift: ScheduleShift;
  isNew: boolean;
}

export function ScheduleEditor<T extends ScheduleHolder>({
  holder,
  title,
  subtitle,
  services,
  onChange,
  emptyLabel = "לא הוגדרה זמינות",
  serviceScopeLabel,
}: {
  holder: T;
  title: string;
  subtitle?: string;
  /** Services that may be scoped per shift. */
  services: ConsultationType[];
  onChange: (holder: T) => void;
  emptyLabel?: string;
  /** Label of the "every service" checkbox inside the shift dialog — the
   * scope differs per owner ("כל השירותים במיקום זה" / "…של המתקן"). */
  serviceScopeLabel?: string;
}) {
  const clinic = holder;
  const schedule = useMemo(() => getWeeklySchedule(clinic), [clinic]);
  const exceptions = useMemo(
    () => [...(clinic.schedule_exceptions ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
    [clinic]
  );

  const [draft, setDraft] = useState<ShiftDraft | null>(null);
  const [copyFromDay, setCopyFromDay] = useState<DayKey | null>(null);
  const [copyTargets, setCopyTargets] = useState<DayKey[]>([]);
  const [exceptionOpen, setExceptionOpen] = useState(false);
  const [deleteException, setDeleteException] = useState<ScheduleException | null>(null);
  const [error, setError] = useState<string | null>(null);

  const weeklyHours = totalWeeklyHours(clinic);
  const activeDays = DAY_KEYS.filter((d) => (schedule[d] ?? []).length > 0).length;

  function saveSchedule(next: WeeklySchedule) {
    setError(null);
    onChange(withSchedule(clinic, next));
  }

  function saveExceptions(next: ScheduleException[]) {
    onChange({ ...clinic, schedule_exceptions: next });
  }

  function commitDayShifts(dayKey: DayKey, shifts: ScheduleShift[]): boolean {
    const problem = validateDayShifts(shifts);
    if (problem) {
      setError(problem);
      return false;
    }
    saveSchedule({
      ...schedule,
      [dayKey]: [...shifts].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)),
    });
    return true;
  }

  function handleShiftSave(next: ScheduleShift): boolean {
    if (!draft) return false;
    if (draft.dayKey) {
      const existing = schedule[draft.dayKey] ?? [];
      const shifts = draft.isNew
        ? [...existing, next]
        : existing.map((s) => (s.id === next.id ? next : s));
      return commitDayShifts(draft.dayKey, shifts);
    }
    // Exception shift
    const exception = exceptions.find((e) => e.date === draft.exceptionDate);
    if (!exception) return false;
    const existing = exception.shifts ?? [];
    const shifts = draft.isNew ? [...existing, next] : existing.map((s) => (s.id === next.id ? next : s));
    const problem = validateDayShifts(shifts);
    if (problem) {
      setError(problem);
      return false;
    }
    saveExceptions(
      exceptions.map((e) =>
        e.id === exception.id
          ? { ...e, shifts: [...shifts].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)) }
          : e
      )
    );
    return true;
  }

  function removeShift(dayKey: DayKey, shiftId: string) {
    saveSchedule({ ...schedule, [dayKey]: (schedule[dayKey] ?? []).filter((s) => s.id !== shiftId) });
  }

  function removeExceptionShift(exception: ScheduleException, shiftId: string) {
    saveExceptions(
      exceptions.map((e) =>
        e.id === exception.id ? { ...e, shifts: (e.shifts ?? []).filter((s) => s.id !== shiftId) } : e
      )
    );
  }

  function applyCopy() {
    if (!copyFromDay || copyTargets.length === 0) return;
    const source = schedule[copyFromDay] ?? [];
    const next = { ...schedule };
    copyTargets.forEach((d) => {
      next[d] = source.map((s) => ({
        ...s,
        id: generateId("shift"),
        breaks: (s.breaks ?? []).map((b) => ({ ...b, id: generateId("brk") })),
      }));
    });
    saveSchedule(next);
    setCopyFromDay(null);
    setCopyTargets([]);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Week summary. */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">
              {subtitle ? `${subtitle} · ` : ""}
              {activeDays} ימי פעילות בשבוע · {weeklyHours.toFixed(1)} שעות נטו
            </p>
          </div>
        </div>
        {activeDays === 0 && <Badge tone="warning">{emptyLabel}</Badge>}
      </Card>

      {/* While the shift dialog is open the same error is shown inside it —
          the page is behind the modal backdrop. */}
      {error && !draft && (
        <div className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Weekly grid. */}
      <div className="flex flex-col gap-2">
        {DAY_KEYS.map((dayKey) => {
          const shifts = schedule[dayKey] ?? [];
          const isActive = shifts.length > 0;
          return (
            <Card key={dayKey} className={cn("p-3", !isActive && "bg-slate-50/60")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-16 shrink-0 text-sm font-medium text-slate-800">{DAY_LABELS[dayKey]}</span>

                {!isActive ? (
                  <span className="flex-1 text-xs text-slate-400">יום שאינו פעיל</span>
                ) : (
                  <div className="flex flex-1 flex-wrap gap-1.5">
                    {shifts.map((shift) => (
                      <ShiftChip
                        key={shift.id}
                        shift={shift}
                        services={services}
                        onEdit={() => {
                          setError(null);
                          setDraft({ dayKey, shift, isNew: false });
                        }}
                        onRemove={() => removeShift(dayKey, shift.id)}
                      />
                    ))}
                  </div>
                )}

                <div className="flex shrink-0 items-center gap-1">
                  {isActive && (
                    <button
                      type="button"
                      title="העתקה לימים אחרים"
                      onClick={() => {
                        setCopyFromDay(dayKey);
                        setCopyTargets([]);
                      }}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setError(null);
                      setDraft({ dayKey, shift: newShift(shifts), isNew: true });
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" /> משמרת
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Date exceptions. */}
      <Card className="p-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarOff className="h-4 w-4 text-slate-500" />
            <p className="text-sm font-medium text-slate-800">חריגות בלוח הזמנים</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setExceptionOpen(true)}>
            <CalendarPlus className="h-3.5 w-3.5" /> הוספת חריגה
          </Button>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          חריגה גוברת על לוח הזמנים השבועי בתאריך מסוים — סגירה מלאה (חג, חופשה, השתלמות) או שעות שונות מהרגיל.
        </p>

        {exceptions.length === 0 ? (
          <EmptyState title="אין חריגות מוגדרות" />
        ) : (
          <div className="flex flex-col gap-2">
            {exceptions.map((exception) => (
              <div key={exception.id} className="rounded-lg border border-slate-200 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{formatDateHe(exception.date)}</span>
                  {exception.closed ? (
                    <Badge tone="red">סגור</Badge>
                  ) : (
                    <Badge tone="amber">שעות מיוחדות</Badge>
                  )}
                  {exception.reason && <span className="text-xs text-slate-500">{exception.reason}</span>}
                  <div className="ms-auto flex items-center gap-1">
                    {!exception.closed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setError(null);
                          setDraft({
                            dayKey: null,
                            exceptionDate: exception.date,
                            shift: newShift(exception.shifts ?? []),
                            isNew: true,
                          });
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" /> משמרת
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteException(exception)}
                      className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {!exception.closed && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(exception.shifts ?? []).length === 0 ? (
                      <span className="text-xs text-slate-400">לא הוגדרו משמרות — התאריך יתנהג כיום סגור</span>
                    ) : (
                      (exception.shifts ?? []).map((shift) => (
                        <ShiftChip
                          key={shift.id}
                          shift={shift}
                          services={services}
                          onEdit={() => {
                            setError(null);
                            setDraft({
                              dayKey: null,
                              exceptionDate: exception.date,
                              shift,
                              isNew: false,
                            });
                          }}
                          onRemove={() => removeExceptionShift(exception, shift.id)}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <ShiftDialog
        draft={draft}
        services={services}
        serviceScopeLabel={serviceScopeLabel}
        // Validation errors belong inside the dialog: the page-level banner
        // sits behind the modal backdrop, so a rejected save would look like
        // a dead button.
        error={draft ? error : null}
        onClose={() => {
          setDraft(null);
          setError(null);
        }}
        onSave={(shift) => {
          if (handleShiftSave(shift)) setDraft(null);
        }}
      />

      <CopyDayDialog
        fromDay={copyFromDay}
        targets={copyTargets}
        onToggleTarget={(d) =>
          setCopyTargets((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
        }
        onClose={() => {
          setCopyFromDay(null);
          setCopyTargets([]);
        }}
        onApply={applyCopy}
      />

      <ExceptionDialog
        open={exceptionOpen}
        existingDates={exceptions.map((e) => e.date)}
        onClose={() => setExceptionOpen(false)}
        onSave={(exception) => {
          saveExceptions([...exceptions, exception].sort((a, b) => a.date.localeCompare(b.date)));
          setExceptionOpen(false);
        }}
      />

      <ConfirmDialog
        open={!!deleteException}
        onClose={() => setDeleteException(null)}
        title="מחיקת חריגה"
        description={
          deleteException
            ? `התאריך ${formatDateHe(deleteException.date)} יחזור להתנהג לפי לוח הזמנים השבועי.`
            : ""
        }
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteException) saveExceptions(exceptions.filter((e) => e.id !== deleteException.id));
        }}
      />
    </div>
  );
}

const DAY_END_MINUTES = 23 * 60 + 59;

/** A sensible default for a brand-new shift: a standard morning on an empty
 * day, otherwise a slot that starts after the last existing shift ends. It
 * must never overlap what's already there — an overlapping default would make
 * the very first save fail validation. */
function newShift(existing: ScheduleShift[]): ScheduleShift {
  const lastEnd = existing.reduce((max, s) => Math.max(max, timeToMinutes(s.end)), -1);
  const start = lastEnd < 0 ? timeToMinutes("09:00") : Math.min(lastEnd + 60, DAY_END_MINUTES - 30);
  const end = Math.min(start + 4 * 60, DAY_END_MINUTES);
  return {
    id: generateId("shift"),
    start: minutesToTime(Math.max(start, lastEnd)),
    end: minutesToTime(Math.max(end, Math.max(start, lastEnd) + 30)),
    slot_minutes: DEFAULT_SLOT_MINUTES,
    breaks: [],
    service_ids: [],
  };
}

function ShiftChip({
  shift,
  services,
  onEdit,
  onRemove,
}: {
  shift: ScheduleShift;
  services: ConsultationType[];
  onEdit: () => void;
  onRemove: () => void;
}) {
  const slotCount = slotTimesForShift(shift).length;
  const scopedCount = shift.service_ids?.length ?? 0;
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
      <button type="button" onClick={onEdit} className="flex flex-col items-start text-right">
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
          <span dir="ltr">{formatShift(shift)}</span>
          {shift.label && <span className="text-slate-400">· {shift.label}</span>}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
          <span>{slotCount} תורים</span>
          <span>· כל {shift.slot_minutes || DEFAULT_SLOT_MINUTES} דק׳</span>
          {(shift.breaks?.length ?? 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <Coffee className="h-2.5 w-2.5" /> {shift.breaks!.length} הפסקות
            </span>
          )}
          {scopedCount > 0 && (
            <span className="flex items-center gap-0.5">
              <Stethoscope className="h-2.5 w-2.5" />
              {scopedCount} מתוך {services.length} שירותים
            </span>
          )}
        </span>
      </button>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onEdit}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="עריכת משמרת"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
          aria-label="מחיקת משמרת"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function ShiftDialog({
  draft,
  services,
  serviceScopeLabel,
  error,
  onClose,
  onSave,
}: {
  draft: ShiftDraft | null;
  services: ConsultationType[];
  serviceScopeLabel?: string;
  error: string | null;
  onClose: () => void;
  onSave: (shift: ScheduleShift) => void;
}) {
  // Remounted per draft (key below) so the form always starts from the shift
  // being edited without a sync effect.
  return (
    <Dialog
      open={!!draft}
      onClose={onClose}
      title={draft?.isNew ? "משמרת חדשה" : "עריכת משמרת"}
      className="max-w-lg"
    >
      {draft && (
        <div className="flex flex-col gap-3">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <ShiftForm
            key={draft.shift.id}
            initial={draft.shift}
            services={services}
            serviceScopeLabel={serviceScopeLabel}
            onSave={onSave}
          />
        </div>
      )}
    </Dialog>
  );
}

function ShiftForm({
  initial,
  services,
  serviceScopeLabel,
  onSave,
}: {
  initial: ScheduleShift;
  services: ConsultationType[];
  serviceScopeLabel?: string;
  onSave: (shift: ScheduleShift) => void;
}) {
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [label, setLabel] = useState(initial.label ?? "");
  const [slotMinutes, setSlotMinutes] = useState(initial.slot_minutes || DEFAULT_SLOT_MINUTES);
  const [breaks, setBreaks] = useState<ScheduleBreak[]>(initial.breaks ?? []);
  const [serviceIds, setServiceIds] = useState<string[]>(initial.service_ids ?? []);
  const [allServices, setAllServices] = useState((initial.service_ids ?? []).length === 0);

  const preview: ScheduleShift = {
    ...initial,
    start,
    end,
    slot_minutes: slotMinutes,
    breaks,
  };
  const slotCount = slotTimesForShift(preview).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input type="time" label="שעת התחלה" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input type="time" label="שעת סיום" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="שם המשמרת (לא חובה)"
          placeholder="משמרת בוקר"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Select
          label="אורך תור"
          value={String(slotMinutes)}
          onChange={(e) => setSlotMinutes(Number(e.target.value))}
        >
          {SLOT_MINUTE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m} דקות
            </option>
          ))}
        </Select>
      </div>

      {/* Breaks. */}
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <Coffee className="h-3.5 w-3.5 text-slate-400" /> הפסקות במהלך המשמרת
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setBreaks([...breaks, { id: generateId("brk"), start: "12:00", end: "12:30" }])
            }
          >
            <Plus className="h-3.5 w-3.5" /> הפסקה
          </Button>
        </div>
        {breaks.length === 0 ? (
          <p className="text-xs text-slate-400">אין הפסקות — כל המשמרת פתוחה להזמנות</p>
        ) : (
          <div className="flex flex-col gap-2">
            {breaks.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-2">
                <input
                  type="time"
                  value={b.start}
                  onChange={(e) =>
                    setBreaks(breaks.map((x) => (x.id === b.id ? { ...x, start: e.target.value } : x)))
                  }
                  className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                />
                <span className="text-slate-400">—</span>
                <input
                  type="time"
                  value={b.end}
                  onChange={(e) =>
                    setBreaks(breaks.map((x) => (x.id === b.id ? { ...x, end: e.target.value } : x)))
                  }
                  className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                />
                <input
                  value={b.label ?? ""}
                  placeholder="סיבה (לא חובה)"
                  onChange={(e) =>
                    setBreaks(breaks.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x)))
                  }
                  className="h-9 min-w-[8rem] flex-1 rounded-md border border-slate-300 px-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setBreaks(breaks.filter((x) => x.id !== b.id))}
                  className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Which services this shift hosts. */}
      <div className="rounded-lg border border-slate-200 p-3">
        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <Layers className="h-3.5 w-3.5 text-slate-400" /> שירותים הניתנים להזמנה במשמרת
        </span>
        {services.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">
            אין עדיין שירותים משויכים — כל תור שייקבע יתאים לכל שירות עתידי.
          </p>
        ) : (
          <>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={allServices}
                onChange={(e) => {
                  setAllServices(e.target.checked);
                  if (e.target.checked) setServiceIds([]);
                }}
                className="h-4 w-4 rounded border-slate-300 accent-primary"
              />
              {serviceScopeLabel ?? "כל השירותים במיקום זה"}
            </label>
            {!allServices && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {services.map((s) => {
                  const picked = serviceIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        setServiceIds(
                          picked ? serviceIds.filter((id) => id !== s.id) : [...serviceIds, s.id]
                        )
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
          </>
        )}
      </div>

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        המשמרת תייצר <strong className="text-slate-700">{slotCount}</strong> תורים פנויים.
      </p>

      <Button
        onClick={() =>
          onSave({
            ...initial,
            start,
            end,
            label: label.trim() || undefined,
            slot_minutes: slotMinutes,
            breaks,
            service_ids: allServices ? [] : serviceIds,
          })
        }
      >
        שמור משמרת
      </Button>
    </div>
  );
}

function CopyDayDialog({
  fromDay,
  targets,
  onToggleTarget,
  onClose,
  onApply,
}: {
  fromDay: DayKey | null;
  targets: DayKey[];
  onToggleTarget: (day: DayKey) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  return (
    <Dialog
      open={!!fromDay}
      onClose={onClose}
      title={fromDay ? `העתקת יום ${DAY_LABELS[fromDay]}` : ""}
      className="max-w-md"
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">
          לאילו ימים להעתיק את המשמרות? לוח הזמנים הקיים בימים שייבחרו יוחלף.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DAY_KEYS.filter((d) => d !== fromDay).map((d) => {
            const picked = targets.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => onToggleTarget(d)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  picked
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                {DAY_LABELS[d]}
              </button>
            );
          })}
        </div>
        <Button onClick={onApply} disabled={targets.length === 0}>
          העתק ל-{targets.length} ימים
        </Button>
      </div>
    </Dialog>
  );
}

function ExceptionDialog({
  open,
  existingDates,
  onClose,
  onSave,
}: {
  open: boolean;
  existingDates: string[];
  onClose: () => void;
  onSave: (exception: ScheduleException) => void;
}) {
  const [date, setDate] = useState("");
  const [closed, setClosed] = useState(true);
  const [reason, setReason] = useState("");

  const duplicate = !!date && existingDates.includes(date);

  function handleSave() {
    if (!date || duplicate) return;
    onSave({
      id: generateId("exc"),
      date,
      closed,
      reason: reason.trim() || undefined,
      shifts: closed ? undefined : [],
    });
    setDate("");
    setClosed(true);
    setReason("");
  }

  return (
    <Dialog open={open} onClose={onClose} title="חריגה בלוח הזמנים" className="max-w-md">
      <div className="flex flex-col gap-3">
        <Input
          type="date"
          label="תאריך"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={duplicate ? "כבר קיימת חריגה בתאריך זה" : undefined}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">סוג החריגה</span>
          <div className="flex gap-2">
            {(
              [
                [true, "סגור לחלוטין"],
                [false, "שעות מיוחדות"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => setClosed(value)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  closed === value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <Input label="סיבה (לא חובה)" value={reason} onChange={(e) => setReason(e.target.value)} />
        {!closed && (
          <p className="rounded-lg bg-info-bg px-3 py-2 text-xs text-info-text">
            לאחר השמירה יש להוסיף את המשמרות של אותו תאריך. עד שיוגדרו — התאריך יתנהג כיום סגור.
          </p>
        )}
        <Button onClick={handleSave} disabled={!date || duplicate}>
          שמור חריגה
        </Button>
      </div>
    </Dialog>
  );
}
