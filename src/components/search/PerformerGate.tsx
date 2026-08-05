"use client";

import { useState } from "react";
import { ArrowRight, Building2, Stethoscope, X } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { GateTrigger } from "@/components/search/GateTrigger";
import { OptionSearch } from "@/components/search/OptionSearch";
import { cn } from "@/lib/utils";
import { Offer, SearchQuery, providerLabel } from "@/lib/search";
import { PROVIDER_TYPE_LABELS, ProviderType } from "@/types";

/** A doctor, or one kind of unit — the two are one question, not two gates. */
interface Kind {
  /** "doctor", or the organization's provider_type. */
  key: string;
  label: string;
  isDoctor: boolean;
}

interface Entity {
  id: string;
  name: string;
  detail: string;
  /** How many of this entity's items survive the OTHER gates. 0 = greyed. */
  offers: number;
}

/**
 * The performer gate, in two steps: first WHAT KIND gives the service — a
 * doctor, a מכון, a מרפאת חוץ — then WHICH ONE, from a searchable list.
 *
 * The kinds are read off the data rather than listed here, so the gate offers
 * exactly what the catalogue contains: add a lab and it appears, with no code
 * change. It also absorbed the old "סוג יחידה רפואית" gate — asking twice, once
 * for the kind of place and once for the place itself, split one question in
 * two. Picking a kind and stopping there is a legitimate answer ("כל המכונים"),
 * which is what that gate used to be for.
 */
