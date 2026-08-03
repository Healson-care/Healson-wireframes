"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { isoDate } from "@/lib/calendar";
import {
  APPOINTMENT_STATUS_COLORS,
  ApptBlock,
  OpenBand,
  groupAndPack,
  isInsideBands,
  timeRangeLabel,
} from "@/lib/appointment-calendar";
import { HOUR_PX, MIN_BLOCK_MIN, clampMin, snap, timeBounds } from "@/lib/schedule-calendar";
import { Appointment, isCancelledAppointment } from "@/types";
import { getAppointmentPaymentState } from "@/lib/appointment-payments";
import { AlertTriangle, Building2, Lock, User, Wallet } from "lucide-react";

/** Payment states that mean somebody still owes something on this booking. */
function paymentIsOutstanding(a: Appointment): boolean {
  const state = getAppointmentPaymentState(a);
  return state === "ממתין למקדמה" || state === "ממתין להתחייבות" || state === "יתרה ממתינה";
}

/** One column of the grid. In week view a column is a DATE; in a unit's day
 * view it's an עמדה (same date, one queue each) — the classic clinic day
 * board. `laneId` is set only in the second case. */
export interface ApptGridColumn {
  key: string;
  date: Date;
  title: string;
  subtitle?: string;
  laneId?: string;
  isToday: boolean;
  /** Small colour dot identifying the lane (its מערך for a unit, the מרפאה /
   * יחידה for a solo diary) — the same colour as its blocks' rail. */
  dotClass?: string;
  /** Caption shown under a read-only column, naming who runs it. */
  ownerNote?: string;
  /** Locked columns (e.g. "ללא עמדה") accept no new bookings. */
  readOnly?: boolean;
  /** The hours opened for booking in this column (its lane's shifts for the
   * date, or the union across lanes when the column shows several). */
  openBands?: OpenBand[];
  /** A fully blocked date (חופשה/חג) — the whole column is closed, whatever the
   * weekly template says. */
  blockedReason?: string;
}

/** Where a dragged appointment landed. */
export interface DropTarget {
  date: string;
  startMin: number;
  laneId?: string;
}

interface DragState {
  block: ApptBlock;
  mode: "move" | "resize";
  startClientX: number;
  startClientY: number;
  dur: number;
  previewStartMin: number;
  previewEndMin: number;
  previewColIndex: number;
  moved: boolean;
}

/** The day/week time grid of real appointments. Geometry (hour height, snap,
 * column packing) is shared with the availability calendar so both read alike;
 * what differs is that a block here is one concrete booking — dragging it
 * reschedules that patient, and nothing else. */
