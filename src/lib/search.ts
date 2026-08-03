// Faceted service search — the matching engine behind /client/search.
//
// Two ideas carry this file:
//
// 1. The unit of search is an **Offer**: one service, offered by one provider,
//    bookable at that provider's locations. A provider with 3 services and 2
//    clinics produces 3 offers (not 6) — the clinic is a property of the offer,
//    chosen at slot-picking time, because a price is per provider+service and
//    never per clinic. This is what lets "search by doctor" and "search by
//    service" be two *presentations* of one result set instead of two screens.
//
// 2. Filters are **data, not screens**. FILTER_REGISTRY declares each filter's
//    group, control type, options and match predicate; the sheet UI renders
//    itself from that array and facet counts come free, because counting is
//    just running the same predicates with one value overridden. Adding a
//    filter means adding one object here.
//
// Pricing is NOT reimplemented — every price/coverage question goes through
// resolvePriceBreakdown in lib/pricing.ts, so search and booking can never
// disagree about what a patient pays.
import {
  Clinic,
  ConsultationType,
  InsuranceLayer,
  LOCATION_TYPE_LABELS,
  LocationType,
  Patient,
  PROVIDER_SERVICE_TYPE_LABELS,
  ProviderProfile,
  ProviderServiceType,
  ProviderType,
} from "@/types";
import { FundingKind, PriceBreakdown, resolvePriceBreakdown } from "@/lib/pricing";
import { getRegionForCity } from "@/lib/constants";
import { resolveDepositAmount } from "@/lib/deposit";
import { requiresReferral } from "@/lib/referral";
import { nextAvailableInDays } from "@/lib/scheduling";


// ---------------------------------------------------------------------------
// Offer
// ---------------------------------------------------------------------------

/**
 * Provider types that are a *person*. Everything else — a clinic, an
 * institute, a hospital, a lab — is a place: it owns services, prices and
 * insurance agreements, but it is never the "נותן שירות" the patient picks.
 */
const PERSON_PROVIDER_TYPES = new Set<ProviderType>(["doctor", "caregiver"]);

function isOrganization(provider: ProviderProfile): boolean {
  return provider.provider_type ? !PERSON_PROVIDER_TYPES.has(provider.provider_type) : false;
}

export interface Offer {
  /** Stable key for React lists and for de-duplication. */
  id: string;
  /**
   * Whoever owns the service — its price table and its insurance agreements.
   * For an organization's catalogue this is the organization, not the doctor,
   * which is why pricing always reads from here.
   */
  provider: ProviderProfile;
  /**
   * The person delivering it. Absent for machine-based diagnostics (an MRI at
   * an institute is performed by a station, not by a named doctor).
   */
  doctor?: ProviderProfile;
  /** Set when the service belongs to an organization — the place it happens at. */
  organization?: ProviderProfile;
  service: ConsultationType;
  /**
   * Locations this specific service can be booked at. A service may be
   * restricted to some of the provider's clinics via `linked_clinic_ids`, and
   * an affiliated doctor may work at only some of those.
   */
  clinics: Clinic[];
}

/**
 * Flattens published providers into the offer index the whole search runs on.
 * Services with no bookable location drop out — an offer that can't be booked
 * shouldn't be findable.
 */
