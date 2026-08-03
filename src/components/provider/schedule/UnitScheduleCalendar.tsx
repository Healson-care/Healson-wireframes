"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/Misc";
import { cn, generateId } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { DAY_LABELS } from "@/lib/medical-tree";
import { getWeeklySchedule, hasAnyAvailability, validateDayShifts } from "@/lib/schedule";
import {
  Appointment,
  DayKey,
  OrganizationBranch,
  ProviderProfile,
  ScheduleShift,
  ServiceArray,
  WeeklySchedule,
} from "@/types";
import { UnitResource } from "@/lib/unit-resources";
import {
  CalendarBlock,
  CalendarLane,
  CalendarView,
  NO_DEPT,
  ScheduleMutation,
  addShiftToDay,
  deptColor,
  formatMin,
  rangeDays,
  removeShiftFromDay,
  replaceShiftInDay,
  shiftAnchor,
  toLanes,
} from "@/lib/schedule-calendar";
import { ScheduleTimeGrid } from "./ScheduleTimeGrid";
import { ScheduleMonthView } from "./ScheduleMonthView";
import { FilterSelect } from "./FilterSelect";
import { CalendarNav, ViewSwitch } from "./CalendarToolbar";
import { CreateAvailabilityDialog, EditAvailabilityDialog } from "./AvailabilityDialogs";
import { ScheduleContextMenu } from "./ScheduleContextMenu";
import {
  CalendarClock,
  CalendarDays,
  Copy,
  Link2,
  Lock,
  Plus,
  Trash2,
  Undo2,
  X,
} from "lucide-react";

interface Filters {
  branch: string; // 'all' | branchId
  dept: string; // 'all' | deptId | NO_DEPT
  resource: string; // 'all' | laneId
  status: "all" | "active" | "empty";
}

const DEFAULT_FILTERS: Filters = { branch: "all", dept: "all", resource: "all", status: "all" };

/** The unit availability calendar — a real Day/Week/Month scheduling surface.
 * Blocks are the unit's resources' recurring weekly shifts, projected onto
 * dates and coloured by מערך. Editing an inline-lane weekly block edits the
 * weekly template; shared-לו״ז and exception blocks are shown but locked. */
