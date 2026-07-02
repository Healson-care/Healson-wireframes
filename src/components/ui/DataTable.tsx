"use client";

import { ReactNode, useMemo, useState } from "react";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/Misc";
import { Skeleton } from "@/components/ui/Skeleton";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectedIdsChange?: (ids: Set<string>) => void;
  bulkActions?: (selectedIds: string[], clearSelection: () => void) => ReactNode;
  rowActions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
}

type SortDir = "asc" | "desc";

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyTitle = "אין נתונים",
  emptyDescription,
  emptyIcon,
  selectable,
  selectedIds,
  onSelectedIdsChange,
  bulkActions,
  rowActions,
  onRowClick,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir, columns]);

  function toggleSort(col: DataTableColumn<T>) {
    if (!col.sortable) return;
    if (sortKey !== col.key) {
      setSortKey(col.key);
      setSortDir("asc");
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    }
  }

  function toggleRow(id: string) {
    if (!onSelectedIdsChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedIdsChange(next);
  }

  function toggleAll() {
    if (!onSelectedIdsChange) return;
    const allSelected = selectedIds && sortedRows.every((r) => selectedIds.has(rowKey(r)));
    if (allSelected) onSelectedIdsChange(new Set());
    else onSelectedIdsChange(new Set(sortedRows.map(rowKey)));
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (sortedRows.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  const selectedCount = selectedIds?.size ?? 0;
  const allOnPageSelected = !!selectedIds && sortedRows.every((r) => selectedIds.has(rowKey(r)));

  return (
    <div className="flex flex-col gap-2">
      {selectable && selectedCount > 0 && bulkActions && (
        <div className="flex items-center justify-between rounded-lg border border-info-border bg-info-bg px-3 py-2 text-sm">
          <span className="font-medium text-info-text">{selectedCount} נבחרו</span>
          <div className="flex items-center gap-2">
            {bulkActions([...selectedIds!], () => onSelectedIdsChange?.(new Set()))}
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              {selectable && (
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-slate-300 accent-primary"
                    aria-label="בחר הכל"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-2.5 text-right text-xs font-semibold text-slate-500 whitespace-nowrap",
                    col.sortable && "cursor-pointer select-none hover:text-slate-800",
                    col.className
                  )}
                  onClick={() => toggleSort(col)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable &&
                      (sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 text-slate-300" />
                      ))}
                  </span>
                </th>
              ))}
              {rowActions && <th className="w-10 px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const id = rowKey(row);
              const checked = !!selectedIds?.has(id);
              return (
                <tr
                  key={id}
                  className={cn(
                    "border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50/80",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRow(id)}
                        className="h-4 w-4 rounded border-slate-300 accent-primary"
                        aria-label="בחר שורה"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-3 py-2.5 align-middle", col.className)}>
                      {col.render ? col.render(row) : null}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-3 py-2.5 text-left" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">{rowActions(row)}</div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
