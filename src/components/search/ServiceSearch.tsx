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
import { GroupDetail, OfferResults } from "@/components/search/OfferResults";
import { InsuranceProfileStrip } from "@/components/search/InsuranceProfileStrip";

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

  // Switching scope drops whatever was typed but not yet resolved — that text
  // was aimed at the other kind of entity and would return nothing here.
  function setGroupBy(groupBy: SearchQuery["groupBy"]) {
    setQuery((q) => ({ ...q, groupBy, text: "" }));
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

      {/* 1 — what she's looking for. This isn't only a display choice: it
          also scopes the search box below, so "לפי שירות" searches services
          and "לפי נותן שירות" searches providers. Full-width on mobile. */}
      {/* Same segmented-control shape as the portal's ViewSwitch: a bordered
          white rail, the active choice filled in primary. */}
      <div className="mb-3 grid grid-cols-2 gap-0.5 rounded-xl border border-white/70 bg-white/85 p-0.5 shadow-[0_18px_40px_-32px_rgba(20,42,79,0.4)] backdrop-blur-sm sm:inline-grid">
        <GroupToggle active={query.groupBy === "service"} onClick={() => setGroupBy("service")} label="לפי שירות" />
        <GroupToggle
          active={query.groupBy === "provider"}
          onClick={() => setGroupBy("provider")}
          label="לפי נותן שירות"
        />
      </div>

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
            : `${results.length} הצעות · ${groups.length} ${query.groupBy === "provider" ? "נותני שירות" : "שירותים"}`}
        </p>
      )}

      {hasDoctorlessOffers && (
        <p className="mb-3 rounded-lg border border-info-border bg-info-bg px-3 py-2 text-[11px] text-info-text">
          תצוגה זו מציגה שירותים שרופא נותן. בדיקות שמבוצעות במכשיר במכון מופיעות בתצוגת &quot;לפי שירות&quot;.
        </p>
      )}

      <OfferResults groups={groups} onOpenGroup={(group) => onOpenKeyChange(group.key)} onSelectOffer={onSelectOffer} />

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

function GroupToggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        // 40px tall on a phone — this is the first control on the screen and
        // the one that reframes everything under it.
        "focus-ring w-full rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors sm:px-5 sm:py-1.5",
        active
          ? "bg-gradient-to-b from-[var(--brand-navy-700)] to-[var(--brand-navy)] text-white shadow-sm"
          : "text-[var(--brand-ink-soft)] hover:bg-[var(--brand-navy)]/6"
      )}
    >
      {label}
    </button>
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
