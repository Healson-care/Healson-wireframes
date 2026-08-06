"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { OptionSearch } from "@/components/search/OptionSearch";
import { cn } from "@/lib/utils";
import {
  FilterDef,
  FilterValue,
  SearchContext,
  SearchQuery,
  facetCount,
  filterOptions,
  isActive,
  toggleMulti,
  visibleFilters,
} from "@/lib/search";

const COLLAPSED_OPTION_COUNT = 4;

/**
 * The whole filter surface, rendered from FILTER_REGISTRY rather than written
 * out screen by screen. Every option carries a live facet count, so the
 * patient can see what a choice would cost her before making it — and a new
 * filter appears here the moment it's declared in the registry.
 */
export function FilterSheet({
  open,
  onClose,
  query,
  onChange,
  ctx,
  resultCount,
  onClearAll,
}: {
  open: boolean;
  onClose: () => void;
  query: SearchQuery;
  onChange: (next: SearchQuery) => void;
  ctx: SearchContext;
  resultCount: number;
  onClearAll: () => void;
}) {
  // The live filter values go in so that a switched-on filter can never be
  // hidden by the relevance test — see visibleFilters.
  const defs = useMemo(() => visibleFilters(ctx.offers, query.filters), [ctx.offers, query.filters]);
  // Undefined for a group = "not touched yet", so it can fall back to
  // auto-opening when it holds an active filter.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const map = new Map<string, FilterDef[]>();
    for (const def of defs) {
      const list = map.get(def.group);
      if (list) list.push(def);
      else map.set(def.group, [def]);
    }
    return Array.from(map.entries());
  }, [defs]);

  function setValue(key: string, value: FilterValue) {
    onChange({ ...query, filters: { ...query.filters, [key]: value } });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="סינון"
      description="הספירות מתעדכנות לפי מה שכבר סימנתם"
      // Height is set on the PANEL, not on inner content — a min-height on a
      // child can't grow a parent that sizes to its content, which is why the
      // sheet kept opening as a short strip. 85vh on a phone, content-sized
      // from sm up where a tall modal would look odd.
      // Full screen on a phone, not a sheet clinging to the bottom edge: the
      // filters ARE the task while they're open, and a strip anchored low with
      // dead space above it reads as an afterthought. max-h-none is required —
      // Dialog caps at 85vh, and a max-height would otherwise beat the height.
      // Nearly the whole screen on a phone — the filters ARE the task while
      // they're open. max-h-none is required: Dialog caps at 85vh, and a
      // max-height always beats a height.
      className="h-[88vh] max-h-none bg-slate-50 sm:h-[78vh] sm:max-h-[90vh]"
    >
    <div className="flex h-full flex-col">
      <div className="flex justify-end -mt-2 mb-3">
        <button
          onClick={onClearAll}
          className="focus-ring rounded-md px-1.5 py-1 text-sm font-medium text-[var(--brand-navy)]"
        >
          נקה הכל
        </button>
      </div>

      {/* Accordion, not a flat list: with this many groups a phone would
          otherwise be a single endless scroll with no sense of what's where.
          A group opens on its own if something inside it is already active. */}
      <div className="mb-3 flex-1 overflow-y-auto divide-y divide-slate-200 border-y border-slate-200">
        {groups.map(([groupName, groupDefs]) => {
          const activeInGroup = groupDefs.filter((d) => isActive(query.filters[d.key])).length;
          const open = openGroups[groupName] ?? activeInGroup > 0;
          return (
            <section key={groupName}>
              <button
                onClick={() => setOpenGroups((prev) => ({ ...prev, [groupName]: !open }))}
                aria-expanded={open}
                className="focus-ring flex min-h-12 w-full items-center justify-between gap-2 py-3 text-right"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-[var(--brand-navy)]">
                  {groupName}
                  {activeInGroup > 0 && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {activeInGroup}
                    </span>
                  )}
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
              </button>
              {open && (
                <div className="space-y-3 pb-4">
                  {groupDefs.map((def) => (
                    <FilterControl key={def.key} def={def} query={query} ctx={ctx} onSetValue={setValue} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Sticky apply bar — the count is the whole point: it tells her what
          she's about to get without closing the sheet first. */}
      {/* pb keeps the button clear of the home-bar on a modern phone. */}
      <div className="sticky bottom-0 -mx-5 border-t border-slate-200 bg-slate-50/95 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <button
          onClick={onClose}
          disabled={resultCount === 0}
          className="focus-ring h-12 w-full rounded-xl bg-gradient-to-b from-[var(--brand-navy-700)] to-[var(--brand-navy)] text-sm font-semibold text-white shadow-[0_14px_28px_-14px_rgba(15,33,64,0.9)] disabled:bg-none disabled:bg-slate-300 disabled:shadow-none"
        >
          {resultCount === 0 ? "אין תוצאות — נסו להסיר מסנן" : `הצג ${resultCount} תוצאות`}
        </button>
      </div>
    </div>
    </Dialog>
  );
}

function FilterControl({
  def,
  query,
  ctx,
  onSetValue,
}: {
  def: FilterDef;
  query: SearchQuery;
  ctx: SearchContext;
  onSetValue: (key: string, value: FilterValue) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const current = query.filters[def.key];

  if (def.type === "toggle") {
    const active = current === true;
    const count = facetCount(query, def.key, true, ctx);
    return (
      <OptionChip
        label={def.label ?? def.key}
        count={count}
        active={active}
        disabled={!active && count === 0}
        onClick={() => onSetValue(def.key, active ? undefined : true)}
      />
    );
  }

  const all = filterOptions(def, ctx);
  const term = text.trim();
  const options = term ? all.filter((o) => o.label.includes(term)) : all;
  // A search term is already a narrowing — collapsing its results behind
  // "הצג עוד" would hide the very thing she typed to find.
  const visible = def.collapsible && !expanded && !term ? options.slice(0, COLLAPSED_OPTION_COUNT) : options;
  const hiddenCount = options.length - visible.length;

  return (
    <div>
      {def.label && <p className="mb-1.5 text-xs text-slate-500">{def.label}</p>}
      {/* Only the long lists get a search box — a field above four chips is
          more furniture than help. */}
      {def.collapsible && (
        <div className="-mx-3 mb-2">
          <OptionSearch value={text} onChange={setText} placeholder={`חיפוש ב${def.label ?? def.group}`} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {def.type === "single" && (
          <OptionChip
            label="הכל"
            active={!current}
            onClick={() => onSetValue(def.key, undefined)}
          />
        )}
        {visible.map((opt) => {
          const active =
            def.type === "multi"
              ? Array.isArray(current) && current.includes(opt.value)
              : current === opt.value;
          // What the value would become if she tapped this — the count has to
          // answer "how many if I pick this", not "how many match it alone".
          const probe: FilterValue =
            def.type === "multi" ? toggleMulti(current, opt.value) : active ? undefined : opt.value;
          const count = facetCount(query, def.key, probe, ctx);
          return (
            <OptionChip
              key={opt.value}
              label={opt.label}
              count={count}
              active={active}
              disabled={!active && count === 0}
              onClick={() => onSetValue(def.key, probe)}
            />
          );
        })}
        {hiddenCount > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="focus-ring h-10 rounded-full px-3 text-sm font-medium text-primary underline sm:h-8 sm:text-xs"
          >
            הצג עוד ({hiddenCount})
          </button>
        )}
      </div>
    </div>
  );
}

function OptionChip({
  label,
  count,
  active,
  disabled,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        // 40px tall on touch screens — a 32px chip is under the comfortable
        // tap target and these are the main controls of the whole sheet.
        "focus-ring inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors sm:h-8 sm:px-3 sm:text-xs",
        active
          ? "border-[var(--brand-navy)]/25 bg-[var(--brand-navy)]/8 text-[var(--brand-navy)]"
          : "border-slate-200 bg-white text-[var(--brand-ink-soft)] hover:border-[var(--brand-navy)]/25",
        disabled && "cursor-not-allowed opacity-40 hover:border-slate-200"
      )}
    >
      {active && <Check className="h-3 w-3 shrink-0" />}
      {label}
      {count !== undefined && <span className="text-slate-400">({count})</span>}
    </button>
  );
}
