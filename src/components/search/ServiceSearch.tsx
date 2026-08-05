"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrganizationBranch, Patient, ProviderProfile } from "@/types";
import {
  FilterValue,
  Offer,
  SearchContext,
  SearchQuery,
  Suggestion,
  activeFilterCount,
  buildOffers,
  groupOffers,
  offersWithoutDoctor,
  searchOffers,
  offerPricing,
} from "@/lib/search";
import { SearchOmnibox } from "@/components/search/SearchOmnibox";
import { FilterSheet } from "@/components/search/FilterSheet";
import { GroupDetail, OfferItemList, OfferResults } from "@/components/search/OfferResults";
import { InsuranceProfileStrip } from "@/components/search/InsuranceProfileStrip";
import { PrimaryGates } from "@/components/search/PrimaryGates";

/**
 * The always-visible layer of the filter system: the few choices worth a tap
 * without opening anything. Everything else lives in the sheet — this row
 * stays this short no matter how many filters the registry grows to.
 */
const QUICK_CHIPS: { key: string; value: FilterValue; label: string }[] = [
  { key: "coverage", value: "arrangement", label: "יש הסדר לפרופיל שלי" },
  { key: "availability", value: "week", label: "השבוע הקרוב" },
  { key: "noReferral", value: true, label: "ללא הפניה" },
];

/**
 * Results-first faceted search. There is no wizard and no "search" button:
 * the full result set is on screen from the first render, and every control
 * narrows it live. Two things are deliberate here —
 *
 * - filters live in a bottom sheet, so the results keep the viewport on
 *   mobile instead of being pushed below a wall of dropdowns;
 * - picking a doctor from the omnibox flips the grouping to "by provider",
 *   because someone who searched for a person wants to see that person's
 *   services and branches, not a flat list of services.
 */