export function PerformerGate({
  query,
  onChange,
  offers,
  scope,
}: {
  query: SearchQuery;
  onChange: (next: SearchQuery) => void;
  /** The whole index — everyone the catalogue has, so nobody vanishes. */
  offers: Offer[];
  /** What survives the OTHER gates. Whoever isn't in here is shown greyed. */
  scope: Offer[];
}) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [text, setText] = useState("");

  const kinds: Kind[] = [
    ...(offers.some((o) => o.doctor) ? [{ key: "doctor", label: PROVIDER_TYPE_LABELS.doctor, isDoctor: true }] : []),
    ...Array.from(
      new Set(offers.map((o) => o.organization?.provider_type).filter(Boolean) as ProviderType[])
    ).map((type) => ({ key: type, label: PROVIDER_TYPE_LABELS[type], isDoctor: false })),
  ];

  /**
   * Everyone of this kind, with the count of items still reachable under the
   * other gates. Built from the full index and counted against the scope, so
   * picking אורתופדיה greys the doctors who don't do it instead of deleting
   * them from a list she was reading a second ago.
   */
  const entitiesOf = (k: Kind): Entity[] => {
    const map = new Map<string, Entity>();
    const add = (list: Offer[], counting: boolean) => {
      for (const offer of list) {
        const entity = k.isDoctor ? offer.doctor : offer.organization;
        if (!entity) continue;
        if (!k.isDoctor && entity.provider_type !== k.key) continue;
        const existing = map.get(entity.id);
        if (existing) {
          if (counting) existing.offers += 1;
          continue;
        }
        map.set(entity.id, {
          id: entity.id,
          name: providerLabel(entity),
          detail: entity.specialty ?? "",
          offers: counting ? 1 : 0,
        });
      }
    };
    add(scope, true);
    add(offers, false);
    return Array.from(map.values()).sort(
      (a, b) => Number(b.offers > 0) - Number(a.offers > 0) || a.name.localeCompare(b.name, "he")
    );
  };

  const selectedDoctor = query.performerId
    ? offers.find((o) => o.doctor?.id === query.performerId)?.doctor
    : undefined;
  const selectedOrg = query.organizationId
    ? offers.find((o) => o.organization?.id === query.organizationId)?.organization
    : undefined;
  const selected = selectedDoctor ?? selectedOrg;
  const unitTypes = Array.isArray(query.filters.unitType) ? (query.filters.unitType as string[]) : [];

  // Named entity first, then "every X", then nothing chosen at all.
  const summary = selected
    ? providerLabel(selected)
    : unitTypes.length === 1
      ? `כל ה${PROVIDER_TYPE_LABELS[unitTypes[0] as ProviderType] ?? unitTypes[0]}`
      : query.groupBy === "provider"
        ? `כל ה${PROVIDER_TYPE_LABELS.doctor}`
        : "סוג נותן שירות";
  const active = !!selected || unitTypes.length > 0 || query.groupBy === "provider";

  function chooseEntity(k: Kind, id: string, close: () => void) {
    onChange({
      ...query,
      text: "",
      // The two anchors are mutually exclusive: she is looking for one entity.
      performerId: k.isDoctor ? id : null,
      organizationId: k.isDoctor ? null : id,
      // A named place doesn't need the kind filter on top of it.
      filters: { ...query.filters, unitType: undefined },
      // Naming a person regroups the results around people; naming a place
      // leaves them as the list of services that place gives.
      groupBy: k.isDoctor ? "provider" : "service",
    });
    // Back to the top level, so re-opening the gate shows the kinds — and the
    // clear button with them — instead of dropping her back into the list she
    // already answered.
    setKind(null);
    close();
  }

  /** The kind on its own — "any doctor", "any מכון". */
  function chooseKind(k: Kind, close: () => void) {
    onChange({
      ...query,
      performerId: null,
      organizationId: null,
      filters: { ...query.filters, unitType: k.isDoctor ? undefined : [k.key] },
      groupBy: k.isDoctor ? "provider" : "service",
    });
    setKind(null);
    close();
  }

  function clear(close: () => void) {
    onChange({
      ...query,
      performerId: null,
      organizationId: null,
      filters: { ...query.filters, unitType: undefined },
      groupBy: "service",
    });
    setKind(null);
    close();
  }

  // One entity left and nothing chosen — the other gates already decided who
  // gives this. Greyed out to say so, still open so she can undo it.
  const reachable = kinds.flatMap((k) => entitiesOf(k)).filter((e) => e.offers > 0);
  const constrained = !active && reachable.length <= 1;

  return (
    <Popover
      block
      trigger={
        // A span, not a button: Popover already wraps the trigger in one, and
        // a button inside a button is invalid HTML that swallows the click.
        <span className="block w-full min-w-0">
          <GateTrigger
            axis="נותן שירות"
            value={active ? summary : constrained ? reachable[0]?.name ?? "אין אפשרויות" : "הכל"}
            active={active}
            muted={constrained}
          />
        </span>
      }
    >
      {(close) => {
        if (!kind) {
          return (
            <div className="py-1">
              <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold text-slate-500">מי נותן את השירות?</p>
              {constrained && (
                <p className="px-3 pb-1 text-[11px] text-slate-400">נקבע לפי הבחירות האחרות — אפשר לבטל אותן ולחזור.</p>
              )}
              {kinds.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">אין נותני שירות בתוצאות</p>}
              {kinds.map((k) => {
                // Only those still reachable — a kind whose every member is
                // ruled out by the other gates is greyed, not hidden.
                const count = entitiesOf(k).filter((e) => e.offers > 0).length;
                const Icon = k.isDoctor ? Stethoscope : Building2;
                return (
                  <button
                    key={k.key}
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
                      {k.label}
                    </span>
                    <span className="text-xs text-slate-400">({count})</span>
                  </button>
                );
              })}
              {active && (
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
              <ArrowRight className="h-3 w-3" /> {kind.label}
            </button>

            <OptionSearch value={text} onChange={setText} placeholder={`חיפוש ב${kind.label}`} />

            <div className="max-h-64 overflow-y-auto overscroll-contain">
              {/* Stopping at the kind is an answer in itself — this row is
                  what the old "סוג יחידה רפואית" gate did, in its own place. */}
              <button
                type="button"
                onClick={() => chooseKind(kind, close)}
                className="focus-ring flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 text-right text-sm font-medium text-[var(--brand-navy)] hover:bg-slate-50"
              >
                כל ה{kind.label}
                <span className="text-[11px] text-slate-400">
                  {entitiesOf(kind).filter((e) => e.offers > 0).length}
                </span>
              </button>

              {list.length === 0 && <p className="px-3 py-3 text-xs text-slate-400">לא נמצאו תוצאות</p>}
              {list.map((entity) => {
                const isOn = entity.id === query.performerId || entity.id === query.organizationId;
                return (
                  <button
                    key={entity.id}
                    type="button"
                    disabled={entity.offers === 0}
                    onClick={() => chooseEntity(kind, entity.id, close)}
                    className={cn(
                      "focus-ring flex w-full items-start justify-between gap-2 px-3 py-2.5 text-right hover:bg-slate-50",
                      isOn && "bg-[var(--brand-navy)]/5",
                      entity.offers === 0 && "cursor-not-allowed opacity-40 hover:bg-transparent"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">{entity.name}</span>
                      {entity.detail && (
                        <span className="block truncate text-[11px] text-slate-500">{entity.detail}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {entity.offers > 0 ? `${entity.offers} שירותים` : "לא בבחירה הנוכחית"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Also here, not only on the first screen: with one candidate left
                the list is a single row, and without this there'd be nothing to
                undo it with. */}
            {active && (
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
      }}
    </Popover>
  );
}