export function buildOffers(providers: ProviderProfile[]): Offer[] {
  const byId = new Map(providers.map((p) => [p.id, p]));
  const offers: Offer[] = [];

  for (const provider of providers) {
    if (!provider.is_published) continue;
    const allClinics = provider.clinic_locations ?? [];

    for (const service of provider.consultation_types ?? []) {
      const linked = service.linked_clinic_ids;
      const serviceClinics = linked?.length ? allClinics.filter((c) => linked.includes(c.id)) : allClinics;
      if (serviceClinics.length === 0) continue;

      if (!isOrganization(provider)) {
        offers.push({
          id: `${provider.id}:${service.id}`,
          provider,
          doctor: provider,
          service,
          clinics: serviceClinics,
        });
        continue;
      }

      // An organization is a place. Its performer is one of its affiliated
      // doctors, matched per service — a doctor delivers only part of the
      // organization's catalogue.
      const affiliations = (provider.affiliated_doctors ?? []).filter((a) => a.service_ids.includes(service.id));
      if (affiliations.length === 0) {
        // No doctor at all, and that's correct: imaging and lab work are
        // delivered by a station. The offer still exists, it just has no
        // person to group it under.
        offers.push({
          id: `${provider.id}:${service.id}`,
          provider,
          organization: provider,
          service,
          clinics: serviceClinics,
        });
        continue;
      }

      for (const affiliation of affiliations) {
        const clinicIds = affiliation.clinic_ids;
        const clinics = clinicIds?.length ? serviceClinics.filter((c) => clinicIds.includes(c.id)) : serviceClinics;
        if (clinics.length === 0) continue;
        offers.push({
          id: `${provider.id}:${service.id}:${affiliation.id}`,
          provider,
          doctor: byId.get(affiliation.doctor_provider_id),
          organization: provider,
          service,
          clinics,
        });
      }
    }
  }
  return offers;
}

/** Display name for a person or a place. */
export function providerLabel(provider: ProviderProfile): string {
  return `${provider.title ?? ""} ${provider.display_name}`.trim();
}

/**
 * Where a filter reads a provider attribute from: the performing doctor when
 * there is one, otherwise the owning organization (an institute's own
 * specialty is the best available answer for its machine-run services).
 */
function attributeSource(offer: Offer): ProviderProfile {
  return offer.doctor ?? offer.provider;
}

// ---------------------------------------------------------------------------
// Pricing / coverage per offer
// ---------------------------------------------------------------------------

export interface OfferPricing {
  /** The funding route that won — the primary fact about this price. */
  kind: FundingKind;
  /** What the patient pays now. 0 for a basket-covered service. */
  price: number;
  /** P — the base price everything is anchored on. */
  basePrice: number;
  layer?: InsuranceLayer;
  /** The route, phrased for the patient — straight from pricing.ts. */
  label: string;
  /** Informational only: her plans worth checking. Never an amount. */
  reimbursementHint?: string[];
  deposit: number;
  balance: number;
  /** The raw breakdown, so cards can hand it straight to InsurancePriceBlock. */
  breakdown: PriceBreakdown;
}

/**
 * The single place search asks "how is this funded for her". Returns null
 * when there's no patient profile yet — callers show "הרשמה להצגת מחיר"
 * rather than a number, since without a profile there is no route.
 */
export function offerPricing(offer: Offer, patient?: Patient | null): OfferPricing | null {
  const breakdown = resolvePriceBreakdown(
    offer.service.prices,
    offer.provider.agreements,
    patient,
    offer.service.price_full,
    offer.service
  );
  if (!breakdown) return null;

  const deposit = resolveDepositAmount(breakdown.price, offer.service);
  return {
    kind: breakdown.kind,
    price: breakdown.price,
    basePrice: breakdown.basePrice,
    layer: breakdown.layer,
    label: breakdown.label,
    reimbursementHint: breakdown.reimbursementHint,
    deposit,
    balance: breakdown.price - deposit,
    breakdown,
  };
}

// ---------------------------------------------------------------------------
// The canonical query
// ---------------------------------------------------------------------------

export type FilterValue = string | string[] | boolean | undefined;

export interface SearchQuery {
  /** Free text still in the box (not yet resolved to an entity). */
  text: string;
  /** Anchored to one provider — set by picking a doctor from the omnibox. */
  performerId: string | null;
  /** Anchored to one service name — set by picking a service, or a referral. */
  serviceName: string | null;
  /** Recognised referral code, kept so the UI can show why serviceName is set. */
  referralCode: string | null;
  /** Registry-driven filters, keyed by FilterDef.key. */
  filters: Record<string, FilterValue>;
  /** Same results, two presentations. */
  groupBy: "service" | "provider";
}

