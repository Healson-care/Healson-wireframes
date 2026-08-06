"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { GateTrigger } from "@/components/search/GateTrigger";
import { GatePanelHeader } from "@/components/search/GatePanelHeader";
import { OptionSearch } from "@/components/search/OptionSearch";
import { PerformerGate } from "@/components/search/PerformerGate";
import { TwoLevelGate } from "@/components/search/TwoLevelGate";
import { cn } from "@/lib/utils";
import {
  FilterDef,
  FilterValue,
  SearchContext,
  SearchQuery,
  facetCount,
  gateOptions,
  matchesQuery,
  primaryFilters,
  toggleMulti,
} from "@/lib/search";

/**
 * The gates: the axes a patient narrows by before she cares about price or
 * timing — in what field, what kind of item, and from whom. They stand in
 * place of the old by-service/by-provider toggle, because choosing a kind of
 * performer already says which of those two she wants.
 *
 * The first two are ordinary registry filters (flagged `primary`, so the sheet
 * knows not to draw them twice) and each lists only what the other gates have
 * left standing. The performer gate is a two-step entity picker with its own
 * control; the kind of unit lives inside it, since "מכון" and "which מכון" are
 * one question asked at two depths.
 */
export function PrimaryGates({
  query,
  onChange,
  ctx,
}: {
  query: SearchQuery;
  onChange: (next: SearchQuery) => void;
  ctx: SearchContext;
}) {
  const gates = primaryFilters();
  const gate = (key: string) => gates.find((g) => g.key === key);
  const domainGate = gate("domain");
  const itemGate = gate("serviceType");
  const regionGate = gate("region");

  // The performer gate answers to the others exactly the way a registry gate
  // does: it sees the offers that pass everything EXCEPT its own axis, so
  // choosing a domain or an item type shortens the list of doctors and units —
  // and its own anchors don't shorten it into a list containing only itself.
  const performerScope = useMemo(() => {
    const probe: SearchQuery = {
      ...query,
      performerId: null,
      organizationId: null,
      // Every part of this gate's own axis is cleared — the two anchors, the
      // unit kind AND doctorDelivered. Leaving the last one in was what let
      // "כל הרופאים" grey out every institute the moment it was chosen, so the
      // gate could only be cleared and never changed.
      filters: { ...query.filters, unitType: undefined, doctorDelivered: undefined },
    };
    return ctx.offers.filter((offer) => matchesQuery(offer, probe, ctx));
  }, [query, ctx]);

  function setValue(key: string, value: FilterValue) {
    onChange({ ...query, filters: { ...query.filters, [key]: value } });
  }

  return (
    // One surface, divided — not four loose pills. `grid` on each cell, not
    // `block`: Popover's root is inline-block, and only a grid/flex parent
    // stretches it to full width.
    <div className="mb-2 overflow-hidden rounded-2xl bg-gradient-to-l from-[var(--brand-navy)]/[0.07] via-white/70 to-[var(--brand-gold)]/[0.16]">
      {/* All four axes on one row at every width.
          `min-w-0` on every cell is load-bearing, not tidying: a grid item
          defaults to `min-width: auto`, so a cell holding a long value grows
          past its 1fr track and squeezes its neighbours out of the row — which
          is exactly what "מרפאות חוץ הדסה" did to the gate beside it. With it,
          the track's width wins and the value truncates inside its own quarter.
          The full text is never lost: it reads in the chip below the bar. */}
      <div className="grid grid-cols-4">
        <div className="grid min-w-0 border-e border-[var(--brand-navy)]/10">
          {itemGate && <GateControl def={itemGate} query={query} ctx={ctx} onSetValue={setValue} />}
        </div>
        <div className="grid min-w-0">
          {domainGate && (
            <TwoLevelGate
              parentDef={domainGate}
              childDef={gate("subdomain")}
              placeholder="חיפוש תחום או תת-תחום"
              emptyLabel="אין תחומים בתוצאות הנוכחיות"
              noChildrenLabel="אין תת-תחומים לפריטים שנותרו"
              query={query}
              onChange={onChange}
              ctx={ctx}
            />
          )}
        </div>
        <div className="grid min-w-0 border-s border-[var(--brand-navy)]/10">
          <PerformerGate query={query} onChange={onChange} offers={ctx.offers} scope={performerScope} />
        </div>
        <div className="grid min-w-0 border-s border-[var(--brand-navy)]/10">
          {regionGate && (
            <TwoLevelGate
              parentDef={regionGate}
              childDef={gate("city")}
              placeholder="חיפוש אזור או עיר"
              emptyLabel="אין מיקומים בתוצאות הנוכחיות"
              noChildrenLabel="אין ערים לפריטים שנותרו"
              query={query}
              onChange={onChange}
              ctx={ctx}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function GateControl({
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
  const [text, setText] = useState("");
  const all = gateOptions(def, query, ctx);
  const options = text.trim() ? all.filter((o) => o.label.includes(text.trim())) : all;
  const selected = Array.isArray(query.filters[def.key]) ? (query.filters[def.key] as string[]) : [];
  const active = selected.length > 0;
  // Once something is chosen the value matters more than the axis name — the
  // label is only there to explain an empty gate.
  // Read off the unfiltered list: typing in the search box must not blank out
  // the label of something that is still selected.
  const summary = active ? all.find((o) => o.value === selected[0])?.label ?? def.group : def.group;

  // What the OTHER gates have left choosable here. One answer left means there
  // is nothing to decide — the segment greys out and states it, but still
  // opens: that's where she undoes it.
  const choosable = all.filter((o) => facetCount(query, def.key, toggleMulti(query.filters[def.key], o.value), ctx) > 0);
  const constrained = !active && choosable.length <= 1;

  return (
    <Popover
      block
      trigger={
        // A span, not a button: Popover already wraps the trigger in one, and
        // a button inside a button is invalid HTML that swallows the click.
        <span className="block w-full min-w-0">
          <GateTrigger
            axis={def.group}
            value={active ? summary : constrained ? choosable[0]?.label ?? "אין אפשרויות" : "הכל"}
            active={active}
            muted={constrained}
            extra={selected.length - 1}
          />
        </span>
      }
    >
      {(close) => (
        <div className="py-1">
          <GatePanelHeader title={def.group} onClose={close} />
          {constrained && (
            <p className="px-3 pb-1 text-[11px] text-slate-400">נקבע לפי הבחירות האחרות — אפשר לבטל אותן ולחזור.</p>
          )}
          <OptionSearch value={text} onChange={setText} placeholder={`חיפוש ב${def.group}`} />
          {options.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400">
              {text.trim() ? "לא נמצאו תוצאות" : "אין אפשרויות בתוצאות הנוכחיות"}
            </p>
          )}
          {options.map((opt) => {
            const isOn = selected.includes(opt.value);
            const next = toggleMulti(query.filters[def.key], opt.value);
            const count = facetCount(query, def.key, next, ctx);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSetValue(def.key, next)}
                disabled={!isOn && count === 0}
                className={cn(
                  "focus-ring flex w-full items-center justify-between gap-2 px-3 py-2.5 text-right text-sm hover:bg-slate-50",
                  isOn && "font-semibold text-[var(--brand-navy)]",
                  !isOn && count === 0 && "cursor-not-allowed opacity-40 hover:bg-transparent"
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      isOn ? "border-[var(--brand-navy)] bg-[var(--brand-navy)] text-white" : "border-slate-300"
                    )}
                  >
                    {isOn && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{opt.label}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-400">({count})</span>
              </button>
            );
          })}
          {active && (
            <button
              type="button"
              onClick={() => onSetValue(def.key, undefined)}
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