export function ServiceSearch({
  providers,
  branches = [],
  patient,
  query,
  onQueryChange,
  openKey,
  onOpenKeyChange,
  onSelectOffer,
}: {
  providers: ProviderProfile[];
  /** A unit keeps its places here, not in clinic_locations — imaging items
   *  are bound to the branches whose stations perform them. */
  branches?: OrganizationBranch[];
  patient?: Patient | null;
  // Query and drill-down live in the page, not here: this component unmounts
  // when the booking moves on to picking a time, and coming back must not
  // wipe the search she built to get there.
  query: SearchQuery;
  onQueryChange: (next: SearchQuery) => void;
  /** Which card's detail screen is open — an id, since groups are recomputed. */
  openKey: string | null;
  onOpenKeyChange: (key: string | null) => void;
  onSelectOffer: (offer: Offer) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const setQuery = (update: SearchQuery | ((prev: SearchQuery) => SearchQuery)) =>
    onQueryChange(typeof update === "function" ? update(query) : update);

  const offers = useMemo(() => buildOffers(providers, branches), [providers, branches]);

  // "לפי נותן שירות" shows only services a doctor actually delivers. Scoping
  // the index itself — rather than filtering at render time — keeps the result
  // count, the facet counts and the grouped cards all describing one same set.
  const scopedOffers = useMemo(
    () => (query.groupBy === "provider" ? offers.filter((o) => o.doctor) : offers),
    [offers, query.groupBy]
  );
  const ctx: SearchContext = useMemo(() => ({ patient, offers: scopedOffers }), [patient, scopedOffers]);

  const results = useMemo(() => searchOffers(query, ctx), [query, ctx]);
  const groups = useMemo(() => groupOffers(results, query.groupBy, patient), [results, query.groupBy, patient]);

  // The concierge summary: how many of the current results the patient's own
  // insurance actually does something for. Computed on the same offers the
  // list shows, so the sentence can never disagree with the cards below it.
  const conciergeCounts = useMemo(() => {
    let basket = 0;
    let arrangement = 0;
    let hint = 0;
    for (const offer of results) {
      const pricing = offerPricing(offer, patient);
      if (!pricing) continue;
      if (pricing.kind === "basket") basket += 1;
      else if (pricing.kind === "arrangement") arrangement += 1;
      else if (pricing.kind === "base" && pricing.reimbursementHint?.length) hint += 1;
    }
    return { basket, arrangement, hint };
  }, [results, patient]);

  // Real entities, so the demo's "recent searches" aren't inventions that
  // return nothing when tapped.
  const recents = useMemo(() => {
    const names = Array.from(new Set(offers.map((o) => o.service.name))).slice(0, 2);
    const doctor = offers[0] ? `${offers[0].provider.title ?? ""} ${offers[0].provider.display_name}`.trim() : null;
    return [...names, ...(doctor ? [doctor] : [])];
  }, [offers]);

  // Falls back to the results list if the opened card no longer matches — a
  // filter changed while its screen was open.
  const openGroup = openKey ? groups.find((g) => g.key === openKey) ?? null : null;

  const performer = query.performerId ? offers.find((o) => o.doctor?.id === query.performerId)?.doctor : undefined;
  const filterCount = activeFilterCount(query);
  // Containers are for browsing. Once anything is narrowed — a gate, a filter,
  // an anchor, typed text — she has already said what she's after, and
  // grouping would hide the very items she filtered down to.
  const narrowed =
    filterCount > 0 ||
    !!query.performerId ||
    !!query.organizationId ||
    !!query.serviceName ||
    query.text.trim().length > 0;
  // Station-run imaging and lab work have no doctor, so this view can't hold
  // them. Worth one line of explanation, since the totals differ between the
  // two views — but no number, which would describe nothing on screen.
  const hasDoctorlessOffers = query.groupBy === "provider" && offersWithoutDoctor(offers).length > 0;

  function pick(suggestion: Suggestion) {
    if (suggestion.kind === "provider") {
      setQuery((q) => ({ ...q, text: "", performerId: suggestion.value }));
      return;
    }
    setQuery((q) => ({
      ...q,
      text: "",
      serviceName: suggestion.value,
      referralCode: suggestion.referralCode ?? null,
    }));
  }

  function clearFilters() {
    setQuery((q) => ({ ...q, filters: {} }));
  }

  // A card's own screen replaces the search entirely — results, filters and
  // the box all step aside so the list of items owns the viewport.
  if (openGroup) {
    return (
      <GroupDetail
        group={openGroup}
        patient={patient}
        onBack={() => onOpenKeyChange(null)}
        onSelectOffer={onSelectOffer}
      />
    );
  }

  return (
    <div>
      {patient && <InsuranceProfileStrip patient={patient} />}

      {/* 1 — the gates, in place of the old by-service/by-provider toggle:
          what kind of item, from what kind of person, at what kind of unit.
          Choosing a kind of PERSON is itself the statement that she's looking
          for a person, so the view follows the gate instead of asking twice. */}
      <PrimaryGates query={query} onChange={onQueryChange} ctx={ctx} />

      {/* 2 — the search bar, scoped by the choice above. */}
      <div className="mb-3">
        <SearchOmnibox
          text={query.text}
          onTextChange={(text) => setQuery((q) => ({ ...q, text }))}
          offers={scopedOffers}
          scope={query.groupBy}
          recents={recents}
          onPick={pick}
          onPickRecent={(value) => setQuery((q) => ({ ...q, text: value }))}
        />
      </div>

      {/* 3 — filters: anchors and quick chips inline, the rest in the sheet.
          Wraps rather than scrolling sideways — a chip the patient has to
          discover by swiping may as well not be on screen. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSheetOpen(true)}
          className={cn(
            "focus-ring inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium sm:h-8 sm:px-3 sm:text-xs",
            filterCount > 0
              ? "border-[var(--brand-navy)]/25 bg-[var(--brand-navy)]/8 text-[var(--brand-navy)]"
              : "border-slate-200 bg-white/85 text-[var(--brand-ink-soft)]"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          מסננים
          {filterCount > 0 && ` (${filterCount})`}
        </button>

        {performer && (
          <AnchorChip
            label={`נותן שירות: ${performer.title ?? ""} ${performer.display_name}`.trim()}
            onRemove={() => setQuery((q) => ({ ...q, performerId: null }))}
          />
        )}
        {query.serviceName && (
          <AnchorChip
            label={
              query.referralCode ? `הפניה: ${query.referralCode} · ${query.serviceName}` : `שירות: ${query.serviceName}`
            }
            onRemove={() => setQuery((q) => ({ ...q, serviceName: null, referralCode: null }))}
          />
        )}

        {QUICK_CHIPS.map((chip) => {
          const active = query.filters[chip.key] === chip.value;
          return (
            <button
              key={chip.key}
              onClick={() =>
                setQuery((q) => ({
                  ...q,
                  filters: { ...q.filters, [chip.key]: active ? undefined : chip.value },
                }))
              }
              className={cn(
                "focus-ring inline-flex h-10 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium sm:h-8 sm:px-3 sm:text-xs",
                active
                  ? "border-[var(--brand-navy)]/25 bg-[var(--brand-navy)]/8 text-[var(--brand-navy)]"
                  : "border-slate-200 bg-white/85 text-[var(--brand-ink-soft)] hover:border-[var(--brand-navy)]/25"
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {patient && results.length > 0 ? (
        <p className="mb-2 text-xs text-slate-600">
          <span className="font-semibold text-teal-700">✓</span> בדקנו {results.length} הצעות מול הפרופיל שלך
          {conciergeCounts.basket > 0 && <> · {conciergeCounts.basket} בכיסוי סל</>}
          {conciergeCounts.arrangement > 0 && <> · {conciergeCounts.arrangement} בהסדר</>}
          {conciergeCounts.hint > 0 && <> · {conciergeCounts.hint} ייתכן החזר</>}
        </p>
      ) : (
        <p className="mb-2 text-xs text-slate-500">
          {results.length === 0
            ? "אין תוצאות"
            : narrowed
              ? `${results.length} פריטים`
              : `${results.length} הצעות · ${groups.length} ${query.groupBy === "provider" ? "נותני שירות" : "שירותים"}`}
        </p>
      )}

      {hasDoctorlessOffers && (
        <p className="mb-3 rounded-lg border border-info-border bg-info-bg px-3 py-2 text-[11px] text-info-text">
          תצוגה זו מציגה שירותים שרופא נותן. בדיקות שמבוצעות במכשיר במכון מופיעות בתצוגת &quot;לפי שירות&quot;.
        </p>
      )}

      {narrowed ? (
        <OfferItemList offers={results} patient={patient} onSelectOffer={onSelectOffer} />
      ) : (
        <OfferResults groups={groups} onOpenGroup={(group) => onOpenKeyChange(group.key)} onSelectOffer={onSelectOffer} />
      )}

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        query={query}
        onChange={setQuery}
        ctx={ctx}
        resultCount={results.length}
        onClearAll={clearFilters}
      />
    </div>
  );
}

function AnchorChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-3.5 text-sm font-medium text-primary sm:h-8 sm:px-3 sm:text-xs">
      <span className="max-w-[70vw] truncate sm:max-w-none">{label}</span>
      <button onClick={onRemove} aria-label={`הסרת ${label}`} className="focus-ring shrink-0 rounded-full p-1 hover:bg-primary/20">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
