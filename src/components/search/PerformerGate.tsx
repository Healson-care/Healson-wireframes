"use client";

import { useState } from "react";
import { ArrowRight, Building2, ChevronDown, Search, Stethoscope, X } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { cn } from "@/lib/utils";
import { Offer, SearchQuery, providerLabel } from "@/lib/search";

type Kind = "doctor" | "institute";

interface Entity {
  id: string;
  name: string;
  detail: string;
  offers: number;
}

/**
 * The performer gate, in two steps: first WHAT KIND gives the service — a
 * doctor or an institute — then WHICH ONE, from a searchable list.
 *
 * Two steps rather than one flat list because the two kinds answer different
 * questions ("I want my doctor" vs "I want that imaging centre"), and because
 * a single list of every person and place in the system is unnavigable the
 * moment the catalogue is real.
 */
export function PerformerGate({
  query,
  onChange,
  offers,
}: {
  query: SearchQuery;
  onChange: (next: SearchQuery) => void;
  /** The current result set — the lists only ever offer what's reachable. */
  offers: Offer[];
}) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [text, setText] = useState("");

  const entitiesOf = (k: Kind): Entity[] => {
    const map = new Map<string, Entity>();
    for (const offer of offers) {
      const entity = k === "doctor" ? offer.doctor : offer.organization;
      if (!entity) continue;
      const existing = map.get(entity.id);
      if (existing) {
        existing.offers += 1;
        continue;
      }
      map.set(entity.id, {
        id: entity.id,
        name: providerLabel(entity),
        detail: entity.specialty ?? "",
        offers: 1,
      });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "he"));
  };

  const selectedDoctor = query.performerId
    ? offers.find((o) => o.doctor?.id === query.performerId)?.doctor
    : undefined;
  const selectedOrg = query.organizationId
    ? offers.find((o) => o.organization?.id === query.organizationId)?.organization
    : undefined;
  const selected = selectedDoctor ?? selectedOrg;

  function choose(k: Kind, id: string, close: () => void) {
    onChange({
      ...query,
      text: "",
      // The two anchors are mutually exclusive: she is looking for one entity.
      performerId: k === "doctor" ? id : null,
      organizationId: k === "institute" ? id : null,
      // Naming a person regroups the results around people; naming a place
      // leaves them as the list of services that place gives.
      groupBy: k === "doctor" ? "provider" : "service",
    });
    close();
  }

  function clear(close: () => void) {
    onChange({ ...query, performerId: null, organizationId: null, groupBy: "service" });
    setKind(null);
    close();
  }

  return (
    <Popover
      trigger={
        <button
          type="button"
          className={cn(
            "focus-ring flex h-11 w-full items-center justify-between gap-1 rounded-xl border px-2.5 text-right text-[11px] font-semibold transition-colors",
            selected
              ? "border-[var(--brand-navy)]/25 bg-[var(--brand-navy)]/8 text-[var(--brand-navy)]"
              : "border-white/70 bg-white/85 text-[var(--brand-ink-soft)] shadow-[0_18px_40px_-32px_rgba(20,42,79,0.4)] backdrop-blur-sm"
          )}
        >
          <span className="min-w-0 truncate">{selected ? providerLabel(selected) : "סוג נותן שירות"}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      }
    >
      {(close) => {
        if (!kind) {
          return (
            <div className="py-1">
              <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold text-slate-500">מי נותן את השירות?</p>
              {(
                [
                  { k: "doctor" as const, label: "רופא/ה", Icon: Stethoscope },
                  { k: "institute" as const, label: "מכון / יחידה רפואית", Icon: Building2 },
                ]
              ).map(({ k, label, Icon }) => {
                const count = entitiesOf(k).length;
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={count === 0}
                    onClick={() => {
                      setKind(k);
                      setText("");
                    }}
                    className={cn(
                      "focus-ring flex w-full items-center justify-between gap-2 px-3 py-3 text-right text-sm hover:bg-slate-50",
                      count === 0 && "cursor-not-allowed opacity-40 hover:bg-transparent"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-[var(--brand-navy)]" />
                      {label}
                    </span>
                    <span className="text-xs text-slate-400">({count})</span>
                  </button>
                );
              })}
              {selected && (
                <button
                  type="button"
                  onClick={() => clear(close)}
                  className="focus-ring mt-1 flex w-full items-center gap-1 border-t border-slate-100 px-3 py-2 text-right text-xs font-medium text-[var(--brand-navy)]"
                >
                  <X className="h-3 w-3" /> ניקוי הבחירה
                </button>
              )}
            </div>
          );
        }

        const list = entitiesOf(kind).filter((e) =>
          text.trim() ? `${e.name} ${e.detail}`.includes(text.trim()) : true
        );

        return (
          <div className="py-1">
            <button
              type="button"
              onClick={() => setKind(null)}
              className="focus-ring flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium text-[var(--brand-navy)]"
            >
              <ArrowRight className="h-3 w-3" /> {kind === "doctor" ? "רופאים" : "מכונים ויחידות"}
            </button>

            {/* Free text above the list — a real catalogue is far too long to
                scroll, and she usually already knows the name. */}
            <div className="mx-3 mb-1 flex items-center gap-1.5 rounded-lg border border-slate-200 px-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={kind === "doctor" ? "חיפוש רופא/ה" : "חיפוש מכון"}
                className="h-8 w-full bg-transparent text-xs outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="max-h-64 overflow-y-auto overscroll-contain">
              {list.length === 0 && <p className="px-3 py-3 text-xs text-slate-400">לא נמצאו תוצאות</p>}
              {list.map((entity) => {
                const isOn = entity.id === query.performerId || entity.id === query.organizationId;
                return (
                  <button
                    key={entity.id}
                    type="button"
                    onClick={() => choose(kind, entity.id, close)}
                    className={cn(
                      "focus-ring flex w-full items-start justify-between gap-2 px-3 py-2.5 text-right hover:bg-slate-50",
                      isOn && "bg-[var(--brand-navy)]/5"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">{entity.name}</span>
                      {entity.detail && (
                        <span className="block truncate text-[11px] text-slate-500">{entity.detail}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">{entity.offers} שירותים</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      }}
    </Popover>
  );
}