export function emptyQuery(): SearchQuery {
  return { text: "", performerId: null, serviceName: null, referralCode: null, filters: {}, groupBy: "service" };
}

/** Everything the predicates need beyond the offer itself. */
export interface SearchContext {
  patient?: Patient | null;
  /** Unfiltered offer index — used to derive dynamic option lists. */
  offers: Offer[];
}

// ---------------------------------------------------------------------------
// Free-text matching, synonyms, referral codes
// ---------------------------------------------------------------------------

/**
 * Colloquial and transliterated names patients actually type, mapped onto
 * words that appear in real service names. Matching is substring-based in
 * both directions so "תהודה" hits "תהודה מגנטית".
 */
export const SEARCH_SYNONYMS: Record<string, string> = {
  "אם אר איי": "MRI",
  "אם-אר-איי": "MRI",
  "תהודה מגנטית": "MRI",
  mri: "MRI",
  "סי טי": "CT",
  ct: "CT",
  "טומוגרפיה": "CT",
  "אולטרסאונד": "US",
  "אקג": 'א.ק.ג',
  "בדיקת לב": "קרדיולוג",
  "לב": "קרדיולוג",
  "עיניים": "עיניים",
  "סקנד אופיניון": "חוות דעת",
  "דעה שנייה": "חוות דעת",
  "עמוד שדרה": "גב",
};

const REFERRAL_PATTERN = /^ref-?\d+$/i;

export function isReferralCode(text: string): boolean {
  return REFERRAL_PATTERN.test(text.trim());
}

export function normalizeReferralCode(text: string): string {
  const digits = text.trim().replace(/^ref-?/i, "");
  return `REF-${digits}`;
}

/** Expands a typed query into the terms worth matching against. */
function expandTerms(text: string): string[] {
  const raw = text.trim().toLowerCase();
  if (!raw) return [];
  const terms = [raw];
  for (const [key, target] of Object.entries(SEARCH_SYNONYMS)) {
    const k = key.toLowerCase();
    if (k.includes(raw) || raw.includes(k)) terms.push(target.toLowerCase());
  }
  return terms;
}

