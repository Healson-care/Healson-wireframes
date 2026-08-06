"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrganizationBranch, Patient, ProviderProfile } from "@/types";
import {
  FilterValue,
  Offer,
  SearchContext,
  SearchQuery,
  SearchScope,
  Suggestion,
  activeFilterCount,
  activeGateChips,
  buildOffers,
  normalizeQuery,
  offersWithoutDoctor,
  searchOffers,
  offerPricing,
  toggleMulti,
} from "@/lib/search";
import { SearchOmnibox } from "@/components/search/SearchOmnibox";
import { FilterSheet } from "@/components/search/FilterSheet";
import { OfferResults } from "@/components/search/OfferResults";
import { InsuranceProfileStrip } from "@/components/search/InsuranceProfileStrip";
import { PrimaryGates } from "@/components/search/PrimaryGates";

/**
 * The always-visible layer of the filter system: the few choices worth a tap
 * without opening anything. Everything else lives in the sheet — this row
 * stays this short no matter how many filters the registry grows to.
 */
/**
 * Every quick chip must write a value the filter sheet can also DRAW. The
 * coverage chip broke that rule: it wrote an umbrella value ("any arrangement")
 * that wasn't one of the sheet's six options, so with the chip on, the כיסוי
 * group showed "1 active" while no option — not even "הכל" — appeared chosen.
 * Removed rather than papered over; the six specific answers are still in the
 * sheet, and they are the more useful question anyway.
 */
