"use client";

import { Check, ChevronDown } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { DomainGate } from "@/components/search/DomainGate";
import { PerformerGate } from "@/components/search/PerformerGate";
import { cn } from "@/lib/utils";
import {
  FilterDef,
  FilterValue,
  SearchContext,
  SearchQuery,
  facetCount,
  gateOptions,
  primaryFilters,
  toggleMulti,
} from "@/lib/search";

/**
 * The gates: the axes a patient narrows by before she cares about price or
 * timing — in what field, what kind of item, who gives it, at what kind of
 * unit. They stand in place of the old by-service/by-provider toggle, because
 * choosing a kind of performer already says which of those two she wants.
 *
 * Three of them are ordinary registry filters (flagged `primary`, so the sheet
 * knows not to draw them twice) and each lists only what the other gates have
 * left standing. The performer gate is a two-step entity picker and has its
 * own control.
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
  const unitGate = gate("unitType");

  function setValue(key: string, value: FilterValue) {
    onChange({ ...query, filters: { ...query.filters, [key]: value } });
  }

  return (
    // Two per row on a phone — four gates side by side would truncate every
    // label to a syllable.
    <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {domainGate && (
        <DomainGate
          domainDef={domainGate}
          subdomainDef={gate("subdomain")}
          query={query}
          onChange={onChange}
          ctx={ctx}
        />
      )}
      {itemGate && <GateControl def={itemGate} query={query} ctx={ctx} onSetValue={setValue} />}
      <PerformerGate query={query} onChange={onChange} offers={ctx.offers} />
      {unitGate && <GateControl def={unitGate} query={query} ctx={ctx} onSetValue={setValue} />}
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
  const options = gateOptions(def, query, ctx);
  const selected = Array.isArray(query.filters[def.key]) ? (query.filters[def.key] as string[]) : [];
  const active = selected.length > 0;
  // Once something is chosen the value matters more than the axis name — the
  // label is only there to explain an empty gate.
  const summary = active ? options.find((o) => o.value === selected[0])?.label ?? def.group : def.group;

  return (
    <Popover
      trigger={
        <button
          type="button"
          className={cn(
            "focus-ring flex h-11 w-full items-center justify-between gap-1 rounded-xl border px-2.5 text-right text-[11px] font-semibold transition-colors",
            active
              ? "border-[var(--brand-navy)]/25 bg-[var(--brand-navy)]/8 text-[var(--brand-navy)]"
              : "border-white/70 bg-white/85 text-[var(--brand-ink-soft)] shadow-[0_18px_40px_-32px_rgba(20,42,79,0.4)] backdrop-blur-sm"
          )}
        >
          <span className="min-w-0 truncate">
            {summary}
            {selected.length > 1 && <span className="font-normal"> +{selected.length - 1}</span>}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      }
    >
      {() => (
        <div className="py-1">
          <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold text-slate-500">{def.group}</p>
          {options.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400">אין אפשרויות בתוצאות הנוכחיות</p>
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