function offerHaystack(offer: Offer): string {
  const { doctor, organization, service } = offer;
  const person = attributeSource(offer);
  return [
    service.name,
    doctor?.display_name,
    doctor?.title,
    organization?.display_name,
    person.specialty,
    ...(person.sub_specialties ?? []),
    service.service_type ? PROVIDER_SERVICE_TYPE_LABELS[service.service_type] : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesText(offer: Offer, text: string): boolean {
  const terms = expandTerms(text);
  if (terms.length === 0) return true;
  const haystack = offerHaystack(offer);
  return terms.some((t) => haystack.includes(t));
}

// ---------------------------------------------------------------------------
// Omnibox suggestions
// ---------------------------------------------------------------------------

export type SuggestionKind = "provider" | "service" | "referral";

/**
 * What the search box is currently looking for. Bound to the result grouping:
 * browsing "לפי שירות" searches services, browsing "לפי נותן שירות" searches
 * providers — so the box never returns a kind of thing the results can't show.
 */
export type SearchScope = "service" | "provider";

export interface Suggestion {
  kind: SuggestionKind;
  /** Provider id for "provider", service name for "service" / "referral". */
  value: string;
  label: string;
  /** Second line — specialty, or how many providers offer this service. */
  detail?: string;
  /** Set when the hit came via a synonym, so the UI can explain the match. */
  viaSynonym?: string;
  /** "referral" only. */
  referralCode?: string;
}

function synonymHint(lower: string, haystack: string): string | undefined {
  if (!lower || haystack.includes(lower)) return undefined;
  return Object.keys(SEARCH_SYNONYMS).find((k) => {
    const kl = k.toLowerCase();
    return (kl.includes(lower) || lower.includes(kl)) && haystack.includes(SEARCH_SYNONYMS[k].toLowerCase());
  });
}

/**
 * Distinct performing doctors in the index — never organizations, which are
 * places. `terms === null` means "return them all".
 */
function doctorSuggestions(offers: Offer[], terms: string[] | null, lower: string): Suggestion[] {
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const offer of offers) {
    const doctor = offer.doctor;
    if (!doctor || seen.has(doctor.id)) continue;
    const hay = `${doctor.title ?? ""} ${doctor.display_name} ${doctor.specialty}`.toLowerCase();
    if (terms && !terms.some((t) => hay.includes(t))) continue;
    seen.add(doctor.id);
    const own = offers.filter((o) => o.doctor?.id === doctor.id);
    const clinicCount = new Set(own.flatMap((o) => o.clinics.map((c) => c.id))).size;
    out.push({
      kind: "provider",
      value: doctor.id,
      label: providerLabel(doctor),
      detail: `${doctor.specialty} · ${own.length} שירותים · ${clinicCount} מיקומים`,
      viaSynonym: terms ? synonymHint(lower, hay) : undefined,
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "he"));
}

/** Distinct service names in the index. `terms === null` means "return them all". */
function serviceSuggestions(offers: Offer[], terms: string[] | null, lower: string): Suggestion[] {
  const counts = new Map<string, number>();
  for (const offer of offers) {
    const hay = offer.service.name.toLowerCase();
    if (terms && !terms.some((t) => hay.includes(t))) continue;
    counts.set(offer.service.name, (counts.get(offer.service.name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({
      kind: "service" as const,
      value: name,
      label: name,
      detail: `${count} נותני שירות`,
      viaSynonym: terms ? synonymHint(lower, name.toLowerCase()) : undefined,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "he"));
}

/**
 * Typed-entity suggestions within the current scope. A referral code is only
 * meaningful when searching services, since it names one.
 */
export function suggest(text: string, offers: Offer[], scope: SearchScope, limit = 6): Suggestion[] {
  const raw = text.trim();
  if (raw.length < 2) return [];
  const terms = expandTerms(raw);
  const lower = raw.toLowerCase();

  if (scope === "provider") return doctorSuggestions(offers, terms, lower).slice(0, limit);

  const out: Suggestion[] = [];
  if (isReferralCode(raw)) {
    const code = normalizeReferralCode(raw);
    // A referral names a diagnostic service. With no referral registry in the
    // demo data, the first service that requires one stands in for "what this
    // referral is for" — deterministically, so the demo is repeatable.
    const target = offers.find((o) => requiresReferral(o.service)) ?? offers[0];
    if (target) {
      out.push({
        kind: "referral",
        value: target.service.name,
        label: `הפניה ${code}`,
        detail: target.service.name,
        referralCode: code,
      });
    }
  }
  return [...out, ...serviceSuggestions(offers, terms, lower)].slice(0, limit);
}

/**
 * The whole list for the current scope — what the dropdown offers before
 * anything is typed, so the patient can browse instead of having to guess a
 * name. Same shape as suggestions, so the dropdown renders them identically.
 */
export function listEntities(offers: Offer[], scope: SearchScope): Suggestion[] {
  return scope === "provider" ? doctorSuggestions(offers, null, "") : serviceSuggestions(offers, null, "");
}

// ---------------------------------------------------------------------------
// Filter registry
// ---------------------------------------------------------------------------

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  key: string;
  /** Heading it renders under in the sheet. */
  group: string;
  type: "toggle" | "single" | "multi";
  /** "toggle" only — the single checkbox's label. */
  label?: string;
  /** Static options, or a function deriving them from the live offer index. */
  options?: FilterOption[] | ((ctx: SearchContext) => FilterOption[]);
  /** Long lists render collapsed behind "הצג עוד". */
  collapsible?: boolean;
  /**
   * Contextual filters (the second visibility layer): only shown when the
   * current results actually contain one of these service types. This is how
   * "ללא צום" stays out of the way of someone booking a consultation.
   */
  appliesTo?: ProviderServiceType[];
  match: (offer: Offer, value: FilterValue, ctx: SearchContext) => boolean;
}

const AVAILABILITY_MAX_DAYS: Record<string, number> = { week: 7, twoWeeks: 14, month: 30 };
const PRICE_CEILINGS: Record<string, number> = { p300: 300, p600: 600 };

function offerClinicTypes(offer: Offer): LocationType[] {
  return offer.clinics.map((c) => c.location_type ?? "clinic");
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "he"));
}

export const FILTER_REGISTRY: FilterDef[] = [
  {
    key: "serviceType",
    group: "סוג השירות",
    type: "multi",
    options: (ctx) =>
      uniqueSorted(ctx.offers.map((o) => o.service.service_type ?? "consultation")).map((v) => ({
        value: v,
        label: PROVIDER_SERVICE_TYPE_LABELS[v as ProviderServiceType] ?? v,
      })),
    match: (offer, value) =>
      !Array.isArray(value) || value.length === 0 || value.includes(offer.service.service_type ?? "consultation"),
  },
  {
    key: "region",
    group: "מיקום",
    type: "multi",
    collapsible: true,
    options: (ctx) =>
      uniqueSorted(ctx.offers.flatMap((o) => o.clinics.map((c) => getRegionForCity(c.city)))).map((v) => ({
        value: v,
        label: v,
      })),
    match: (offer, value) =>
      !Array.isArray(value) ||
      value.length === 0 ||
      offer.clinics.some((c) => value.includes(getRegionForCity(c.city))),
  },
  {
    key: "locationType",
    group: "מיקום",
    type: "multi",
    options: (ctx) =>
      uniqueSorted(ctx.offers.flatMap((o) => offerClinicTypes(o))).map((v) => ({
        value: v,
        label: LOCATION_TYPE_LABELS[v as LocationType] ?? v,
      })),
    match: (offer, value) =>
      !Array.isArray(value) || value.length === 0 || offerClinicTypes(offer).some((t) => value.includes(t)),
  },
  {
    key: "availability",
    group: "זמינות",
    type: "single",
    options: [
      { value: "week", label: "השבוע הקרוב" },
      { value: "twoWeeks", label: "השבועיים הקרובים" },
      { value: "month", label: "החודש הקרוב" },
    ],
    match: (offer, value) => {
      if (typeof value !== "string" || !value) return true;
      const max = AVAILABILITY_MAX_DAYS[value];
      // Availability belongs to whoever actually delivers the service — the
      // doctor's own calendar inside an organization, not the organization's.
      return max === undefined || nextAvailableInDays(attributeSource(offer).id) <= max;
    },
  },
  {
    key: "coverage",
    group: "מחיר וכיסוי",
    type: "single",
    options: [
      { value: "basket", label: "מכוסה בסל" },
      { value: "arrangement", label: "יש הסדר לפרופיל שלי" },
      { value: "hint", label: "ייתכן החזר" },
      { value: "base", label: "מחיר מלא" },
    ],
    match: (offer, value, ctx) => {
      if (typeof value !== "string" || !value) return true;
      const pricing = offerPricing(offer, ctx.patient);
      // Without a patient profile we can't know the funding route, so this
      // filter simply doesn't exclude anything rather than emptying the page.
      if (!pricing) return true;
      // "ייתכן החזר" is not a route of its own — it's the base route carrying
      // an informational hint, so it gets its own filter value.
      if (value === "hint") return pricing.kind === "base" && (pricing.reimbursementHint?.length ?? 0) > 0;
      return pricing.kind === value;
    },
  },
  {
    key: "priceCeiling",
    group: "מחיר וכיסוי",
    type: "single",
    options: [
      { value: "p300", label: "עד 300 ₪" },
      { value: "p600", label: "עד 600 ₪" },
    ],
    match: (offer, value, ctx) => {
      if (typeof value !== "string" || !value) return true;
      const ceiling = PRICE_CEILINGS[value];
      if (ceiling === undefined) return true;
      const pricing = offerPricing(offer, ctx.patient);
      if (!pricing) return true;
      return pricing.price <= ceiling;
    },
  },
  {
    key: "specialty",
    group: "נותן השירות",
    type: "multi",
    collapsible: true,
    options: (ctx) => uniqueSorted(ctx.offers.map((o) => attributeSource(o).specialty)).map((v) => ({ value: v, label: v })),
    match: (offer, value) =>
      !Array.isArray(value) || value.length === 0 || value.includes(attributeSource(offer).specialty),
  },
  {
    key: "language",
    group: "נותן השירות",
    type: "multi",
    collapsible: true,
    options: (ctx) =>
      uniqueSorted(ctx.offers.flatMap((o) => attributeSource(o).languages ?? [])).map((v) => ({ value: v, label: v })),
    match: (offer, value) =>
      !Array.isArray(value) ||
      value.length === 0 ||
      value.every((lang) => (attributeSource(offer).languages ?? []).includes(lang)),
  },
  {
    key: "rating4",
    group: "נותן השירות",
    type: "toggle",
    label: "דירוג 4 ומעלה",
    match: (offer, value) => value !== true || (attributeSource(offer).rating ?? 0) >= 4,
  },
  {
    key: "noReferral",
    group: "הכנה ודרישות",
    type: "toggle",
    label: "ללא צורך בהפניה",
    match: (offer, value) => value !== true || !requiresReferral(offer.service),
  },
  {
    key: "noFasting",
    group: "הכנה ודרישות",
    type: "toggle",
    label: "ללא צום",
    appliesTo: ["test", "imaging", "procedure"],
    match: (offer, value) => value !== true || !offer.service.requires_fasting,
  },
  {
    key: "noContrast",
    group: "הכנה ודרישות",
    type: "toggle",
    label: "ללא חומר ניגוד",
    appliesTo: ["imaging"],
    match: (offer, value) => value !== true || !offer.service.requires_contrast,
  },
  {
    key: "noRadiation",
    group: "הכנה ודרישות",
    type: "toggle",
    label: "ללא קרינה",
    appliesTo: ["imaging"],
    match: (offer, value) => value !== true || !offer.service.has_radiation,
  },
  {
    key: "noHospital",
    group: "הכנה ודרישות",
    type: "toggle",
    label: "ללא אשפוז",
    appliesTo: ["surgery", "procedure"],
    match: (offer, value) => value !== true || !offer.service.requires_hospital,
  },
];

const REGISTRY_BY_KEY = new Map(FILTER_REGISTRY.map((f) => [f.key, f]));

export function filterOptions(def: FilterDef, ctx: SearchContext): FilterOption[] {
  if (!def.options) return [];
  return typeof def.options === "function" ? def.options(ctx) : def.options;
}

/**
 * Which filters to show right now. Contextual ones appear only when the
 * catalogue actually contains a service type they apply to, so the sheet
 * lists what's relevant to this deployment's data instead of every filter
 * the system will ever support. Deliberately keyed off the full offer index
 * rather than the current results: a filter that vanished as soon as it
 * narrowed the list would be impossible to undo from inside the sheet.
 */
export function visibleFilters(offers: Offer[]): FilterDef[] {
  const presentTypes = new Set(offers.map((o) => o.service.service_type ?? "consultation"));
  return FILTER_REGISTRY.filter((f) => !f.appliesTo || f.appliesTo.some((t) => presentTypes.has(t)));
}

/** Whether a stored filter value actually narrows anything. */
export function isActive(value: FilterValue): boolean {
  if (value === undefined || value === false || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function activeFilterCount(query: SearchQuery): number {
  return Object.values(query.filters).filter(isActive).length;
}

// ---------------------------------------------------------------------------
// Matching + facet counts
// ---------------------------------------------------------------------------

export function matchesQuery(offer: Offer, query: SearchQuery, ctx: SearchContext): boolean {
  if (query.performerId && offer.doctor?.id !== query.performerId) return false;
  if (query.serviceName && offer.service.name !== query.serviceName) return false;
  if (query.text && !matchesText(offer, query.text)) return false;

  for (const [key, value] of Object.entries(query.filters)) {
    if (!isActive(value)) continue;
    const def = REGISTRY_BY_KEY.get(key);
    if (!def) continue;
    if (!def.match(offer, value, ctx)) return false;
  }
  return true;
}

export function searchOffers(query: SearchQuery, ctx: SearchContext): Offer[] {
  return ctx.offers.filter((offer) => matchesQuery(offer, query, ctx));
}

/**
 * How many results the patient would get if she also picked this option —
 * the same engine, run with one value overridden. Because counts and results
 * share one predicate set they can never drift apart.
 */
export function facetCount(query: SearchQuery, key: string, value: FilterValue, ctx: SearchContext): number {
  const probe: SearchQuery = { ...query, filters: { ...query.filters, [key]: value } };
  return ctx.offers.reduce((n, offer) => (matchesQuery(offer, probe, ctx) ? n + 1 : n), 0);
}

/** Toggling one value of a multi-select, returning the next array. */
export function toggleMulti(current: FilterValue, value: string): string[] {
  const list = Array.isArray(current) ? current : [];
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// ---------------------------------------------------------------------------
// Grouping — same results, two presentations
// ---------------------------------------------------------------------------

export interface ServiceGroup {
  kind: "service";
  key: string;
  serviceName: string;
  offers: Offer[];
  /** Cheapest certain payable price across the group's offers, when known. */
  bestPricing: OfferPricing | null;
  serviceType: ProviderServiceType;
  durationMinutes: number;
  clinicNames: string[];
  /**
   * Whether a kupah referral is needed. The same service can require one at
   * one provider and not at another, so this distinguishes "always" from
   * "only at some of them" instead of flattening to a single yes/no.
   */
  referral: "none" | "some" | "all";
  coverage: CoverageSummary;
}

/**
 * Which funding routes exist for ≥1 item in a container (a provider's card or
 * a service's card). This is what a search card communicates instead of a
 * final price: availability and potential, per the container/item principle —
 * a personalized price only exists at the item level.
 */
export interface CoverageSummary {
  /** ≥1 item here is basket-covered — not a price, its own indicator. */
  hasBasket: boolean;
  /** Arrangement labels, e.g. "מחיר הסדר · מכבי שלי" — distinct. */
  arrangements: string[];
  /** Plans worth checking for reimbursement on full-price items. Never an amount. */
  reimbursementHints: string[];
  /** ≥1 item here is plain base price with no hint. */
  hasBaseOnly: boolean;
}

export function coverageSummary(offers: Offer[], patient?: Patient | null): CoverageSummary {
  const arrangements: string[] = [];
  const reimbursementHints: string[] = [];
  let hasBasket = false;
  let hasBaseOnly = false;

  for (const offer of offers) {
    const pricing = offerPricing(offer, patient);
    if (!pricing) continue;
    switch (pricing.kind) {
      case "basket":
        hasBasket = true;
        break;
      case "arrangement":
        if (!arrangements.includes(pricing.label)) arrangements.push(pricing.label);
        break;
      case "base":
        if (pricing.reimbursementHint?.length) {
          for (const plan of pricing.reimbursementHint) {
            if (!reimbursementHints.includes(plan)) reimbursementHints.push(plan);
          }
        } else {
          hasBaseOnly = true;
        }
        break;
      case "tourist":
        // Tourist pricing is the profile's single route — the strip says it
        // once for the whole page; repeating it per container is noise.
        break;
    }
  }
  return { hasBasket, arrangements, reimbursementHints, hasBaseOnly };
}

/**
 * Cheapest CERTAIN payable price across a set of offers — what "החל מ־" may
 * honestly promise. Basket-covered items are excluded: "from 0₪" reads like a
 * bug and mixes a coverage state into a price axis; the container carries a
 * separate hasBasket indicator instead.
 */
function bestPricingOf(offers: Offer[], patient?: Patient | null): OfferPricing | null {
  let best: OfferPricing | null = null;
  for (const offer of offers) {
    const pricing = offerPricing(offer, patient);
    if (!pricing || pricing.kind === "basket") continue;
    if (!best || pricing.price < best.price) best = pricing;
  }
  return best;
}

/** The kinds of work a performer does — ייעוץ / בדיקה / ניתוח and so on. */
function serviceTypesOf(offers: Offer[]): ProviderServiceType[] {
  const set = new Set<ProviderServiceType>();
  for (const offer of offers) set.add(offer.service.service_type ?? "consultation");
  return Array.from(set);
}

/** Distinct places, naming the organization when the clinic belongs to one. */
function clinicNamesOf(offers: Offer[]): string[] {
  const names = new Set<string>();
  for (const offer of offers) {
    for (const clinic of offer.clinics) {
      names.add(offer.organization ? `${offer.organization.display_name} · ${clinic.name}` : clinic.name);
    }
  }
  return Array.from(names);
}

export interface ProviderGroup {
  kind: "provider";
  key: string;
  /** Always a person — organizations are locations, never group headers. */
  doctor: ProviderProfile;
  offers: Offer[];
  clinicCount: number;
  clinicNames: string[];
  serviceTypes: ProviderServiceType[];
  bestPricing: OfferPricing | null;
  coverage: CoverageSummary;
}

export type ResultGroup = ServiceGroup | ProviderGroup;

/**
 * Offers with no performing doctor — imaging and lab work run by a station.
 * They can't be grouped under a person, so the UI reports them instead of
 * silently dropping them.
 */
export function offersWithoutDoctor(offers: Offer[]): Offer[] {
  return offers.filter((o) => !o.doctor);
}

export function groupOffers(offers: Offer[], groupBy: SearchQuery["groupBy"], patient?: Patient | null): ResultGroup[] {
  if (groupBy === "provider") {
    const map = new Map<string, Offer[]>();
    for (const offer of offers) {
      if (!offer.doctor) continue;
      const list = map.get(offer.doctor.id);
      if (list) list.push(offer);
      else map.set(offer.doctor.id, [offer]);
    }
    return Array.from(map.entries())
      .map(([id, groupOffersList]) => ({
        kind: "provider" as const,
        key: id,
        doctor: groupOffersList[0].doctor as ProviderProfile,
        offers: groupOffersList,
        clinicCount: new Set(groupOffersList.flatMap((o) => o.clinics.map((c) => c.id))).size,
        clinicNames: clinicNamesOf(groupOffersList),
        serviceTypes: serviceTypesOf(groupOffersList),
        bestPricing: bestPricingOf(groupOffersList, patient),
        coverage: coverageSummary(groupOffersList, patient),
      }))
      .sort((a, b) => providerLabel(a.doctor).localeCompare(providerLabel(b.doctor), "he"));
  }

  const map = new Map<string, Offer[]>();
  for (const offer of offers) {
    const list = map.get(offer.service.name);
    if (list) list.push(offer);
    else map.set(offer.service.name, [offer]);
  }
  return Array.from(map.entries()).map(([name, groupOffersList]) => {
    const needsReferral = groupOffersList.filter((o) => requiresReferral(o.service)).length;
    return {
      kind: "service" as const,
      key: name,
      serviceName: name,
      offers: groupOffersList,
      bestPricing: bestPricingOf(groupOffersList, patient),
      serviceType: groupOffersList[0].service.service_type ?? "consultation",
      durationMinutes: groupOffersList[0].service.duration_minutes,
      clinicNames: clinicNamesOf(groupOffersList),
      referral:
        needsReferral === 0 ? ("none" as const) : needsReferral === groupOffersList.length ? ("all" as const) : ("some" as const),
      coverage: coverageSummary(groupOffersList, patient),
    };
  });
}