const QUICK_CHIPS: { key: string; value: FilterValue; label: string }[] = [
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
  onSelectOffer: (offer: Offer) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  /**
   * The sticky band carries four things — the insurance strip, the gates, the
   * omnibox and the chips — which together eat most of a phone screen.
   *
   * Only ONE of them folds while she scrolls down: the insurance strip, which
   * is a legend and is read once. The gates, the search box and the chips all
   * stay, because each is a control she reaches for mid-list, and a control
   * that has to be summoned back before it can be used isn't really there.
   * Scrolling up even slightly brings the strip back.
   */
  const [collapsed, setCollapsed] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      const previous = lastY.current;
      lastY.current = y;
      // Near the top there's nothing to reclaim, and folding there would make
      // the band twitch while she's still reading the first result.
      if (y < 160) {
        setCollapsed(false);
        return;
      }
      // A dead zone, so momentum scrolling's tiny reversals don't flap it.
      if (y > previous + 6) setCollapsed(true);
      else if (y < previous - 6) setCollapsed(false);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /**
   * THE write gate. Every control that changes the query goes through here —
   * the gates via `onChange`, this component's own handlers via `setQuery` —
   * so cross-filter rules are applied in one place instead of being
   * re-remembered by each control. See normalizeQuery.
   */
  const commitQuery = (next: SearchQuery) => onQueryChange(normalizeQuery(query, next));

  const setQuery = (update: SearchQuery | ((prev: SearchQuery) => SearchQuery)) =>
    commitQuery(typeof update === "function" ? update(query) : update);

  const offers = useMemo(() => buildOffers(providers, branches), [providers, branches]);

  /**
   * The FULL index, always. "Only what a doctor delivers" is now the
   * `doctorDelivered` filter and narrows the results like any other — it no
   * longer shrinks the index the controls themselves are drawn from.
   *
   * That distinction is the whole fix. While it shrank the index, a station-run
   * unit it excluded disappeared from the performer gate rather than greying
   * out there, so the gate could only be cleared and never changed; and the
   * sheet, judging which contextual filters were "relevant" against the same
   * shrunken index, could hide the switch for a filter that was still on.
   */
  const ctx: SearchContext = useMemo(() => ({ patient, offers }), [patient, offers]);

  const results = useMemo(() => searchOffers(query, ctx), [query, ctx]);

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

  const performer = query.performerId ? offers.find((o) => o.doctor?.id === query.performerId)?.doctor : undefined;
  const organization = query.organizationId
    ? offers.find((o) => o.organization?.id === query.organizationId)?.organization
    : undefined;
  const filterCount = activeFilterCount(query);
  const gateChips = useMemo(() => activeGateChips(query, ctx), [query, ctx]);
  const doctorOnly = query.filters.doctorDelivered === true;
  // Station-run imaging and lab work have no doctor, so "רק שירותים שרופא
  // מבצע" can't hold them. Worth one line of explanation, since the totals
  // differ — but no number, which would describe nothing on screen.
  const hasDoctorlessOffers = doctorOnly && offersWithoutDoctor(offers).length > 0;
  // Which kind of entity leads the omnibox list. Every kind is always offered;
  // this only picks the order. Derived rather than stored, so it cannot drift
  // out of step with what she actually asked for.
  const omniboxScope: SearchScope = query.performerId || doctorOnly ? "provider" : "service";

  /**
   * Every kind the box can return resolves to the query field that actually
   * means it — a person anchors the performer, a place anchors the
   * organization, a town writes the city filter. None of them is left as loose
   * text: an anchored value gets a chip she can see and remove, where free
   * text would keep narrowing invisibly.
   */
  function pick(suggestion: Suggestion) {
    if (suggestion.kind === "provider") {
      setQuery((q) => ({ ...q, text: "", performerId: suggestion.value }));
      return;
    }
    if (suggestion.kind === "organization") {
      setQuery((q) => ({ ...q, text: "", organizationId: suggestion.value }));
      return;
    }
    if (suggestion.kind === "city") {
      setQuery((q) => ({
        ...q,
        text: "",
        filters: { ...q.filters, city: toggleMulti(q.filters.city, suggestion.value) },
      }));
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

  return (
    <div>
      {/* The controls stay on screen for the whole scroll. Filtering is not a
          thing you do once at the top and then leave — she reads three cards,
          decides she wants תל אביב only, and shouldn't have to scroll back up
          to say so. top-14 clears the layout's own sticky header; the negative
          margin lets the band span the page padding, so cards pass under it
          rather than beside it. */}
      <div className="sticky top-14 z-20 -mx-4 mb-3 border-b border-slate-200/70 bg-slate-50/90 px-4 pb-1.5 pt-1.5 backdrop-blur">
        {/* The profile rides along: every price on screen is stated in terms
            of these plans, so the legend for them can't scroll away from the
            thing it explains. It folds while she scrolls down — it's a legend,
            read once — and unfolds the moment she scrolls back up. */}
        <Collapsible show={!collapsed}>
          {patient && <InsuranceProfileStrip patient={patient} />}
        </Collapsible>

        {/* 1 — the gates, in place of the old by-service/by-provider toggle:
            what kind of item, from what kind of person, at what kind of unit.
            Choosing a kind of PERSON is itself the statement that she's looking
            for a person, so the view follows the gate instead of asking twice. */}
        <PrimaryGates query={query} onChange={commitQuery} ctx={ctx} />

        {/* 2 — the search bar, scoped by the choice above. Stays for the whole
            scroll, like the gates: typing a name is the fastest route to a
            result, and a route that has to be summoned back first isn't fast.
            Only the insurance strip folds — it is a legend, read once. */}
        <div className="mb-2">
          <SearchOmnibox
            text={query.text}
            onTextChange={(text) => setQuery((q) => ({ ...q, text }))}
            offers={offers}
            scope={omniboxScope}
            recents={recents}
            onPick={pick}
            onPickRecent={(value) => setQuery((q) => ({ ...q, text: value }))}
          />
        </div>

        {/* 3 — filters: anchors and quick chips inline, the rest in the sheet.
            Wraps rather than scrolling sideways — a chip the patient has to
            discover by swiping may as well not be on screen. */}
        <div className="flex flex-wrap items-center gap-2">
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
            // Undo everything picking a person did, not just the id — the
            // performer axis is written by one gate and has to be cleared as
            // one thing, or the X would leave half a choice behind.
            onRemove={() =>
              setQuery((q) => ({
                ...q,
                performerId: null,
                filters: { ...q.filters, unitType: undefined, doctorDelivered: undefined },
              }))
            }
          />
        )}
        {organization && (
          <AnchorChip
            label={`מקום: ${organization.display_name}`}
            onRemove={() =>
              setQuery((q) => ({
                ...q,
                organizationId: null,
                filters: { ...q.filters, unitType: undefined, doctorDelivered: undefined },
              }))
            }
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

        {/* Every gate value that's still narrowing, each with its own X. The
            bar itself only has room for the first choice per axis — a city she
            picked and then forgot about must not keep filtering from a place
            she can't see it. */}
        {gateChips.map((chip) => (
          <AnchorChip
            key={`${chip.key}:${chip.value}`}
            // A yes/no gate's label is already a full sentence — prefixing it
            // with its axis would read "נותן שירות: רק שירותים שרופא מבצע".
            label={chip.standalone ? chip.label : `${chip.group}: ${chip.label}`}
            onRemove={() =>
              setQuery((q) => {
                // Same X, two shapes of value behind it: a yes/no gate simply
                // switches off, a list gate drops the one value this chip names.
                if (q.filters[chip.key] === true) {
                  return { ...q, filters: { ...q.filters, [chip.key]: undefined } };
                }
                const next = toggleMulti(q.filters[chip.key], chip.value);
                return { ...q, filters: { ...q.filters, [chip.key]: next.length ? next : undefined } };
              })
            }
          />
        ))}

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
      </div>

      {/* "הצעות" throughout, never "פריטים": a row is now one item at one
          branch, so the same MRI at two branches is two of these — and calling
          that "2 פריטים" would read as two different tests. */}
      {patient && results.length > 0 ? (
        <p className="mb-2 text-xs text-slate-600">
          <span className="font-semibold text-teal-700">✓</span> בדקנו {results.length} הצעות מול הפרופיל שלך
          {conciergeCounts.basket > 0 && <> · {conciergeCounts.basket} בכיסוי סל</>}
          {conciergeCounts.arrangement > 0 && <> · {conciergeCounts.arrangement} בהסדר</>}
          {conciergeCounts.hint > 0 && <> · {conciergeCounts.hint} ייתכן החזר</>}
        </p>
      ) : (
        <p className="mb-2 text-xs text-slate-500">
          {results.length === 0 ? "אין תוצאות" : `${results.length} הצעות`}
        </p>
      )}

      {hasDoctorlessOffers && (
        <p className="mb-3 rounded-lg border border-info-border bg-info-bg px-3 py-2 text-[11px] text-info-text">
          מוצגים רק פריטים שרופא נותן. בדיקות שמבוצעות במכשיר במכון יופיעו כשתסירו את הבחירה בנותן שירות.
        </p>
      )}

      <OfferResults offers={results} patient={patient} onSelectOffer={onSelectOffer} />

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

/**
 * Folds its content away without unmounting the meaning of the page. Height is
 * animated rather than toggled with `hidden`, so the results below slide up
 * instead of jumping — a sticky band that snaps between two heights reads as a
 * glitch, and she loses her place in the list.
 *
 * `overflow-hidden` is what makes a height animation look like a fold rather
 * than a squash — but it also clips anything hanging out of the box, and the
 * omnibox hangs a suggestion list well past its own bottom edge. So it's worn
 * only while the fold is actually moving, and dropped once it settles open.
 */
function Collapsible({ show, children }: { show: boolean; children: ReactNode }) {
  const [animating, setAnimating] = useState(false);
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onAnimationStart={() => setAnimating(true)}
          onAnimationComplete={() => setAnimating(false)}
          className={cn(animating && "overflow-hidden")}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
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
