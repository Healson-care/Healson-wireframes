"use client";

import { Check, ChevronDown } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { cn } from "@/lib/utils";
import {
  FilterDef,
  SearchContext,
  SearchQuery,
  domainLabel,
  facetCount,
  gateOptions,
  subdomainLabel,
  subdomainParent,
  toggleMulti,
} from "@/lib/search";

/**
 * The תחום gate — the one gate with two levels. Picking a domain opens its
 * sub-domains inline, underneath it, rather than on a second screen: the
 * sub-domain only means anything in the context of its parent, so showing
 * them together is what makes "ברך" readable as "אורתופדיה › ברך".
 *
 * Both levels are ordinary registry filters ("domain" / "subdomain"), so
 * matching and facet counts come from the same engine as every other filter.
 * The only rule this control adds is that a sub-domain never outlives its
 * domain — un-checking אורתופדיה drops ברך with it, or the search would keep
 * narrowing by something no longer on screen.
 */
export function DomainGate({
  domainDef,
  subdomainDef,
  query,
  onChange,
  ctx,
}: {
  domainDef: FilterDef;
  subdomainDef?: FilterDef;
  query: SearchQuery;
  onChange: (next: SearchQuery) => void;
  ctx: SearchContext;
}) {
  const domains = gateOptions(domainDef, query, ctx);
  const subdomains = subdomainDef ? gateOptions(subdomainDef, query, ctx) : [];

  const selectedDomains = Array.isArray(query.filters.domain) ? (query.filters.domain as string[]) : [];
  const selectedSubs = Array.isArray(query.filters.subdomain) ? (query.filters.subdomain as string[]) : [];
  const active = selectedDomains.length > 0;

  const setFilters = (next: Record<string, string[] | undefined>) =>
    onChange({ ...query, filters: { ...query.filters, ...next } });

  function toggleDomain(id: string) {
    const nextDomains = toggleMulti(query.filters.domain, id);
    // Dropped the domain → drop whatever hung off it.
    const nextSubs = nextDomains.includes(id)
      ? selectedSubs
      : selectedSubs.filter((sub) => subdomainParent(sub) !== id);
    setFilters({
      domain: nextDomains.length ? nextDomains : undefined,
      subdomain: nextSubs.length ? nextSubs : undefined,
    });
  }

  function toggleSubdomain(id: string) {
    const next = toggleMulti(query.filters.subdomain, id);
    setFilters({ subdomain: next.length ? next : undefined });
  }

  // Once something is chosen the value matters more than the axis name. One
  // domain with one sub-domain reads as the path it is.
  const summary = !active
    ? domainDef.group
    : selectedDomains.length === 1 && selectedSubs.length === 1
      ? `${domainLabel(selectedDomains[0])} · ${subdomainLabel(selectedSubs[0])}`
      : domainLabel(selectedDomains[0]);
  const extra = selectedDomains.length - 1;

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
            {extra > 0 && <span className="font-normal"> +{extra}</span>}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      }
    >
      {() => (
        <div className="py-1">
          <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold text-slate-500">{domainDef.group}</p>
          {domains.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">אין תחומים בתוצאות הנוכחיות</p>}

          {/* Domains outnumber every other gate's options, and open sub-domains
              make the list longer still — cap it rather than let the panel run
              past the bottom of the screen. */}
          <div className="max-h-[55vh] overflow-y-auto">
          {domains.map((opt) => {
            const isOn = selectedDomains.includes(opt.value);
            const count = facetCount(query, "domain", toggleMulti(query.filters.domain, opt.value), ctx);
            const children = isOn ? subdomains.filter((s) => subdomainParent(s.value) === opt.value) : [];

            return (
              <div key={opt.value}>
                <OptionRow
                  label={opt.label}
                  count={count}
                  checked={isOn}
                  disabled={!isOn && count === 0}
                  onClick={() => toggleDomain(opt.value)}
                />

                {/* The sub-domains of a chosen domain, indented under it. A
                    domain whose items carry no sub-domain simply has none —
                    that's a fact about the catalogue, not an error. */}
                {isOn && (
                  <div className="border-e-2 border-[var(--brand-navy)]/15 pe-3">
                    {children.length === 0 ? (
                      <p className="px-3 py-1.5 text-[11px] text-slate-400">אין תת-תחומים לפריטים שנותרו</p>
                    ) : (
                      children.map((sub) => (
                        <OptionRow
                          key={sub.value}
                          label={sub.label}
                          small
                          count={facetCount(query, "subdomain", toggleMulti(query.filters.subdomain, sub.value), ctx)}
                          checked={selectedSubs.includes(sub.value)}
                          disabled={
                            !selectedSubs.includes(sub.value) &&
                            facetCount(query, "subdomain", toggleMulti(query.filters.subdomain, sub.value), ctx) === 0
                          }
                          onClick={() => toggleSubdomain(sub.value)}
                        />
                      ))
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
              onClick={() => setFilters({ domain: undefined, subdomain: undefined })}
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
