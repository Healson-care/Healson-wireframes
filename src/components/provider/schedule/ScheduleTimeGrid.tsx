"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { DAY_LABELS } from "@/lib/medical-tree";
import { isoDate } from "@/lib/calendar";
import { dayKeyForDate, getWeeklySchedule } from "@/lib/schedule";
import { DayKey } from "@/types";
import {
  CalendarBlock,
  CalendarLane,
  DeptColor,
  HOUR_PX,
  MIN_BLOCK_MIN,
  ScheduleMutation,
  buildBlocks,
  clampMin,
  deptColor,
  formatMin,
  layoutByDate,
  moveShift,
  resizeShiftEnd,
  snap,
  timeBounds,
} from "@/lib/schedule-calendar";
import { Link2, Lock, MonitorCog, Stethoscope } from "lucide-react";

interface DragState {
  block: CalendarBlock;
  mode: "move" | "resize";
  startClientX: number;
  startClientY: number;
  dur: number;
  previewStartMin: number;
  previewEndMin: number;
  previewDayIndex: number;
  moved: boolean;
}

/** The week/day time-grid. Blocks are recurring shifts projected onto concrete
 * dates; editing a weekly-origin block on an inline lane edits the underlying
 * weekly template. */
export function ScheduleTimeGrid({
  view,
  dates,
  lanes,
  deptOrder,
  selectedKeys,
  onToggleSelect,
  onCreate,
  onEditBlock,
  onCommitSchedule,
  onLockedInteract,
  onContextBlock,
}: {
  view: "day" | "week";
  dates: Date[];
  lanes: CalendarLane[];
  deptOrder: string[];
  selectedKeys: Set<string>;
  onToggleSelect: (block: CalendarBlock, additive: boolean) => void;
  onCreate: (date: Date, startMin: number) => void;
  onEditBlock: (block: CalendarBlock) => void;
  onCommitSchedule: (laneId: string, dayKey: DayKey, mutate: ScheduleMutation) => void;
  onLockedInteract: (block: CalendarBlock) => void;
  onContextBlock: (block: CalendarBlock, x: number, y: number) => void;
}) {
  const laneById = useMemo(() => new Map(lanes.map((l) => [l.id, l])), [lanes]);

  const blocks = useMemo(() => buildBlocks(lanes, dates), [lanes, dates]);
  const byDate = useMemo(() => layoutByDate(blocks), [blocks]);
  const bounds = useMemo(() => timeBounds(blocks), [blocks]);
  const pxPerMin = HOUR_PX / 60;
  const gridHeight = (bounds.endMin - bounds.startMin) * pxPerMin;
  const startHour = Math.floor(bounds.startMin / 60);
  const endHour = Math.ceil(bounds.endMin / 60);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Guards a stray click firing on a day column right after a drag ends there,
  // which would otherwise open the create dialog.
  const didDragRef = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);

  // Live "now" line — recomputed each minute.
  const [nowMin, setNowMin] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }, 60_000);
    return () => clearInterval(t);
  }, []);
  const todayIso = isoDate(new Date());

  const topFor = (min: number) => (clampMin(min, bounds.startMin, bounds.endMin) - bounds.startMin) * pxPerMin;

  // Drag lifecycle via window listeners (pointer may leave the block).
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      setDrag((prev) => {
        if (!prev) return prev;
        const dy = e.clientY - prev.startClientY;
        const dx = e.clientX - prev.startClientX;
        const deltaMin = snap(dy / pxPerMin);
        const moved = prev.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4;
        if (prev.mode === "resize") {
          const newEnd = clampMin(
            Math.max(prev.block.startMin + MIN_BLOCK_MIN, prev.block.endMin + deltaMin),
            bounds.startMin,
            bounds.endMin
          );
          return { ...prev, previewEndMin: newEnd, moved };
        }
        // move: vertical shifts time, horizontal can move to another day column
        let dayIndex = prev.previewDayIndex;
        if (view === "week") {
          for (let i = 0; i < dates.length; i++) {
            const r = colRefs.current[i]?.getBoundingClientRect();
            if (r && e.clientX >= r.left && e.clientX <= r.right) {
              dayIndex = i;
              break;
            }
          }
        }
        const start = clampMin(prev.block.startMin + deltaMin, bounds.startMin, bounds.endMin - prev.dur);
        return { ...prev, previewStartMin: start, previewEndMin: start + prev.dur, previewDayIndex: dayIndex, moved };
      });
    };
    const onUp = (e: PointerEvent) => {
      // `drag` is fresh here: the effect re-subscribes on every drag change
      // (it's in the dep list), so this closure always sees the latest preview.
      // Side effects live in the plain handler — NEVER inside a setState updater
      // (React runs updaters during render, which would setState the parent
      // mid-render).
      const prev = drag;
      if (!prev) return;
      const lane = laneById.get(prev.block.laneId);
      if (!prev.moved || !lane) {
        // A click, not a drag: modifier-click selects, plain click edits.
        if (!prev.moved) {
          if (e.ctrlKey || e.metaKey || e.shiftKey) onToggleSelect(prev.block, true);
          else if (prev.block.editable) onEditBlock(prev.block);
          else onLockedInteract(prev.block);
        }
        setDrag(null);
        return;
      }
      didDragRef.current = true; // suppress the trailing column click
      if (prev.block.editable) {
        const weekly = getWeeklySchedule(lane);
        if (prev.mode === "resize") {
          const res = resizeShiftEnd(weekly, prev.block.dayKey, prev.block.shift, prev.previewEndMin);
          onCommitSchedule(prev.block.laneId, prev.block.dayKey, res);
        } else {
          const toDay = dayKeyForDate(dates[prev.previewDayIndex]);
          const delta = prev.previewStartMin - prev.block.startMin;
          const res = moveShift(weekly, prev.block.dayKey, toDay, prev.block.shift, delta);
          onCommitSchedule(prev.block.laneId, toDay, res);
        }
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [
    drag,
    dates,
    view,
    pxPerMin,
    bounds.startMin,
    bounds.endMin,
    laneById,
    onCommitSchedule,
    onEditBlock,
    onLockedInteract,
    onToggleSelect,
  ]);

  function startDrag(e: React.PointerEvent, block: CalendarBlock, mode: "move" | "resize") {
    if (!block.editable) return; // locked blocks: click handled on pointerup below
    e.stopPropagation();
    setDrag({
      block,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      dur: block.endMin - block.startMin,
      previewStartMin: block.startMin,
      previewEndMin: block.endMin,
      previewDayIndex: Math.max(0, dates.findIndex((d) => isoDate(d) === block.date)),
      moved: false,
    });
  }

  const gridColsClass =
    view === "day" ? "grid-cols-[3.25rem_minmax(0,1fr)]" : "grid-cols-[3.25rem_repeat(7,minmax(6rem,1fr))]";

  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm" style={{ maxHeight: "72vh" }}>
      <div className={cn("grid min-w-fit", gridColsClass)}>
        {/* Header row */}
        <div className="sticky start-0 top-0 z-30 border-b border-e border-slate-200 bg-white" />
        {dates.map((d) => {
          const iso = isoDate(d);
          const isToday = iso === todayIso;
          return (
            <div
              key={`h-${iso}`}
              className={cn(
                "sticky top-0 z-20 border-b border-e border-slate-200 bg-white px-2 py-1.5 text-center",
                isToday && "bg-primary/5"
              )}
            >
              <p className="text-[11px] font-medium text-slate-400">{DAY_LABELS[dayKeyForDate(d)]}</p>
              <p
                className={cn(
                  "mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold",
                  isToday ? "bg-primary text-white" : "text-slate-800"
                )}
              >
                {d.getDate()}
              </p>
            </div>
          );
        })}

        {/* Time gutter */}
        <div className="sticky start-0 z-10 border-e border-slate-200 bg-white" style={{ height: gridHeight }}>
          <div className="relative h-full">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute -translate-y-1/2 ps-1 text-[10px] font-medium tabular-nums text-slate-400"
                style={{ top: (h * 60 - bounds.startMin) * pxPerMin }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
        </div>

        {/* Day columns */}
        {dates.map((d, dayIndex) => {
          const iso = isoDate(d);
          const isToday = iso === todayIso;
          const dayBlocks = byDate.get(iso) ?? [];
          return (
            <div
              key={`c-${iso}`}
              ref={(el) => {
                colRefs.current[dayIndex] = el;
              }}
              className={cn("relative border-e border-slate-100", isToday && "bg-primary/[0.03]")}
              style={{ height: gridHeight }}
              onClick={(e) => {
                // Suppress the click that trails a drag ending on this column.
                if (didDragRef.current) {
                  didDragRef.current = false;
                  return;
                }
                // Background click → create at the pointer time.
                if (e.currentTarget !== e.target) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const min = snap(bounds.startMin + (e.clientY - rect.top) / pxPerMin);
                onCreate(d, clampMin(min, bounds.startMin, bounds.endMin - 30));
              }}
            >
              {/* hour gridlines */}
              {hours.map((h) => (
                <div
                  key={h}
                  className="pointer-events-none absolute inset-x-0 border-t border-slate-100"
                  style={{ top: (h * 60 - bounds.startMin) * pxPerMin }}
                />
              ))}

              {/* now line */}
              {isToday && nowMin >= bounds.startMin && nowMin <= bounds.endMin && (
                <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: topFor(nowMin) }}>
                  <div className="relative border-t-2 border-rose-500">
                    <span className="absolute -top-1 start-0 h-2 w-2 -translate-x-1/2 rounded-full bg-rose-500 rtl:translate-x-1/2" />
                  </div>
                </div>
              )}

              {dayBlocks.map((b) => {
                const isDragged = drag?.block.key === b.key;
                // While move-dragging, the source is replaced by a floating
                // preview (possibly in another column), so hide it here.
                if (isDragged && drag?.mode === "move") return null;
                const color = deptColor(b.deptId, deptOrder);
                // Resize preview adjusts the end in place.
                const endMin = isDragged && drag?.mode === "resize" ? drag.previewEndMin : b.endMin;
                return (
                  <BlockView
                    key={b.key}
                    block={b}
                    color={color}
                    top={topFor(b.startMin)}
                    height={(endMin - b.startMin) * pxPerMin}
                    startMin={b.startMin}
                    endMin={endMin}
                    selected={selectedKeys.has(b.key)}
                    dragging={isDragged}
                    onPointerDownMove={(e) => startDrag(e, b, "move")}
                    onPointerDownResize={(e) => startDrag(e, b, "resize")}
                    onClickLocked={() => onLockedInteract(b)}
                    onToggleSelect={(additive) => onToggleSelect(b, additive)}
                    onContext={(x, y) => onContextBlock(b, x, y)}
                  />
                );
              })}

              {/* Single floating preview for a move drag, in the target column. */}
              {drag?.mode === "move" && drag.previewDayIndex === dayIndex && (
                <FloatingPreview
                  block={drag.block}
                  color={deptColor(drag.block.deptId, deptOrder)}
                  top={topFor(drag.previewStartMin)}
                  height={(drag.previewEndMin - drag.previewStartMin) * pxPerMin}
                  startMin={drag.previewStartMin}
                  endMin={drag.previewEndMin}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BlockView({
  block,
  color,
  top,
  height,
  startMin,
  endMin,
  selected,
  dragging,
  onPointerDownMove,
  onPointerDownResize,
  onClickLocked,
  onToggleSelect,
  onContext,
}: {
  block: CalendarBlock;
  color: DeptColor;
  top: number;
  height: number;
  startMin: number;
  endMin: number;
  selected: boolean;
  dragging: boolean;
  onPointerDownMove: (e: React.PointerEvent) => void;
  onPointerDownResize: (e: React.PointerEvent) => void;
  onClickLocked: () => void;
  onToggleSelect: (additive: boolean) => void;
  onContext: (x: number, y: number) => void;
}) {
  const compact = height < 40;
  const widthPct = 100 / block.colCount;
  const rightPct = (block.col * 100) / block.colCount;
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group absolute overflow-hidden rounded-lg border ps-1.5 pe-1 py-1 text-start shadow-sm transition-shadow",
        color.block,
        block.editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        dragging && "z-40 shadow-lg ring-2 ring-offset-1",
        selected && cn("ring-2 ring-offset-1", color.ring),
        !block.editable && "border-dashed"
      )}
      style={{
        top,
        height: Math.max(height, 18),
        width: `calc(${widthPct}% - 3px)`,
        right: `calc(${rightPct}% + 1px)`,
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        if (block.editable) onPointerDownMove(e);
      }}
      onClick={(e) => {
        // Locked blocks have no drag lifecycle, so their click is handled here;
        // editable blocks resolve click-vs-drag (and modifier-select) on the
        // grid's window pointerup.
        if (!block.editable) {
          e.stopPropagation();
          if (e.ctrlKey || e.metaKey || e.shiftKey) onToggleSelect(true);
          else onClickLocked();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContext(e.clientX, e.clientY);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggleSelect(e.shiftKey);
        }
      }}
    >
      {/* leading colour rail */}
      <span className={cn("absolute inset-y-0 start-0 w-1", color.accent)} aria-hidden />
      <div className={cn("flex items-start gap-1 ps-1", compact && "items-center")}>
        {block.laneKind === "facility" ? (
          <MonitorCog className="mt-0.5 h-3 w-3 shrink-0 opacity-70" />
        ) : (
          <Stethoscope className="mt-0.5 h-3 w-3 shrink-0 opacity-70" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold leading-tight">{block.laneName}</p>
          {!compact && (
            <>
              <p className="truncate text-[10px] leading-tight opacity-70">{block.deptName}</p>
              <p dir="ltr" className="mt-0.5 text-[10px] font-medium tabular-nums opacity-80">
                {formatMin(startMin)}–{formatMin(endMin)}
              </p>
            </>
          )}
        </div>
        {!block.editable && (
          block.origin === "exception" ? (
            <Lock className="h-2.5 w-2.5 shrink-0 opacity-60" />
          ) : (
            <Link2 className="h-2.5 w-2.5 shrink-0 opacity-60" />
          )
        )}
      </div>

      {/* resize handle (editable only) */}
      {block.editable && (
        <span
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            onPointerDownResize(e);
          }}
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100"
        >
          <span className="mx-auto block h-0.5 w-6 translate-y-[3px] rounded-full bg-current opacity-40" />
        </span>
      )}
    </div>
  );
}

function FloatingPreview({
  block,
  color,
  top,
  height,
  startMin,
  endMin,
}: {
  block: CalendarBlock;
  color: DeptColor;
  top: number;
  height: number;
  startMin: number;
  endMin: number;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute z-40 overflow-hidden rounded-lg border py-1 ps-2 pe-1 opacity-90 shadow-lg ring-2 ring-offset-1",
        color.block,
        color.ring
      )}
      style={{ top, height: Math.max(height, 18), left: "2px", right: "2px" }}
    >
      <span className={cn("absolute inset-y-0 start-0 w-1", color.accent)} aria-hidden />
      <p className="truncate ps-1 text-[11px] font-semibold leading-tight">{block.laneName}</p>
      <p dir="ltr" className="ps-1 text-[10px] font-medium tabular-nums opacity-80">
        {formatMin(startMin)}–{formatMin(endMin)}
      </p>
    </div>
  );
}
