"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Lock, Plus, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/Misc";
import { cn, generateId } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { DAY_LABELS } from "@/lib/medical-tree";
import { getWeeklySchedule, totalWeeklyHours, validateDayShifts, withSchedule } from "@/lib/schedule";
import {
  Appointment,
  Clinic,
  ConsultationType,
  DayKey,
  LOCATION_TYPE_LABELS,
  ScheduleShift,
  WeeklySchedule,
} from "@/types";
import {
  CalendarBlock,
  CalendarLane,
  CalendarView,
  ScheduleMutation,
  addShiftToDay,
  deptColor,
  formatMin,
  rangeDays,
  removeShiftFromDay,
  replaceShiftInDay,
  shiftAnchor,
} from "@/lib/schedule-calendar";
import { ScheduleTimeGrid } from "./ScheduleTimeGrid";
import { ScheduleMonthView } from "./ScheduleMonthView";
import { CalendarNav, ViewSwitch } from "./CalendarToolbar";
import { CreateAvailabilityDialog, EditAvailabilityDialog } from "./AvailabilityDialogs";
import { ScheduleContextMenu } from "./ScheduleContextMenu";

/** A single provider's availability, as a real calendar (§PRV-05).
 *
 * Same surface as the unit's calendar (UnitScheduleCalendar) — Day/Week/Month,
 * drag to move, drag the edge to lengthen, click empty space to open a shift —
 * with the one structural difference that a solo provider's queues are their
 * מרפאות, not עמדות: each location is a lane with its own colour, because two
 * locations legitimately keep different weeks.
 *
 * The blocks are the RECURRING WEEKLY TEMPLATE: a block on "Tuesday the 14th"
 * is that lane's Tuesday shift, so editing it changes every Tuesday. One-off
 * changes are date exceptions, which appear here (dashed, locked) and are
 * edited in the weekly tab where they can be described. */