export function AppointmentTimeGrid({
  columns,
  blocks,
  columnKeyOf,
  canCreate,
  showOpenHours = true,
  onCreate,
  onOpen,
  onMove,
  onResize,
}: {
  columns: ApptGridColumn[];
  blocks: ApptBlock[];
  columnKeyOf: (b: ApptBlock) => string;
  canCreate: boolean;
  /** Paint each column's opened shifts behind the appointments. */
  showOpenHours?: boolean;
  onCreate: (target: DropTarget) => void;
  onOpen: (block: ApptBlock) => void;
  onMove: (block: ApptBlock, target: DropTarget) => void;
  onResize: (block: ApptBlock, endMin: number) => void;
}) {
  const byColumn = useMemo(() => groupAndPack(blocks, columnKeyOf), [blocks, columnKeyOf]);
  // The visible window must cover the opened shifts too, not just the booked
  // hours — otherwise a shift with no bookings yet would be invisible.
  const bounds = useMemo(
    () =>
      timeBounds([
        ...blocks,
        ...(showOpenHours ? columns.flatMap((c) => c.openBands ?? []) : []),
      ]),
    [blocks, columns, showOpenHours]
  );
  const pxPerMin = HOUR_PX / 60;
  const gridHeight = (bounds.endMin - bounds.startMin) * pxPerMin;
  const startHour = Math.floor(bounds.startMin / 60);
  const endHour = Math.ceil(bounds.endMin / 60);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Swallows the click that trails a drag ending on a column, which would
  // otherwise pop the "new appointment" dialog.
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

  const topFor = (min: number) =>
    (clampMin(min, bounds.startMin, bounds.endMin) - bounds.startMin) * pxPerMin;

  // Drag lifecycle on window listeners — the pointer routinely leaves the block.
  useEffect(() => {
    if (!drag) return;
    const onPointerMove = (e: PointerEvent) => {
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
        // Move: vertical = time, horizontal = another column (another date in
        // week view, another עמדה in a unit's day view).
        let colIndex = prev.previewColIndex;
        for (let i = 0; i < columns.length; i++) {
          const r = colRefs.current[i]?.getBoundingClientRect();
          if (r && e.clientX >= r.left && e.clientX <= r.right) {
            if (!columns[i].readOnly) colIndex = i;
            break;
          }
        }
        const start = clampMin(
          prev.block.startMin + deltaMin,
          bounds.startMin,
          bounds.endMin - prev.dur
        );
        return {
          ...prev,
          previewStartMin: start,
          previewEndMin: start + prev.dur,
          previewColIndex: colIndex,
          moved,
        };
      });
    };
    const onPointerUp = () => {
      // `drag` is fresh: the effect re-subscribes on every drag change. Side
      // effects stay OUT of the state updater (React runs updaters in render).
      const prev = drag;
      if (!prev) return;
      if (!prev.moved) {
        onOpen(prev.block);
        setDrag(null);
        return;
      }
      didDragRef.current = true;
      const col = columns[prev.previewColIndex];
      if (prev.mode === "resize") {
        if (prev.previewEndMin !== prev.block.endMin) onResize(prev.block, prev.previewEndMin);
      } else if (col) {
        const target: DropTarget = {
          date: isoDate(col.date),
          startMin: prev.previewStartMin,
          laneId: col.laneId,
        };
        const unchanged =
          target.date === prev.block.date &&
          target.startMin === prev.block.startMin &&
          (target.laneId ?? prev.block.laneId) === prev.block.laneId;
        if (!unchanged) onMove(prev.block, target);
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [drag, columns, pxPerMin, bounds.startMin, bounds.endMin, onMove, onResize, onOpen]);

  function startDrag(e: React.PointerEvent, block: ApptBlock, mode: "move" | "resize", colIndex: number) {
    if (!block.editable) return; // locked blocks resolve their click inline
    e.stopPropagation();
    setDrag({
      block,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      dur: block.endMin - block.startMin,
      previewStartMin: block.startMin,
      previewEndMin: block.endMin,
      previewColIndex: colIndex,
      moved: false,
    });
  }

  return (
    <div
      className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
      style={{ maxHeight: "72vh" }}
    >
      <div
        className="grid min-w-fit"
        style={{
          gridTemplateColumns: `3.25rem repeat(${columns.length}, minmax(${
            columns.length > 3 ? "6rem" : "9rem"
          }, 1fr))`,
        }}
      >
        {/* Header row */}
        <div className="sticky start-0 top-0 z-30 border-b border-e border-slate-200 bg-white" />
        {columns.map((col) => (
          <div
            key={`h-${col.key}`}
            className={cn(
              "sticky top-0 z-20 border-b border-e border-slate-200 bg-white px-2 py-1.5 text-center",
              col.isToday && "bg-primary/5"
            )}
          >
            <p className="flex items-center justify-center gap-1 truncate text-[11px] font-semibold text-slate-600">
              {col.dotClass && <span className={cn("h-2 w-2 shrink-0 rounded-full", col.dotClass)} />}
              <span className="truncate">{col.title}</span>
            </p>
            {col.subtitle && (
              <p
                className={cn(
                  "mx-auto mt-0.5 truncate text-[10px] text-slate-400",
                  col.isToday && !col.laneId && "font-semibold text-primary"
                )}
              >
                {col.subtitle}
              </p>
            )}
            {col.ownerNote && (
              <p className="mx-auto mt-0.5 flex items-center justify-center gap-0.5 truncate rounded bg-slate-100 px-1 text-[9px] font-medium text-slate-500">
                <Lock className="h-2 w-2 shrink-0" />
                {col.ownerNote}
              </p>
            )}
            {col.blockedReason && (
              <p
                title={col.blockedReason}
                className="mx-auto mt-0.5 truncate rounded bg-slate-100 px-1 text-[9px] font-medium text-slate-500"
              >
                {col.blockedReason}
              </p>
            )}
          </div>
        ))}

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

        {/* Columns */}
        {columns.map((col, colIndex) => {
          const iso = isoDate(col.date);
          const isToday = iso === todayIso;
          const colBlocks = byColumn.get(col.key) ?? [];
          return (
            <div
              key={`c-${col.key}`}
              ref={(el) => {
                colRefs.current[colIndex] = el;
              }}
              className={cn(
                "relative border-e border-slate-100",
                isToday && "bg-primary/[0.03]",
                col.readOnly && "bg-slate-50/70"
              )}
              style={{ height: gridHeight }}
              onClick={(e) => {
                if (didDragRef.current) {
                  didDragRef.current = false;
                  return;
                }
                if (!canCreate || col.readOnly) return;
                if (e.currentTarget !== e.target) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const min = snap(bounds.startMin + (e.clientY - rect.top) / pxPerMin);
                onCreate({
                  date: iso,
                  startMin: clampMin(min, bounds.startMin, bounds.endMin - 30),
                  laneId: col.laneId,
                });
              }}
            >
              {/* The shifts this provider opened, painted UNDER everything —
                  closed hours are hatched, open hours are clear, breaks are
                  struck through. Pointer-events off so click-to-book still
                  targets the column itself. */}
              {showOpenHours && (
                <div className="pointer-events-none absolute inset-0" aria-hidden>
                  <div className="absolute inset-0" style={CLOSED_HATCH} />
                  {!col.blockedReason &&
                    (col.openBands ?? []).map((band, i) => (
                      <div
                        key={`band-${i}`}
                        className="absolute inset-x-0 bg-white"
                        style={{
                          top: topFor(band.startMin),
                          height: Math.max(0, topFor(band.endMin) - topFor(band.startMin)),
                        }}
                      >
                        <span className="absolute inset-y-0 start-0 w-[3px] bg-primary/25" />
                        {band.label && topFor(band.endMin) - topFor(band.startMin) > 26 && (
                          <span className="absolute end-1 top-0.5 max-w-[85%] truncate rounded bg-primary/5 px-1 text-[9px] font-medium text-primary/70">
                            {band.label}
                          </span>
                        )}
                        {(band.breaks ?? []).map((br, bi) => (
                          <div
                            key={`br-${bi}`}
                            className="absolute inset-x-0"
                            style={{
                              ...BREAK_HATCH,
                              top: topFor(br.startMin) - topFor(band.startMin),
                              height: Math.max(0, topFor(br.endMin) - topFor(br.startMin)),
                            }}
                          />
                        ))}
                      </div>
                    ))}
                </div>
              )}

              {hours.map((h) => (
                <div
                  key={h}
                  className="pointer-events-none absolute inset-x-0 border-t border-slate-100"
                  style={{ top: (h * 60 - bounds.startMin) * pxPerMin }}
                />
              ))}

              {isToday && nowMin >= bounds.startMin && nowMin <= bounds.endMin && (
                <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: topFor(nowMin) }}>
                  <div className="relative border-t-2 border-rose-500">
                    <span className="absolute -top-1 start-0 h-2 w-2 -translate-x-1/2 rounded-full bg-rose-500 rtl:translate-x-1/2" />
                  </div>
                </div>
              )}

              {colBlocks.map((b) => {
                const isDragged = drag?.block.key === b.key;
                if (isDragged && drag?.mode === "move") return null;
                const endMin = isDragged && drag?.mode === "resize" ? drag.previewEndMin : b.endMin;
                // Only OUR bookings are judged against OUR shifts — a unit's
                // reflection is governed by the unit's hours, not ours.
                const outsideHours =
                  showOpenHours &&
                  b.owned &&
                  !isCancelledAppointment(b.status) &&
                  (!!col.blockedReason || !isInsideBands(col.openBands ?? [], b.startMin, endMin));
                return (
                  <AppointmentBlockView
                    key={b.key}
                    block={b}
                    top={topFor(b.startMin)}
                    height={(endMin - b.startMin) * pxPerMin}
                    startMin={b.startMin}
                    endMin={endMin}
                    showLane={!col.laneId}
                    outsideHours={outsideHours}
                    dragging={isDragged}
                    onPointerDownMove={(e) => startDrag(e, b, "move", colIndex)}
                    onPointerDownResize={(e) => startDrag(e, b, "resize", colIndex)}
                    onOpen={() => onOpen(b)}
                  />
                );
              })}

              {drag?.mode === "move" && drag.previewColIndex === colIndex && (
                <FloatingPreview
                  block={drag.block}
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

// Hours that were never opened for booking — a hatch quiet enough to sit under
// coloured blocks, distinct enough that "open" reads as a clear white window.
const CLOSED_HATCH: React.CSSProperties = {
  // Slightly translucent so today's column tint still shows through.
  backgroundColor: "rgba(248,250,252,0.85)",
  backgroundImage:
    "repeating-linear-gradient(45deg, rgba(148,163,184,0.10) 0, rgba(148,163,184,0.10) 4px, transparent 4px, transparent 9px)",
};

// A break inside an open shift — same language, one shade stronger.
const BREAK_HATCH: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(45deg, rgba(148,163,184,0.20) 0, rgba(148,163,184,0.20) 3px, transparent 3px, transparent 7px)",
};

function AppointmentBlockView({
  block,
  top,
  height,
  startMin,
  endMin,
  showLane,
  outsideHours,
  dragging,
  onPointerDownMove,
  onPointerDownResize,
  onOpen,
}: {
  block: ApptBlock;
  top: number;
  height: number;
  startMin: number;
  endMin: number;
  showLane: boolean;
  outsideHours?: boolean;
  dragging: boolean;
  onPointerDownMove: (e: React.PointerEvent) => void;
  onPointerDownResize: (e: React.PointerEvent) => void;
  onOpen: () => void;
}) {
  const color = APPOINTMENT_STATUS_COLORS[block.status];
  const compact = height < 42;
  const widthPct = 100 / block.colCount;
  const rightPct = (block.col * 100) / block.colCount;
  const a = block.appt;
  return (
    <div
      role="button"
      tabIndex={0}
      title={`${a.client_name} · ${a.service_name} · ${timeRangeLabel(startMin, endMin)}${
        outsideHours ? " · מחוץ למשמרות שנפתחו" : ""
      }`}
      className={cn(
        "group absolute overflow-hidden rounded-lg border ps-1.5 pe-1 py-1 text-start shadow-sm transition-shadow",
        color.block,
        block.editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        dragging && cn("z-40 shadow-lg ring-2 ring-offset-1", color.ring),
        !block.owned && "border-dashed"
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
        // Editable blocks resolve click-vs-drag on the grid's window pointerup;
        // locked ones (reflections, cancelled) have no drag lifecycle at all.
        if (!block.editable) {
          e.stopPropagation();
          onOpen();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {/* Rail = where (מרפאה / יחידה / מערך), fill = status. */}
      <span className={cn("absolute inset-y-0 start-0 w-1", block.railClass ?? color.accent)} aria-hidden />
      <div className={cn("flex items-start gap-1 ps-1", compact && "items-center")}>
        {block.owned ? (
          <User className="mt-0.5 h-3 w-3 shrink-0 opacity-70" />
        ) : (
          <Building2 className="mt-0.5 h-3 w-3 shrink-0 opacity-70" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold leading-tight">{a.client_name}</p>
          {!compact && (
            <>
              <p className="truncate text-[10px] leading-tight opacity-70">{a.service_name}</p>
              <p dir="ltr" className="mt-0.5 text-[10px] font-medium tabular-nums opacity-80">
                {timeRangeLabel(startMin, endMin)}
              </p>
            </>
          )}
          {!compact && showLane && block.laneName && (
            <p className="truncate text-[10px] leading-tight opacity-60">{block.laneName}</p>
          )}
        </div>
        {/* Money still outstanding on this booking (payments meeting §7) — a
            deposit, a commitment document or the balance. The status fill
            already carries the lifecycle; this is the one extra bit a provider
            scans a day board for. */}
        {block.owned && paymentIsOutstanding(a) && (
          <Wallet
            className="h-2.5 w-2.5 shrink-0 opacity-70"
            aria-label={getAppointmentPaymentState(a)}
          />
        )}
        {!block.owned ? (
          <Lock className="h-2.5 w-2.5 shrink-0 opacity-50" />
        ) : isCancelledAppointment(block.status) ? (
          <Lock className="h-2.5 w-2.5 shrink-0 opacity-60" />
        ) : (
          outsideHours && <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-amber-600" />
        )}
      </div>

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
  top,
  height,
  startMin,
  endMin,
}: {
  block: ApptBlock;
  top: number;
  height: number;
  startMin: number;
  endMin: number;
}) {
  const color = APPOINTMENT_STATUS_COLORS[block.status];
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
      <p className="truncate ps-1 text-[11px] font-semibold leading-tight">{block.appt.client_name}</p>
      <p dir="ltr" className="ps-1 text-[10px] font-medium tabular-nums opacity-80">
        {timeRangeLabel(startMin, endMin)}
      </p>
    </div>
  );
}
