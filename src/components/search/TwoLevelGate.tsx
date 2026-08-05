"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { GateTrigger } from "@/components/search/GateTrigger";
import { OptionSearch } from "@/components/search/OptionSearch";
import { cn } from "@/lib/utils";
import { FilterDef, SearchContext, SearchQuery, facetCount, gateOptions, toggleMulti } from "@/lib/search";

/**
 * A gate with two levels — תחום › תת-תחום, מיקום › עיר. Picking a parent opens
 * its children inline, underneath it, rather than on a second screen: a child
 * only means anything in the context of its parent, and showing them together
 * is what makes "ברך" readable as "אורתופדיה › ברך", or "תל אביב" as a place
 * inside המרכז.
 *
 * Both levels are ordinary registry filters, so matching and facet counts come
 * from the same engine as every other filter. The one rule this control adds
 * is that a child never outlives its parent — un-checking אורתופדיה drops ברך
 * with it, or the search would keep narrowing by something no longer on screen.
 */
export function TwoLevelGate({
  parentDef,
  childDef,
  parentOf,
  placeholder,
  emptyLabel,
  noChildrenLabel,
  query,
  onChange,
  ctx,
}: {
  parentDef: FilterDef;
  childDef?: FilterDef;
  /** Which parent a child value belongs to. */
  parentOf: (childValue: string) => string | undefined;
  placeholder: string;
  emptyLabel: string;
  noChildrenLabel: string;
  query: SearchQuery;
  onChange: (next: SearchQuery) => void;
  ctx: SearchContext;
}) {
  const [text, setText] = useState("");
  const term = text.trim();
  const parentKey = parentDef.key;
  const childKey = childDef?.key;

  const allParents = gateOptions(parentDef, query, ctx);
  const children = childDef ? gateOptions(childDef, query, ctx) : [];

  // Typing reaches both levels: "ברך" finds אורתופדיה even though the word
  // isn't in its name. A parent matched by its own name keeps all its children;
  // one matched through a child shows only the children that hit.
  const parents = term
    ? allParents.filter(
        (p) => p.label.includes(term) || children.some((c) => parentOf(c.value) === p.value && c.label.includes(term))
      )
    : allParents;
  const childrenFor = (parentValue: string) => {
    const own = children.filter((c) => parentOf(c.value) === parentValue);
    if (!term) return own;
    const parentMatched = allParents.find((p) => p.value === parentValue)?.label.includes(term);
    return parentMatched ? own : own.filter((c) => c.label.includes(term));
  };

  const selectedParents = Array.isArray(query.filters[parentKey]) ? (query.filters[parentKey] as string[]) : [];
  const selectedChildren =
    childKey && Array.isArray(query.filters[childKey]) ? (query.filters[childKey] as string[]) : [];
  const active = selectedParents.length > 0;

  const setFilters = (next: Record<string, string[] | undefined>) =>
    onChange({ ...query, filters: { ...query.filters, ...next } });

  function toggleParent(value: string) {
    const nextParents = toggleMulti(query.filters[parentKey], value);
    // Dropped the parent → drop whatever hung off it.
    const nextChildren = nextParents.includes(value)
      ? selectedChildren
      : selectedChildren.filter((c) => parentOf(c) !== value);
    setFilters({
      [parentKey]: nextParents.length ? nextParents : undefined,
      ...(childKey ? { [childKey]: nextChildren.length ? nextChildren : undefined } : {}),
    });
  }

  function toggleChild(value: string) {
    if (!childKey) return;
    const next = toggleMulti(query.filters[childKey], value);
    setFilters({ [childKey]: next.length ? next : undefined });
  }

  const labelOf = (value: string) => allParents.find((p) => p.value === value)?.label ?? value;
  const childLabelOf = (value: string) => children.find((c) => c.value === value)?.label ?? value;

  // Once something is chosen the value matters more than the axis name. One
  // parent with one child reads as the path it is.
  const summary =
    selectedParents.length === 1 && selectedChildren.length === 1
      ? `${labelOf(selectedParents[0])} · ${childLabelOf(selectedChildren[0])}`
      : labelOf(selectedParents[0] ?? "");
  const extra = selectedParents.length - 1;

  // Nothing left to ask on either level — one parent reachable, and no child
  // choice inside it. The segment greys out and states the answer, but still
  // opens: that's where she undoes what decided it.
  const choosable = allParents.filter(
    (p) => facetCount(query, parentKey, toggleMulti(query.filters[parentKey], p.value), ctx) > 0
  );
  const only = choosable.length === 1 ? choosable[0] : undefined;
  const constrained =
    !active && choosable.length <= 1 && (!only || children.filter((c) => parentOf(c.value) === only.value).length <= 1);

  return (
    <Popover
      trigger={
        <button type="button" className="focus-ring block w-full">
          <GateTrigger
            axis={parentDef.group}
            value={active ? summary : constrained ? only?.label ?? "אין אפשרויות" : "הכל"}
            active={active}
            muted={constrained}
            extra={extra}
          />
        </button>
      }
    >
      {() => (
        <div className="py-1">
          <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold text-slate-500">{parentDef.group}</p>
          {constrained && (
            <p className="px-3 pb-1 text-[11px] text-slate-400">נקבע לפי הבחירות האחרות — אפשר לבטל אותן ולחזור.</p>
          )}
          <OptionSearch value={text} onChange={setText} placeholder={placeholder} />
          {parents.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400">{term ? "לא נמצאו תוצאות" : emptyLabel}</p>
          )}

          {/* Two open levels make the longest list in the search — cap it
              rather than let the panel run past the bottom of the screen. */}
          <div className="max-h-[55vh] overflow-y-auto">
            {parents.map((opt) => {
              const isOn = selectedParents.includes(opt.value);
              const count = facetCount(query, parentKey, toggleMulti(query.filters[parentKey], opt.value), ctx);
              const own = isOn ? childrenFor(opt.value) : [];

              return (
                <div key={opt.value}>
                  <OptionRow
                    label={opt.label}
                    count={count}
                    checked={isOn}
                    disabled={!isOn && count === 0}
                    onClick={() => toggleParent(opt.value)}
                  />

                  {/* The children of a chosen parent, indented under it. A
                      parent whose items carry none simply has none — that's a
                      fact about the catalogue, not an error. */}
                  {isOn && childKey && (
                    <div className="border-e-2 border-[var(--brand-navy)]/15 pe-3">
                      {own.length === 0 ? (
                        <p className="px-3 py-1.5 text-[11px] text-slate-400">{noChildrenLabel}</p>
                      ) : (
                        own.map((child) => {
                          const childCount = facetCount(
                            query,
                            childKey,
                            toggleMulti(query.filters[childKey], child.value),
                            ctx
                          );
                          const childOn = selectedChildren.includes(child.value);
                          return (
                            <OptionRow
                              key={child.value}
                              label={child.label}
                              small
                              count={childCount}
                              checked={childOn}
                              disabled={!childOn && childCount === 0}
                              onClick={() => toggleChild(child.value)}
                            />
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {active && (
            <button
              type="button"
              onClick={() =>
                setFilters({ [parentKey]: undefined, ...(childKey ? { [childKey]: undefined } : {}) })
              }
              className="focus-ring mt-1 w-full border-t border-slate-100 px-3 py-2 text-right text-xs font-medium text-[var(--brand-navy)]"
            >
              ניקוי
            </button>
          )}
        </div>
      )}
    </Popover>
  );
}

function OptionRow({
  label,
  count,
  checked,
  disabled,
  small,
  onClick,
}: {
  label: string;
  count: number;
  checked: boolean;
  disabled: boolean;
  small?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "focus-ring flex w-full items-center justify-between gap-2 px-3 text-right hover:bg-slate-50",
        small ? "py-2 text-[13px] text-slate-600" : "py-2.5 text-sm",
        checked && "font-semibold text-[var(--brand-navy)]",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent"
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded border",
            small ? "h-3.5 w-3.5" : "h-4 w-4",
            checked ? "border-[var(--brand-navy)] bg-[var(--brand-navy)] text-white" : "border-slate-300"
          )}
        >
          {checked && <Check className={small ? "h-2.5 w-2.5" : "h-3 w-3"} />}
        </span>
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-xs text-slate-400">({count})</span>
    </button>
  );
}
