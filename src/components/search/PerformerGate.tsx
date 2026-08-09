"use client";

import { useState } from "react";
import { ArrowRight, Building2, Stethoscope, X } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { GateTrigger } from "@/components/search/GateTrigger";
import { GatePanelHeader } from "@/components/search/GatePanelHeader";
import { OptionSearch } from "@/components/search/OptionSearch";
import { cn } from "@/lib/utils";
import { Offer, SearchQuery, performerTypeOf, providerLabel } from "@/lib/search";
import { PROVIDER_TYPE_ALL_LABELS, PROVIDER_TYPE_LABELS, ProviderType } from "@/types";

/** "Everyone in this profession", for a free-text profession name. A neutral
 * frame on purpose — "כל ה…" would produce "כל הליווי לידה". */
const allInProfession = (name: string) => `הכול ב${name}`;

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
  // The middle level, and ONLY under מטפל רפואי. A doula and a physiotherapist
  // are different professions, not two flavours of one job — but "מטפל רפואי"
  // is how they register, so the top level keeps that one entry and the
  // professions live inside it rather than lengthening the list of kinds.
  //
  // Doctors get no such level: a cardiologist is found through תחום רפואי, an
  // axis of its own. Paramedical work has no axis — the domain tree is a
  // physician taxonomy — so this is the only place a profession can be picked.
  const [profession, setProfession] = useState<string | null>(null);
  const [text, setText] = useState("");

  /** Professions under a person kind, in the order they'll be listed. */
  const professionsOf = (k: Kind): string[] =>
    k.isDoctor
      ? Array.from(
          new Set(
            offers
              .filter((o) => performerTypeOf(o) === k.key)
              .map((o) => o.doctor?.specialty ?? "")
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b, "he"))
      : [];

  /** Whether this kind is split by profession at all. Driven by the data: one
   * profession is not a choice, it's a label, so the level is skipped. */
  const splitsByProfession = (k: Kind) => k.key === "caregiver" && professionsOf(k).length > 1;

  // Person kinds are read off each performer's OWN provider_type, not collapsed
  // into one "רופא/ה" bucket: search treats a doctor and a מטפל רפואי alike
  // (both are people, both land on offer.doctor), but the patient choosing who
  // treats her does not — offering her "רופא/ה" and then listing a
  // physiotherapist under it is simply wrong.
  const kinds: Kind[] = [
    ...Array.from(new Set(offers.map(performerTypeOf).filter(Boolean) as ProviderType[])).map((type) => ({
      key: type,
      label: PROVIDER_TYPE_LABELS[type],
      isDoctor: true,
    })),
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
  const entitiesOf = (k: Kind, withinProfession?: string | null): Entity[] => {
    const map = new Map<string, Entity>();
    const add = (list: Offer[], counting: boolean) => {
      for (const offer of list) {
        const entity = k.isDoctor ? offer.doctor : offer.organization;
        if (!entity) continue;
        // Both halves filter by kind now. Without it on the person half, every
        // doctor would also be listed under "מטפל רפואי" and vice versa.
        const entityType = k.isDoctor ? performerTypeOf(offer) : entity.provider_type;
        if (entityType !== k.key) continue;
        if (withinProfession && entity.specialty !== withinProfession) continue;
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
  // "כל הרופאים" / "כל המטפלים" — the person half of this gate's axis. An
  // ordinary registry filter now, where it used to be a hidden `groupBy` mode
  // with no chip and no place in the filter count.
  const personTypes = Array.isArray(query.filters.performerType)
    ? (query.filters.performerType as string[])
    : [];
  const professions = Array.isArray(query.filters.performerSpecialty)
    ? (query.filters.performerSpecialty as string[])
    : [];

  // Named entity first, then the narrowest kind chosen, then nothing at all.
  // The profession beats the kind when both are set: "כל הדולות" is what she
  // actually asked for, and "כל המטפלים הרפואיים" would under-report it.
  const kindOnly = unitTypes[0] ?? personTypes[0];
  const summary = selected
    ? providerLabel(selected)
    : professions.length === 1
      ? allInProfession(professions[0])
      : unitTypes.length + personTypes.length === 1
        ? PROVIDER_TYPE_ALL_LABELS[kindOnly as ProviderType] ?? kindOnly
        : "סוג נותן שירות רפואי";
  const active = !!selected || unitTypes.length > 0 || personTypes.length > 0 || professions.length > 0;

  function chooseEntity(k: Kind, id: string, close: () => void) {
    onChange({
      ...query,
      text: "",
      // The two anchors are mutually exclusive: she is looking for one entity.
      performerId: k.isDoctor ? id : null,
      organizationId: k.isDoctor ? null : id,
      // A named performer doesn't need either kind filter on top of it —
      // `performerId` already names the person, so keeping performerType on
      // would be a second chip saying what the first one said.
      filters: {
        ...query.filters,
        unitType: undefined,
        performerType: undefined,
        performerSpecialty: undefined,
      },
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
      // One axis, two halves: a person, or a kind of place. Whichever half she
      // answers, the other is cleared — they can't both be narrowing at once.
      filters: {
        ...query.filters,
        unitType: k.isDoctor ? undefined : [k.key],
        performerType: k.isDoctor ? [k.key] : undefined,
        // "כל המטפלים הרפואיים" is the whole kind, so any profession chosen on
        // the way in is dropped rather than silently narrowing it further.
        performerSpecialty: undefined,
      },
    });
    setKind(null);
    setProfession(null);
    close();
  }

  /** A profession within a kind — "כל הדולות". */
  function chooseProfession(k: Kind, name: string, close: () => void) {
    onChange({
      ...query,
      performerId: null,
      organizationId: null,
      filters: {
        ...query.filters,
        unitType: undefined,
        // Both: the profession alone would also match a doctor who happens to
        // carry the same specialty string.
        performerType: [k.key],
        performerSpecialty: [name],
      },
    });
    setKind(null);
    setProfession(null);
    close();
  }

  function clear(close: () => void) {
    onChange({
      ...query,
      performerId: null,
      organizationId: null,
      filters: {
        ...query.filters,
        unitType: undefined,
        performerType: undefined,
        performerSpecialty: undefined,
      },
    });
    setKind(null);
    setProfession(null);
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
            axis="נותן שירות רפואי"
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
              <GatePanelHeader title="מי נותן את השירות?" onClose={close} />
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
                      setProfession(null);
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

        // The middle level: which profession, before which person. Only where
        // the data actually splits — one profession is a label, not a choice.
        if (splitsByProfession(kind) && !profession) {
          const names = professionsOf(kind);
          return (
            <div className="py-1">
              <GatePanelHeader
                title={kind.label}
                onClose={close}
                leading={
                  <button
                    type="button"
                    onClick={() => setKind(null)}
                    aria-label="חזרה לסוגי נותני השירות"
                    className="focus-ring rounded-md p-1 text-[var(--brand-navy)] hover:bg-slate-100"
                  >
                    <ArrowRight className="h-3 w-3" />
                  </button>
                }
              />
              <div className="max-h-64 overflow-y-auto overscroll-contain">
                <button
                  type="button"
                  onClick={() => chooseKind(kind, close)}
                  className="focus-ring flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 text-right text-sm font-medium text-[var(--brand-navy)] hover:bg-slate-50"
                >
                  {PROVIDER_TYPE_ALL_LABELS[kind.key as ProviderType] ?? kind.label}
                  <span className="text-[11px] text-slate-400">
                    {entitiesOf(kind).filter((e) => e.offers > 0).length}
                  </span>
                </button>
                {names.map((name) => {
                  const count = entitiesOf(kind, name).filter((e) => e.offers > 0).length;
                  return (
                    <button
                      key={name}
                      type="button"
                      disabled={count === 0}
                      onClick={() => {
                        setProfession(name);
                        setText("");
                      }}
                      className={cn(
                        "focus-ring flex w-full items-center justify-between gap-2 px-3 py-3 text-right text-sm hover:bg-slate-50",
                        count === 0 && "cursor-not-allowed opacity-40 hover:bg-transparent"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 shrink-0 text-[var(--brand-navy)]" />
                        {name}
                      </span>
                      <span className="text-xs text-slate-400">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }

        const list = entitiesOf(kind, profession).filter((e) =>
          text.trim() ? `${e.name} ${e.detail}`.includes(text.trim()) : true
        );

        return (
          <div className="py-1">
            {/* Two exits, and they mean different things: the arrow goes back
                to the list of kinds, the X leaves the gate entirely. On the
                second screen the first one alone isn't enough — she may be
                done, not merely one level too deep. */}
            <GatePanelHeader
              title={profession ?? kind.label}
              onClose={close}
              leading={
                <button
                  type="button"
                  // Back one level, not all the way out: from a profession that
                  // means its sibling professions, not the list of kinds.
                  onClick={() => (profession ? setProfession(null) : setKind(null))}
                  aria-label={profession ? "חזרה לסוגי המטפלים" : "חזרה לסוגי נותני השירות"}
                  className="focus-ring rounded-md p-1 text-[var(--brand-navy)] hover:bg-slate-100"
                >
                  <ArrowRight className="h-3 w-3" />
                </button>
              }
            />

            <OptionSearch value={text} onChange={setText} placeholder={`חיפוש ב${profession ?? kind.label}`} />

            <div className="max-h-64 overflow-y-auto overscroll-contain">
              {/* Stopping at the kind — or at the profession — is an answer in
                  itself. This row is what the old "סוג יחידה רפואית" gate did,
                  in its own place, and it is what "רק דולות" goes through. */}
              <button
                type="button"
                onClick={() => (profession ? chooseProfession(kind, profession, close) : chooseKind(kind, close))}
                className="focus-ring flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 text-right text-sm font-medium text-[var(--brand-navy)] hover:bg-slate-50"
              >
                {profession
                  ? allInProfession(profession)
                  : PROVIDER_TYPE_ALL_LABELS[kind.key as ProviderType] ?? kind.label}
                <span className="text-[11px] text-slate-400">
                  {entitiesOf(kind, profession).filter((e) => e.offers > 0).length}
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