export function UnitScheduleCalendar({
  provider,
  resources,
  unitArrays,
  unitBranches,
  appointments,
  onChange,
}: {
  provider: ProviderProfile;
  resources: UnitResource[];
  unitArrays: ServiceArray[];
  unitBranches: OrganizationBranch[];
  appointments: Appointment[];
  onChange: (data: Partial<ProviderProfile>) => void;
}) {
  const showToast = useStore((s) => s.showToast);
  const updateResourceSchedule = useStore((s) => s.updateResourceSchedule);
  const affiliations = useStore((s) => s.affiliations);
  const updateAffiliation = useStore((s) => s.updateAffiliation);
  // §PRV-10 — lane ids that are first-class affiliations (vs. embedded legacy
  // doctors): their schedule is persisted onto the affiliation, not the unit.
  const affiliationIds = useMemo(() => new Set(affiliations.map((a) => a.id)), [affiliations]);
  const services = provider.consultation_types;

  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [hiddenDepts, setHiddenDepts] = useState<Set<string>>(new Set());
  // Selection keeps the whole block (not just its key) so bulk actions can act
  // on it without re-deriving blocks up here.
  const [selected, setSelected] = useState<Map<string, CalendarBlock>>(new Map());

  const [createState, setCreateState] = useState<{ date: Date; startMin: number } | null>(null);
  const [editBlock, setEditBlock] = useState<CalendarBlock | null>(null);
  const [deleteBlock, setDeleteBlock] = useState<CalendarBlock | null>(null);
  const [lockedNote, setLockedNote] = useState<CalendarBlock | null>(null);
  const [menu, setMenu] = useState<{ block: CalendarBlock; x: number; y: number } | null>(null);

  // Snapshot-based undo of the unit's schedule-bearing records.
  type Snapshot = Pick<ProviderProfile, "facilities" | "affiliated_doctors" | "resource_schedules">;
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const providerRef = useRef(provider);
  providerRef.current = provider;
  // A ref mirror so undo() (which may be invoked from a stale keyboard-effect
  // closure) always reads the current stack.
  const undoRef = useRef(undoStack);
  undoRef.current = undoStack;

  function pushUndo() {
    const p = providerRef.current;
    setUndoStack((s) => [
      ...s.slice(-19),
      {
        facilities: p.facilities ?? [],
        affiliated_doctors: p.affiliated_doctors ?? [],
        resource_schedules: p.resource_schedules ?? [],
      },
    ]);
  }
  function undo() {
    const stack = undoRef.current;
    if (stack.length === 0) return;
    const snap = stack[stack.length - 1];
    // Side effects OUTSIDE the state updater (updaters run during render).
    setUndoStack((s) => s.slice(0, -1));
    onChange(snap);
    showToast("הפעולה בוטלה", { variant: "success" });
  }

  const allLanes = useMemo(() => toLanes(resources), [resources]);
  const deptOrder = useMemo(() => unitArrays.map((a) => a.id), [unitArrays]);
  const branchName = useMemo(
    () => new Map(unitBranches.map((b) => [b.id, b.name])),
    [unitBranches]
  );

  // Lanes passing the hard filters (branch/dept/resource/status), before the
  // soft legend visibility toggles.
  const filteredLanes = useMemo(
    () =>
      allLanes.filter((l) => {
        if (filters.branch !== "all" && (l.branch_id ?? "") !== filters.branch) return false;
        const dept = l.service_array_id ?? NO_DEPT;
        if (filters.dept !== "all" && dept !== filters.dept) return false;
        if (filters.resource !== "all" && l.id !== filters.resource) return false;
        if (filters.status === "active" && !hasAnyAvailability(l)) return false;
        if (filters.status === "empty" && hasAnyAvailability(l)) return false;
        return true;
      }),
    [allLanes, filters]
  );

  // Departments present in the filtered set — the legend / toggle chips.
  const legendDepts = useMemo(() => {
    const present = new Map<string, number>();
    for (const l of filteredLanes) {
      const d = l.service_array_id ?? NO_DEPT;
      present.set(d, (present.get(d) ?? 0) + 1);
    }
    return [...present.entries()]
      .map(([id, count]) => ({
        id,
        count,
        name: id === NO_DEPT ? "ללא מערך" : unitArrays.find((a) => a.id === id)?.name ?? "מערך",
        branch: id === NO_DEPT ? "" : branchName.get(unitArrays.find((a) => a.id === id)?.branch_id ?? "") ?? "",
      }))
      // Keep colour order stable (by deptOrder), NO_DEPT last.
      .sort((a, b) => {
        if (a.id === NO_DEPT) return 1;
        if (b.id === NO_DEPT) return -1;
        return deptOrder.indexOf(a.id) - deptOrder.indexOf(b.id);
      });
  }, [filteredLanes, unitArrays, deptOrder, branchName]);

  const visibleLanes = useMemo(
    () => filteredLanes.filter((l) => !hiddenDepts.has(l.service_array_id ?? NO_DEPT)),
    [filteredLanes, hiddenDepts]
  );

  const dates = useMemo(() => (view === "month" ? [] : rangeDays(view, anchor)), [view, anchor]);

  // Options for the cascading filter selects.
  const branchOptions = unitBranches;
  const deptOptions = useMemo(() => {
    const ids = new Set(
      allLanes
        .filter((l) => filters.branch === "all" || (l.branch_id ?? "") === filters.branch)
        .map((l) => l.service_array_id ?? NO_DEPT)
    );
    const opts = unitArrays.filter((a) => ids.has(a.id)).map((a) => ({ id: a.id, name: a.name }));
    if (ids.has(NO_DEPT)) opts.push({ id: NO_DEPT, name: "ללא מערך" });
    return opts;
  }, [allLanes, unitArrays, filters.branch]);
  const resourceOptions = useMemo(
    () =>
      allLanes.filter((l) => {
        if (filters.branch !== "all" && (l.branch_id ?? "") !== filters.branch) return false;
        if (filters.dept !== "all" && (l.service_array_id ?? NO_DEPT) !== filters.dept) return false;
        return true;
      }),
    [allLanes, filters.branch, filters.dept]
  );

  // Inline (editable) lanes — the only valid targets to CREATE availability on.
  const editableLanes = useMemo(() => visibleLanes.filter((l) => l.editable), [visibleLanes]);

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------
  function persistLaneSchedule(lane: CalendarLane, weekly: WeeklySchedule) {
    if (lane.schedule_id) {
      // Shared לו״ז — grid keeps these locked, but guard anyway.
      updateResourceSchedule(provider.id, lane.schedule_id, { schedule: weekly });
      return;
    }
    if (lane.kind === "facility") {
      onChange({
        facilities: (provider.facilities ?? []).map((f) =>
          f.id === lane.id ? { ...f, schedule: weekly } : f
        ),
      });
    } else if (affiliationIds.has(lane.id)) {
      // First-class affiliation — the unit owns this person's in-unit schedule.
      updateAffiliation(lane.id, { schedule: weekly });
    } else {
      onChange({
        affiliated_doctors: (provider.affiliated_doctors ?? []).map((a) =>
          a.id === lane.id ? { ...a, schedule: weekly } : a
        ),
      });
    }
  }

  const laneById = useMemo(() => new Map(allLanes.map((l) => [l.id, l])), [allLanes]);

  /** One combined write across several inline lanes (bulk actions) — a single
   * onChange so sequential updates don't clobber each other on stale state. */
  function persistMany(updates: { laneId: string; weekly: WeeklySchedule }[]) {
    if (updates.length === 0) return;
    const byLane = new Map(updates.map((u) => [u.laneId, u.weekly]));
    // Affiliation-backed lanes persist onto the affiliations slice individually;
    // facilities + legacy embedded doctors go through the single provider write.
    updates.forEach((u) => {
      if (affiliationIds.has(u.laneId)) updateAffiliation(u.laneId, { schedule: u.weekly });
    });
    onChange({
      facilities: (provider.facilities ?? []).map((f) =>
        byLane.has(f.id) ? { ...f, schedule: byLane.get(f.id) } : f
      ),
      affiliated_doctors: (provider.affiliated_doctors ?? []).map((a) =>
        byLane.has(a.id) ? { ...a, schedule: byLane.get(a.id) } : a
      ),
    });
  }

  function commitSchedule(laneId: string, _dayKey: DayKey, mutate: ScheduleMutation) {
    if (!mutate.ok) {
      showToast("העדכון בוטל", { description: mutate.error, variant: "destructive" });
      return;
    }
    const lane = laneById.get(laneId);
    if (!lane) return;
    pushUndo();
    persistLaneSchedule(lane, mutate.schedule);
    showToast("הזמינות עודכנה", { variant: "success" });
  }

  // Create
  function commitCreate(laneId: string, dayKey: DayKey, shift: ScheduleShift): boolean {
    const lane = laneById.get(laneId);
    if (!lane) return false;
    const weekly = getWeeklySchedule(lane);
    const next = addShiftToDay(weekly, dayKey, shift);
    const problem = validateDayShifts(next[dayKey] ?? []);
    if (problem) {
      showToast("לא ניתן לשמור", { description: problem, variant: "destructive" });
      return false;
    }
    pushUndo();
    persistLaneSchedule(lane, next);
    showToast("הזמינות נוספה", { variant: "success" });
    return true;
  }

  // Edit
  function commitEdit(block: CalendarBlock, shift: ScheduleShift): boolean {
    const lane = laneById.get(block.laneId);
    if (!lane) return false;
    const weekly = getWeeklySchedule(lane);
    const next = replaceShiftInDay(weekly, block.dayKey, shift);
    const problem = validateDayShifts(next[block.dayKey] ?? []);
    if (problem) {
      showToast("לא ניתן לשמור", { description: problem, variant: "destructive" });
      return false;
    }
    pushUndo();
    persistLaneSchedule(lane, next);
    showToast("הזמינות עודכנה", { variant: "success" });
    return true;
  }

  function commitDelete(block: CalendarBlock) {
    const lane = laneById.get(block.laneId);
    if (!lane) return;
    const weekly = getWeeklySchedule(lane);
    pushUndo();
    persistLaneSchedule(lane, removeShiftFromDay(weekly, block.dayKey, block.shift.id));
    showToast("הזמינות נמחקה", { variant: "success" });
  }

  /** Duplicate a shift immediately after itself on the same weekday. */
  function duplicateBlock(block: CalendarBlock) {
    const lane = laneById.get(block.laneId);
    if (!lane || !block.editable) return;
    const dur = block.endMin - block.startMin;
    const start = Math.min(block.endMin, 24 * 60 - dur);
    const clone: ScheduleShift = {
      ...block.shift,
      id: generateId("shift"),
      start: formatMin(start),
      end: formatMin(start + dur),
      breaks: (block.shift.breaks ?? []).map((b) => ({ ...b, id: generateId("brk") })),
    };
    const weekly = getWeeklySchedule(lane);
    const next = addShiftToDay(weekly, block.dayKey, clone);
    const problem = validateDayShifts(next[block.dayKey] ?? []);
    if (problem) {
      showToast("לא ניתן לשכפל כאן", { description: problem, variant: "destructive" });
      return;
    }
    pushUndo();
    persistLaneSchedule(lane, next);
    showToast("הזמינות שוכפלה", { variant: "success" });
  }

  /** Bulk-delete every selected editable block, in one write. */
  function deleteSelected() {
    const editableBlocks = [...selected.values()].filter((b) => b.editable);
    if (editableBlocks.length === 0) {
      setSelected(new Map());
      return;
    }
    const perLane = new Map<string, WeeklySchedule>();
    for (const b of editableBlocks) {
      const lane = laneById.get(b.laneId);
      if (!lane) continue;
      const base = perLane.get(b.laneId) ?? getWeeklySchedule(lane);
      perLane.set(b.laneId, removeShiftFromDay(base, b.dayKey, b.shift.id));
    }
    pushUndo();
    persistMany([...perLane.entries()].map(([laneId, weekly]) => ({ laneId, weekly })));
    showToast(`${editableBlocks.length} משמרות נמחקו`, { variant: "success" });
    setSelected(new Map());
  }

  /** Bulk-duplicate every selected editable block (each after itself). */
  function duplicateSelected() {
    const editableBlocks = [...selected.values()].filter((b) => b.editable);
    if (editableBlocks.length === 0) return;
    const perLane = new Map<string, WeeklySchedule>();
    let added = 0;
    let skipped = 0;
    for (const b of editableBlocks) {
      const lane = laneById.get(b.laneId);
      if (!lane) continue;
      const base = perLane.get(b.laneId) ?? getWeeklySchedule(lane);
      const dur = b.endMin - b.startMin;
      const start = Math.min(b.endMin, 24 * 60 - dur);
      const clone: ScheduleShift = {
        ...b.shift,
        id: generateId("shift"),
        start: formatMin(start),
        end: formatMin(start + dur),
        breaks: (b.shift.breaks ?? []).map((br) => ({ ...br, id: generateId("brk") })),
      };
      const candidate = addShiftToDay(base, b.dayKey, clone);
      if (validateDayShifts(candidate[b.dayKey] ?? [])) {
        skipped++;
        continue;
      }
      perLane.set(b.laneId, candidate);
      added++;
    }
    if (added === 0) {
      showToast("לא ניתן לשכפל", { description: "אין מקום פנוי אחרי המשמרות שנבחרו.", variant: "destructive" });
      return;
    }
    pushUndo();
    persistMany([...perLane.entries()].map(([laneId, weekly]) => ({ laneId, weekly })));
    showToast(`${added} משמרות שוכפלו${skipped ? ` · ${skipped} דולגו` : ""}`, { variant: "success" });
    setSelected(new Map());
  }

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------
  function toggleSelect(block: CalendarBlock, additive: boolean) {
    setSelected((prev) => {
      const next = additive ? new Map(prev) : new Map<string, CalendarBlock>();
      if (prev.has(block.key)) next.delete(block.key);
      else next.set(block.key, block);
      return next;
    });
  }
  const selectedKeys = useMemo(() => new Set(selected.keys()), [selected]);

  // Keyboard shortcuts — active while the calendar is mounted, but never while
  // typing in a field or with a dialog open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (createState || editBlock || deleteBlock || lockedNote) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        undo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selected.size > 0) {
          e.preventDefault();
          deleteSelected();
        }
      } else if (e.key === "Escape") {
        if (menu) setMenu(null);
        else if (selected.size > 0) setSelected(new Map());
      } else if (e.key === "n" || e.key === "N") {
        if (!noEditable) {
          e.preventDefault();
          openCreate();
        }
      } else if (e.key === "ArrowRight") {
        setAnchor((a) => shiftAnchor(view, a, -1)); // RTL: right = previous
      } else if (e.key === "ArrowLeft") {
        setAnchor((a) => shiftAnchor(view, a, 1));
      } else if (e.key === "t" || e.key === "T") {
        setAnchor(new Date());
      } else if (e.key === "1") setView("day");
      else if (e.key === "2") setView("week");
      else if (e.key === "3") setView("month");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, menu, createState, editBlock, deleteBlock, lockedNote, view, anchor, filters, hiddenDepts]);

  const emptyLegend = legendDepts.length === 0;
  const noResources = allLanes.length === 0;
  const noEditable = editableLanes.length === 0;

  function openCreate() {
    const today = new Date();
    const inRange = dates.some((d) => d.toDateString() === today.toDateString());
    const date = view === "month" ? today : inRange ? today : dates[0] ?? today;
    setCreateState({ date, startMin: 9 * 60 });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CalendarNav view={view} anchor={anchor} onAnchorChange={setAnchor} />

        <div className="flex items-center gap-2">
          <ViewSwitch view={view} onChange={setView} />
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={undoStack.length === 0}
            aria-label="בטל פעולה אחרונה"
            title="בטל (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={openCreate} disabled={noEditable}>
            <Plus className="h-4 w-4" /> הוספת זמינות
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="סניף"
          value={filters.branch}
          onChange={(v) => setFilters((f) => ({ ...f, branch: v, dept: "all", resource: "all" }))}
          options={[{ value: "all", label: "כל הסניפים" }, ...branchOptions.map((b) => ({ value: b.id, label: b.name }))]}
        />
        <FilterSelect
          label="מערך"
          value={filters.dept}
          onChange={(v) => setFilters((f) => ({ ...f, dept: v, resource: "all" }))}
          options={[{ value: "all", label: "כל המערכים" }, ...deptOptions.map((d) => ({ value: d.id, label: d.name }))]}
        />
        <FilterSelect
          label="עמדה"
          value={filters.resource}
          onChange={(v) => setFilters((f) => ({ ...f, resource: v }))}
          options={[
            { value: "all", label: "כל העמדות" },
            ...resourceOptions.map((r) => ({ value: r.id, label: r.name })),
          ]}
        />
        <FilterSelect
          label="סטטוס"
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v as Filters["status"] }))}
          options={[
            { value: "all", label: "הכל" },
            { value: "active", label: "עם לו״ז" },
            { value: "empty", label: "ללא לו״ז" },
          ]}
        />
        {(filters.branch !== "all" ||
          filters.dept !== "all" ||
          filters.resource !== "all" ||
          filters.status !== "all") && (
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="focus-ring flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
          >
            <X className="h-3 w-3" /> נקה סינון
          </button>
        )}
      </div>

      {/* Legend + department toggles */}
      {!emptyLegend && (
        <div className="flex flex-wrap items-center gap-1.5">
          {legendDepts.map((d) => {
            const hidden = hiddenDepts.has(d.id);
            const color = deptColor(d.id, deptOrder);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() =>
                  setHiddenDepts((prev) => {
                    const next = new Set(prev);
                    if (next.has(d.id)) next.delete(d.id);
                    else next.add(d.id);
                    return next;
                  })
                }
                title={hidden ? "הצג מערך" : "הסתר מערך"}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                  hidden ? "border-slate-200 bg-slate-50 text-slate-400 line-through" : color.chip
                )}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full", hidden ? "bg-slate-300" : color.dot)} />
                {d.name}
                {d.branch && <span className="opacity-60">· {d.branch}</span>}
                <span className="opacity-70">({d.count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* The calendar surface */}
      {noResources ? (
        <EmptyState
          icon={<CalendarClock className="h-10 w-10" />}
          title="אין עדיין עמדות ביחידה"
          description="הוסיפו עמדות — ציוד או נותני שירות — בלשונית ‚מערכים ועמדות‘, והיומן יתמלא בזמינות שלהן."
        />
      ) : view === "month" ? (
        <ScheduleMonthView
          anchor={anchor}
          lanes={visibleLanes}
          deptOrder={deptOrder}
          appointments={appointments}
          onPickDay={(d) => {
            setAnchor(d);
            setView("day");
          }}
        />
      ) : visibleLanes.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-10 w-10" />}
          title="אין עמדות להצגה"
          description="כל העמדות מוסתרות על ידי הסינון או מקרא המערכים. נקו את הסינון או הפעילו מערך כדי לראות זמינות."
        />
      ) : (
        <ScheduleTimeGrid
          view={view}
          dates={dates}
          lanes={visibleLanes}
          deptOrder={deptOrder}
          selectedKeys={selectedKeys}
          onToggleSelect={toggleSelect}
          onCreate={(date, startMin) => setCreateState({ date, startMin })}
          onEditBlock={(b) => setEditBlock(b)}
          onCommitSchedule={commitSchedule}
          onLockedInteract={(b) => setLockedNote(b)}
          onContextBlock={(b, x, y) => setMenu({ block: b, x, y })}
        />
      )}

      {/* Right-click context menu */}
      {menu && (
        <ScheduleContextMenu
          menu={menu}
          selectedCount={selected.size}
          detailsLabel="פרטי העמדה"
          onClose={() => setMenu(null)}
          onEdit={() => setEditBlock(menu.block)}
          onDuplicate={() => duplicateBlock(menu.block)}
          onDelete={() => setDeleteBlock(menu.block)}
          onDetails={() => setLockedNote(menu.block)}
          onDeleteSelected={deleteSelected}
        />
      )}

      {/* Floating bulk-action bar */}
      {selected.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
            <Badge tone="info">{selected.size} נבחרו</Badge>
            <span className="h-4 w-px bg-slate-200" />
            <Button variant="ghost" size="sm" onClick={duplicateSelected}>
              <Copy className="h-4 w-4" /> שכפול
            </Button>
            <Button variant="ghost" size="sm" onClick={deleteSelected} className="text-danger hover:bg-danger-bg">
              <Trash2 className="h-4 w-4" /> מחיקה
            </Button>
            <button
              type="button"
              onClick={() => setSelected(new Map())}
              className="focus-ring rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
              aria-label="בטל בחירה"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create dialog */}
      <CreateAvailabilityDialog
        open={!!createState}
        state={createState}
        lanes={editableLanes}
        services={services}
        laneLabel="עמדה"
        defaultLaneId={filters.resource !== "all" ? filters.resource : undefined}
        onClose={() => setCreateState(null)}
        onCreate={(laneId, dayKey, shift) => {
          if (commitCreate(laneId, dayKey, shift)) setCreateState(null);
        }}
      />

      {/* Edit dialog */}
      <EditAvailabilityDialog
        block={editBlock}
        services={services}
        laneLabel="עמדה"
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
        title="מחיקת זמינות"
        description={
          deleteBlock
            ? `המשמרת של ${deleteBlock.laneName} (${formatMin(deleteBlock.startMin)}–${formatMin(
                deleteBlock.endMin
              )}, ${DAY_LABELS[deleteBlock.dayKey]}) תימחק. תורים חדשים לא יוצעו בשעות אלה.`
            : ""
        }
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteBlock) commitDelete(deleteBlock);
          setDeleteBlock(null);
        }}
      />

      {/* Locked-block note (shared לו״ז / date exception) */}
      <Dialog
        open={!!lockedNote}
        onClose={() => setLockedNote(null)}
        title={lockedNote?.origin === "exception" ? "חריגה בלוח הזמנים" : "עמדה עם לו״ז משותף"}
      >
        {lockedNote && (
          <div className="flex flex-col gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              {lockedNote.origin === "exception" ? (
                <Lock className="h-4 w-4 text-slate-400" />
              ) : (
                <Link2 className="h-4 w-4 text-info-text" />
              )}
              <div>
                <p className="font-medium text-slate-800">{lockedNote.laneName}</p>
                <p dir="ltr" className="text-xs text-slate-500">
                  {DAY_LABELS[lockedNote.dayKey]} · {formatMin(lockedNote.startMin)}–{formatMin(lockedNote.endMin)}
                </p>
              </div>
            </div>
            <p>
              {lockedNote.origin === "exception"
                ? "משמרת זו מגיעה מחריגת תאריך. עריכתה מתבצעת בעורך העמדה בלשונית ‚מערכים ועמדות‘."
                : "עמדה זו עוקבת אחרי לו״ז משותף. עריכת השעות מתבצעת פעם אחת בלשונית ‚לו״זים משותפים‘, ומשפיעה על כל העמדות החולקות אותו."}
            </p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