export function ClinicScheduleCalendar({
  clinics,
  services,
  appointments,
  locationLabelSingular = "מרפאה",
  onChange,
}: {
  clinics: Clinic[];
  services: ConsultationType[];
  appointments: Appointment[];
  locationLabelSingular?: string;
  onChange: (clinics: Clinic[]) => void;
}) {
  const showToast = useStore((s) => s.showToast);

  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [hiddenClinics, setHiddenClinics] = useState<Set<string>>(new Set());
  const [createState, setCreateState] = useState<{ date: Date; startMin: number } | null>(null);
  const [editBlock, setEditBlock] = useState<CalendarBlock | null>(null);
  const [deleteBlock, setDeleteBlock] = useState<CalendarBlock | null>(null);
  const [lockedNote, setLockedNote] = useState<CalendarBlock | null>(null);
  const [menu, setMenu] = useState<{ block: CalendarBlock; x: number; y: number } | null>(null);
  const [undoStack, setUndoStack] = useState<Clinic[][]>([]);

  // Each location is a lane, and doubles as its own colour group — so on a week
  // where two clinics run in parallel it's obvious which hours belong to which.
  const lanes: CalendarLane[] = useMemo(
    () =>
      clinics.map((c) => ({
        id: c.id,
        kind: "doctor",
        name: c.name,
        subtitle: LOCATION_TYPE_LABELS[c.location_type ?? "clinic"],
        service_ids: services
          .filter((s) => (s.linked_clinic_ids?.length ?? 0) === 0 || s.linked_clinic_ids!.includes(c.id))
          .map((s) => s.id),
        is_active: true,
        capacity: 1,
        service_array_id: c.id,
        service_array: c.name,
        schedule: c.schedule,
        schedule_exceptions: c.schedule_exceptions,
        editable: true,
      })),
    [clinics, services]
  );

  const clinicOrder = useMemo(() => clinics.map((c) => c.id), [clinics]);
  const visibleLanes = useMemo(() => lanes.filter((l) => !hiddenClinics.has(l.id)), [lanes, hiddenClinics]);
  const dates = useMemo(() => (view === "month" ? [] : rangeDays(view, anchor)), [view, anchor]);
  const laneById = useMemo(() => new Map(lanes.map((l) => [l.id, l])), [lanes]);

  // -------------------------------------------------------------------------
  // Persistence — every mutation is one write of the clinics array, snapshotted
  // first so a mistaken drag is one Ctrl+Z away.
  // -------------------------------------------------------------------------
  function persist(laneId: string, weekly: WeeklySchedule) {
    setUndoStack((s) => [...s.slice(-19), clinics]);
    onChange(clinics.map((c) => (c.id === laneId ? withSchedule(c, weekly) : c)));
  }

  function undo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    onChange(prev);
    showToast("הפעולה בוטלה", { variant: "success" });
  }

  function commitSchedule(laneId: string, _dayKey: DayKey, mutate: ScheduleMutation) {
    if (!mutate.ok) {
      showToast("העדכון בוטל", { description: mutate.error, variant: "destructive" });
      return;
    }
    persist(laneId, mutate.schedule);
    showToast("הזמינות עודכנה", { variant: "success" });
  }

  function commitCreate(laneId: string, dayKey: DayKey, shift: ScheduleShift): boolean {
    const lane = laneById.get(laneId);
    if (!lane) return false;
    const next = addShiftToDay(getWeeklySchedule(lane), dayKey, shift);
    const problem = validateDayShifts(next[dayKey] ?? []);
    if (problem) {
      showToast("לא ניתן לשמור", { description: problem, variant: "destructive" });
      return false;
    }
    persist(laneId, next);
    showToast("המשמרת נוספה", { variant: "success" });
    return true;
  }

  function commitEdit(block: CalendarBlock, shift: ScheduleShift): boolean {
    const lane = laneById.get(block.laneId);
    if (!lane) return false;
    const next = replaceShiftInDay(getWeeklySchedule(lane), block.dayKey, shift);
    const problem = validateDayShifts(next[block.dayKey] ?? []);
    if (problem) {
      showToast("לא ניתן לשמור", { description: problem, variant: "destructive" });
      return false;
    }
    persist(block.laneId, next);
    showToast("המשמרת עודכנה", { variant: "success" });
    return true;
  }

  function commitDelete(block: CalendarBlock) {
    const lane = laneById.get(block.laneId);
    if (!lane) return;
    persist(block.laneId, removeShiftFromDay(getWeeklySchedule(lane), block.dayKey, block.shift.id));
    showToast("המשמרת נמחקה", { variant: "success" });
  }

  /** Duplicate a shift right after itself on the same weekday — the fastest way
   * to build a split day (morning + evening) out of an existing one. */
  function duplicateBlock(block: CalendarBlock) {
    const lane = laneById.get(block.laneId);
    if (!lane) return;
    const dur = block.endMin - block.startMin;
    const start = Math.min(block.endMin, 24 * 60 - dur);
    const clone: ScheduleShift = {
      ...block.shift,
      id: generateId("shift"),
      start: formatMin(start),
      end: formatMin(start + dur),
      breaks: (block.shift.breaks ?? []).map((b) => ({ ...b, id: generateId("brk") })),
    };
    const next = addShiftToDay(getWeeklySchedule(lane), block.dayKey, clone);
    if (validateDayShifts(next[block.dayKey] ?? [])) {
      showToast("לא ניתן לשכפל כאן", { description: "אין מקום פנוי אחרי המשמרת.", variant: "destructive" });
      return;
    }
    persist(block.laneId, next);
    showToast("המשמרת שוכפלה", { variant: "success" });
  }

  // Keyboard shortcuts — the same vocabulary as every other calendar here.
  const dialogOpen = !!createState || !!editBlock || !!deleteBlock || !!lockedNote || !!menu;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (dialogOpen) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        undo();
      } else if (e.key === "ArrowRight") setAnchor((a) => shiftAnchor(view, a, -1)); // RTL
      else if (e.key === "ArrowLeft") setAnchor((a) => shiftAnchor(view, a, 1));
      else if (e.key === "t" || e.key === "T") setAnchor(new Date());
      else if (e.key === "1") setView("day");
      else if (e.key === "2") setView("week");
      else if (e.key === "3") setView("month");
      else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        openCreate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, dialogOpen, undoStack, dates]);

  function openCreate() {
    const today = new Date();
    const inRange = dates.some((d) => d.toDateString() === today.toDateString());
    const date = view === "month" ? today : inRange ? today : dates[0] ?? today;
    setCreateState({ date, startMin: 9 * 60 });
  }

  // Net open hours across the visible locations — the one number that answers
  // "how much did I actually open", breaks already deducted.
  const weeklyHours = useMemo(
    () => visibleLanes.reduce((sum, lane) => sum + totalWeeklyHours(lane), 0),
    [visibleLanes]
  );

  if (clinics.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock className="h-10 w-10" />}
        title={`הוסיפו ${locationLabelSingular} כדי לפתוח יומן`}
        description={`הזמינות נקבעת לכל ${locationLabelSingular} בנפרד, ולכן צריך לפחות אחת לפני שאפשר לפתוח משמרות.`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CalendarNav
          view={view}
          anchor={anchor}
          onAnchorChange={setAnchor}
          subtitle={weeklyHours > 0 ? `${weeklyHours.toFixed(1)} שעות פתוחות בשבוע` : "לא נפתחו משמרות"}
        />
        <div className="flex items-center gap-2">
          <ViewSwitch view={view} onChange={setView} />
          <Button variant="outline" size="sm" onClick={undo} disabled={undoStack.length === 0} title="בטל (Ctrl+Z)">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> הוספת משמרת
          </Button>
        </div>
      </div>

      {/* Locations legend — click to hide a location's hours */}
      {lanes.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {lanes.map((l) => {
            const hidden = hiddenClinics.has(l.id);
            const color = deptColor(l.id, clinicOrder);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() =>
                  setHiddenClinics((prev) => {
                    const next = new Set(prev);
                    if (next.has(l.id)) next.delete(l.id);
                    else next.add(l.id);
                    return next;
                  })
                }
                title={hidden ? "הצג מיקום" : "הסתר מיקום"}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                  hidden ? "border-slate-200 bg-slate-50 text-slate-400 line-through" : color.chip
                )}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full", hidden ? "bg-slate-300" : color.dot)} />
                {l.name}
                {l.subtitle && <span className="opacity-60">· {l.subtitle}</span>}
              </button>
            );
          })}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <CalendarClock className="h-3.5 w-3.5" />
        לחיצה על שעה ריקה פותחת משמרת חדשה · גרירה מזיזה · גרירת הקצה התחתון מאריכה · המשמרת חוזרת מדי שבוע באותו יום.
      </p>

      {/* The calendar surface */}
      {view === "month" ? (
        <ScheduleMonthView
          anchor={anchor}
          lanes={visibleLanes}
          deptOrder={clinicOrder}
          appointments={appointments}
          onPickDay={(d) => {
            setAnchor(d);
            setView("day");
          }}
        />
      ) : visibleLanes.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-10 w-10" />}
          title="כל המיקומים מוסתרים"
          description="הפעילו מיקום במקרא כדי לראות את המשמרות שלו."
        />
      ) : (
        <ScheduleTimeGrid
          view={view}
          dates={dates}
          lanes={visibleLanes}
          deptOrder={clinicOrder}
          selectedKeys={EMPTY_SELECTION}
          onToggleSelect={() => {}}
          onCreate={(date, startMin) => setCreateState({ date, startMin })}
          onEditBlock={(b) => setEditBlock(b)}
          onCommitSchedule={commitSchedule}
          onLockedInteract={(b) => setLockedNote(b)}
          onContextBlock={(b, x, y) => setMenu({ block: b, x, y })}
        />
      )}

      {menu && (
        <ScheduleContextMenu
          menu={menu}
          detailsLabel="פרטי החריגה"
          onClose={() => setMenu(null)}
          onEdit={() => setEditBlock(menu.block)}
          onDuplicate={() => duplicateBlock(menu.block)}
          onDelete={() => setDeleteBlock(menu.block)}
          onDetails={() => setLockedNote(menu.block)}
        />
      )}

      <CreateAvailabilityDialog
        open={!!createState}
        state={createState}
        lanes={visibleLanes}
        services={services}
        laneLabel={locationLabelSingular}
        onClose={() => setCreateState(null)}
        onCreate={(laneId, dayKey, shift) => {
          if (commitCreate(laneId, dayKey, shift)) setCreateState(null);
        }}
      />

      <EditAvailabilityDialog
        block={editBlock}
        services={services}
        laneLabel={locationLabelSingular}
        onClose={() => setEditBlock(null)}
        onSave={(shift) => {
          if (editBlock && commitEdit(editBlock, shift)) setEditBlock(null);
        }}
        onDelete={() => {
          if (editBlock) {
            setDeleteBlock(editBlock);
            setEditBlock(null);
          }
        }}
      />

      <ConfirmDialog
        open={!!deleteBlock}
        onClose={() => setDeleteBlock(null)}
        title="מחיקת משמרת"
        description={
          deleteBlock
            ? `המשמרת ב${deleteBlock.laneName} (${DAY_LABELS[deleteBlock.dayKey]}, ${formatMin(
                deleteBlock.startMin
              )}–${formatMin(deleteBlock.endMin)}) תימחק מכל השבועות. תורים חדשים לא יוצעו בשעות אלה.`
            : ""
        }
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteBlock) commitDelete(deleteBlock);
          setDeleteBlock(null);
        }}
      />

      {/* Exception blocks are shown for an honest timeline but edited where they
          can carry a reason — the weekly tab. */}
      <Dialog open={!!lockedNote} onClose={() => setLockedNote(null)} title="חריגה בלוח הזמנים">
        {lockedNote && (
          <div className="flex flex-col gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <Lock className="h-4 w-4 text-slate-400" />
              <div>
                <p className="font-medium text-slate-800">{lockedNote.laneName}</p>
                <p dir="ltr" className="text-xs text-slate-500">
                  {DAY_LABELS[lockedNote.dayKey]} · {formatMin(lockedNote.startMin)}–{formatMin(lockedNote.endMin)}
                </p>
              </div>
            </div>
            <p>
              שעות אלה מגיעות מחריגת תאריך (יום עם שעות שונות מהרגיל), ולכן אינן נערכות ביומן — עריכה או ביטול
              מתבצעים בלשונית ‚לוח שבועי וחריגות‘.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  );
}

const EMPTY_SELECTION = new Set<string>();
