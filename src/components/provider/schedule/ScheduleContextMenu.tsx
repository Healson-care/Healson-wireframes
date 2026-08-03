"use client";

import { Copy, Info, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarBlock } from "@/lib/schedule-calendar";

/** Right-click actions on an availability block, shared by the unit and solo
 * calendars. A locked block (shared לו״ז / date exception) can't be edited from
 * here, so it only offers the explanation of where it IS edited. */
export function ScheduleContextMenu({
  menu,
  selectedCount = 0,
  detailsLabel = "פרטי המשמרת",
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  onDetails,
  onDeleteSelected,
}: {
  menu: { block: CalendarBlock; x: number; y: number };
  selectedCount?: number;
  detailsLabel?: string;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDetails: () => void;
  onDeleteSelected?: () => void;
}) {
  const { block, x, y } = menu;
  // Keep the menu inside the viewport.
  const left = Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 200);
  const top = Math.min(y, (typeof window !== "undefined" ? window.innerHeight : 800) - 220);
  const item =
    "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-sm text-slate-700 hover:bg-slate-100";
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => e.preventDefault()} />
      <div
        className="fixed z-50 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
        style={{ left, top }}
        onClick={onClose}
      >
        {block.editable ? (
          <>
            <button type="button" className={item} onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5 text-slate-400" /> עריכה
            </button>
            <button type="button" className={item} onClick={onDuplicate}>
              <Copy className="h-3.5 w-3.5 text-slate-400" /> שכפול
            </button>
            <button type="button" className={cn(item, "text-danger hover:bg-danger-bg")} onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" /> מחיקה
            </button>
            {selectedCount > 1 && onDeleteSelected && (
              <>
                <div className="my-1 h-px bg-slate-100" />
                <button
                  type="button"
                  className={cn(item, "text-danger hover:bg-danger-bg")}
                  onClick={onDeleteSelected}
                >
                  <Trash2 className="h-3.5 w-3.5" /> מחיקת הנבחרים ({selectedCount})
                </button>
              </>
            )}
          </>
        ) : (
          <button type="button" className={item} onClick={onDetails}>
            <Info className="h-3.5 w-3.5 text-slate-400" /> {detailsLabel}
          </button>
        )}
      </div>
    </>
  );
}
