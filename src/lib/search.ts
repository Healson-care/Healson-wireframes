// Faceted service search — the matching engine behind /client/search.
//
// Two ideas carry this file:
//
// 1. The unit of search is an **Offer**: one service, offered by one provider,
//    at ONE branch. A provider with 3 services and 2 clinics produces 6 offers,
//    because the branch is part of what she is choosing, not a detail settled
//    afterwards: it decides the drive, and — where a site's agreements differ
//    per branch — the price too. Splitting here rather than at render time is
//    what keeps the result count, the facet counts and the cards describing one
//    same set. It also lets "search by doctor" and "search by service" stay two
//    *presentations* of one result set instead of two screens.
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
  OrganizationBranch,
  ConsultationType,
  InsuranceLayer,
  LocationType,
  Patient,
  PROVIDER_SERVICE_TYPE_LABELS,
  PROVIDER_TYPE_LABELS,
  ProviderProfile,
  ProviderServiceType,
  ProviderType,
} from "@/types";
import { FundingKind, PriceBreakdown, resolvePriceBreakdown } from "@/lib/pricing";
import { SEED_SKILL_DOMAINS, SEED_SKILL_SUBDOMAINS } from "@/lib/medical-tree";
import { findMohCode } from "@/lib/moh-codes";
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

/**
 * Where an offer can be had. Two different entities model a place in this
 * system — a solo provider's `Clinic`, and a unit's `OrganizationBranch` (its
 * own store slice, NOT clinic_locations) — so search works against this
 * common shape instead of privileging one of them.
 */
export interface OfferLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  /** The station performing it, when the location came from a facility. */
  facilityName?: string;
  locationType?: LocationType;
}

function clinicAsLocation(clinic: Clinic): OfferLocation {
  return {
    id: clinic.id,
    name: clinic.name,
    address: clinic.address,
    city: clinic.city,
    locationType: clinic.location_type,
  };
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
   * The ONE place this offer is bookable at. A service may be restricted to
   * some of the provider's clinics via `linked_clinic_ids`; an affiliated
   * doctor may work at only some of those; and an imaging item is bound to
   * the branches whose stations actually perform it. Whatever survives all
   * three, each surviving branch becomes an offer of its own.
   */
  clinic: OfferLocation;
}

/**
 * Flattens published providers into the offer index the whole search runs on,
 * one row per service × performer × BRANCH. Services with no bookable location
 * drop out — an offer that can't be booked shouldn't be findable.
 */
export function buildOffers(providers: ProviderProfile[], branches: OrganizationBranch[] = []): Offer[] {
  const byId = new Map(providers.map((p) => [p.id, p]));
  const branchById = new Map(branches.map((b) => [b.id, b]));

  /**
   * Imaging and lab items hang off a STATION, not a person: the עמדה declares
   * which items it performs and which branch it stands in. So the places such
   * a service can be had are exactly the branches of the stations that
   * perform it — which is also why a unit with an empty `clinic_locations`
   * still has locations.
   */
  const facilityLocations = (provider: ProviderProfile, serviceId: string): OfferLocation[] => {
    const seen = new Map<string, OfferLocation>();
    for (const facility of provider.facilities ?? []) {
      if (facility.is_active === false) continue;
      if (!facility.service_ids?.includes(serviceId)) continue;
      const branch = facility.branch_id ? branchById.get(facility.branch_id) : undefined;
      if (!branch) continue;
      seen.set(branch.id, {
        id: branch.id,
        name: branch.name,
        address: branch.address ?? "",
        city: branch.city ?? "",
        facilityName: facility.name,
      });
    }
    return Array.from(seen.values());
  };

  const offers: Offer[] = [];

  for (const provider of providers) {
    if (!provider.is_published) continue;
    const allClinics = (provider.clinic_locations ?? []).map(clinicAsLocation);

    for (const service of provider.consultation_types ?? []) {
      const linked = service.linked_clinic_ids;
      const linkedClinics = linked?.length ? allClinics.filter((c) => linked.includes(c.id)) : allClinics;
      // A unit keeps its places as branches, so fall back to the stations when
      // there are no clinic records to work from.
      const serviceClinics = linkedClinics.length > 0 ? linkedClinics : facilityLocations(provider, service.id);
      if (serviceClinics.length === 0) continue;

      if (!isOrganization(provider)) {
        for (const clinic of serviceClinics) {
          offers.push({
            id: `${provider.id}:${service.id}:${clinic.id}`,
            provider,
            doctor: provider,
            service,
            clinic,
          });
        }
        continue;
      }

      // An organization is a place. Its performer is one of its affiliated
      // doctors, matched per service — a doctor delivers only part of the
      // organization's catalogue.
      // An imaging/lab item performed by a station is never a doctor's, even
      // if the unit happens to have affiliated doctors — the station's own
      // service_ids are the authority on who performs what.
      const stationRun = facilityLocations(provider, service.id).length > 0;
      const affiliations = stationRun
        ? []
        : (provider.affiliated_doctors ?? []).filter((a) => a.service_ids.includes(service.id));
      if (affiliations.length === 0) {
        // No doctor at all, and that's correct: imaging and lab work are
        // delivered by a station. The offer still exists, it just has no
        // person to group it under.
        for (const clinic of serviceClinics) {
          offers.push({
            id: `${provider.id}:${service.id}:${clinic.id}`,
            provider,
            organization: provider,
            service,
            clinic,
          });
        }
        continue;
      }

      for (const affiliation of affiliations) {
        const clinicIds = affiliation.clinic_ids;
        const clinics = clinicIds?.length ? serviceClinics.filter((c) => clinicIds.includes(c.id)) : serviceClinics;
        for (const clinic of clinics) {
          offers.push({
            id: `${provider.id}:${service.id}:${affiliation.id}:${clinic.id}`,
            provider,
            doctor: byId.get(affiliation.doctor_provider_id),
            organization: provider,
            service,
            clinic,
          });
        }
      }
    }
  }
  return offers;
}

/**
 * Display name for a person or a place. Several seeded records already carry
 * the title inside `display_name` ("ד״ר אבי לוי"), so prefixing unconditionally
 * produced "ד״ר ד״ר אבי לוי" — the title is added only when it isn't there.
 */
export function providerLabel(provider: ProviderProfile): string {
  const name = (provider.display_name ?? "").trim();
  const title = (provider.title ?? "").trim();
  if (!title || name.startsWith(title)) return name;
  return `${title} ${name}`;
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
/**
 * How this offer is funded.
 *
 * Whose agreement counts depends on who performs the service:
 *
 * - A DOCTOR is in-network as a person, so their own agreements govern and
 *   the location is irrelevant — the same doctor gives the same patient the
 *   same price at every clinic they work from.
 * - A service run by a station with no doctor (imaging, lab) is funded by the
 *   PLACE, so the site's agreements govern and they can differ per branch —
 *   which is the only case where `clinicId` changes the answer.
 *
 * An offer now IS one branch, so `clinicId` defaults to that branch: every
 * price on a card is the price at the place the card names, and a caller has
 * to opt out explicitly rather than get an unscoped answer by omission.
 */
export function offerPricing(offer: Offer, patient?: Patient | null, clinicId?: string): OfferPricing | null {
  const doctorAgreements = offer.doctor?.agreements?.length ? offer.doctor.agreements : undefined;
  const breakdown = resolvePriceBreakdown(
    offer.service.prices,
    doctorAgreements ?? offer.provider.agreements,
    patient,
    offer.service.price_full,
    offer.service,
    // Only the site's own agreements are ever branch-scoped.
    doctorAgreements ? undefined : clinicId ?? offer.clinic.id
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
  /** Anchored to one doctor — from the omnibox or the performer gate. */
  performerId: string | null;
  /** Anchored to one institute/unit — the other half of the performer gate. */
  organizationId: string | null;
  /** Anchored to one service name — set by picking a service, or a referral. */
  serviceName: string | null;
  /** Recognised referral code, kept so the UI can show why serviceName is set. */
  referralCode: string | null;
  /**
   * Registry-driven filters, keyed by FilterDef.key.
   *
   * This is the ONLY thing that narrows the result set. There used to be a
   * `groupBy` field beside it that quietly dropped every offer without a
   * doctor — a narrowing with no chip, outside the filter count, untouched by
   * "נקה הכל", and applied to the offer index every control read from rather
   * than to the results. It is now the `doctorDelivered` filter in the
   * registry, so it is visible, countable and clearable like everything else.
   */
  filters: Record<string, FilterValue>;
}

export function emptyQuery(): SearchQuery {
  return { text: "", performerId: null, organizationId: null, serviceName: null, referralCode: null, filters: {} };
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

/**
 * Everything one offer can be found by. The box is a single field, so this is
 * the whole vocabulary the patient may type — she doesn't know, and shouldn't
 * have to know, which of these is "the searchable one".
 */
function offerHaystack(offer: Offer): string {
  const { doctor, organization, service, clinic } = offer;
  const person = attributeSource(offer);
  const domainId = offerDomainId(offer);
  const subdomainId = offerSubdomainId(offer);
  return [
    // The code is searchable text like any other: a referral slip says 54021
    // long before it says "MRI עמוד שדרה מותני".
    service.moh_code,
    service.name,
    doctor?.display_name,
    doctor?.title,
    organization?.display_name,
    // "מכון", "בית חולים" — she may be looking for a kind of place, not a name.
    organization?.provider_type ? PROVIDER_TYPE_LABELS[organization.provider_type] : "",
    person.specialty,
    ...(person.sub_specialties ?? []),
    service.service_type ? PROVIDER_SERVICE_TYPE_LABELS[service.service_type] : "",
    // WHERE. Now that an offer is one branch, the place is part of what she's
    // searching for: "MRI חיפה" has to be one query, not a search then a filter.
    clinic.name,
    clinic.city,
    clinic.facilityName,
    getRegionForCity(clinic.city),
    // The catalogue's own name for the field. A doctor's specialty string
    // doesn't always carry it, and a station-run MRI has no doctor at all — so
    // without this, "אורתופדיה" simply misses every machine-run item.
    domainId ? domainLabel(domainId) : "",
    subdomainId ? subdomainLabel(subdomainId) : "",
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

export type SuggestionKind = "provider" | "service" | "referral" | "organization" | "city";

/**
 * What the patient is currently browsing. It no longer decides WHAT the box
 * may return — every kind of entity is always reachable, because a single
 * field that silently refuses to find a city is a field she has to be taught.
 * Scope now only decides the ORDER: browsing by provider puts people first.
 */
export type SearchScope = "service" | "provider";

export interface Suggestion {
  kind: SuggestionKind;
  /**
   * Provider id for "provider", organization id for "organization", the town
   * for "city", and the service name for "service" / "referral".
   */
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
    // Counted over the offer rows, which are now per branch — so both numbers
    // have to be de-duplicated, or a doctor with 2 clinics would be credited
    // with twice the services she actually gives.
    const serviceCount = new Set(own.map((o) => o.service.id)).size;
    const clinicCount = new Set(own.map((o) => o.clinic.id)).size;
    out.push({
      kind: "provider",
      value: doctor.id,
      label: providerLabel(doctor),
      detail: `${doctor.specialty} · ${serviceCount} שירותים · ${clinicCount} מיקומים`,
      viaSynonym: terms ? synonymHint(lower, hay) : undefined,
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "he"));
}

/** Distinct service names in the index. `terms === null` means "return them all". */
function serviceSuggestions(offers: Offer[], terms: string[] | null, lower: string): Suggestion[] {
  // Two distinct counts, because the offer rows are per branch: how many
  // performers give it, and how many places it can be had at. "3 נותני שירות"
  // taken off the raw row count would double any provider with two branches.
  const performers = new Map<string, Set<string>>();
  const branches = new Map<string, Set<string>>();
  for (const offer of offers) {
    const hay = offer.service.name.toLowerCase();
    if (terms && !terms.some((t) => hay.includes(t))) continue;
    const name = offer.service.name;
    if (!performers.has(name)) performers.set(name, new Set());
    if (!branches.has(name)) branches.set(name, new Set());
    performers.get(name)!.add(offer.doctor?.id ?? offer.provider.id);
    branches.get(name)!.add(offer.clinic.id);
  }
  return Array.from(performers.entries())
    .map(([name, providerIds]) => ({
      kind: "service" as const,
      value: name,
      label: name,
      detail: `${providerIds.size} נותני שירות · ${branches.get(name)?.size ?? 0} סניפים`,
      viaSynonym: terms ? synonymHint(lower, name.toLowerCase()) : undefined,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "he"));
}

/** Distinct institutes and hospitals — places, as opposed to people. */
function organizationSuggestions(offers: Offer[], terms: string[] | null, lower: string): Suggestion[] {
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const offer of offers) {
    const org = offer.organization;
    if (!org || seen.has(org.id)) continue;
    const typeLabel = org.provider_type ? PROVIDER_TYPE_LABELS[org.provider_type] ?? "" : "";
    const hay = `${org.display_name} ${typeLabel}`.toLowerCase();
    if (terms && !terms.some((t) => hay.includes(t))) continue;
    seen.add(org.id);
    const own = offers.filter((o) => o.organization?.id === org.id);
    out.push({
      kind: "organization",
      value: org.id,
      label: providerLabel(org),
      detail: [typeLabel, `${new Set(own.map((o) => o.service.id)).size} שירותים`, `${new Set(own.map((o) => o.clinic.id)).size} סניפים`]
        .filter(Boolean)
        .join(" · "),
      viaSynonym: terms ? synonymHint(lower, hay) : undefined,
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "he"));
}

/**
 * Towns the catalogue actually reaches. Worth its own kind rather than being
 * left to free text: "חיפה" typed into the box should narrow the map, which is
 * a filter, not a search term that has to keep re-matching every row.
 */
function citySuggestions(offers: Offer[], terms: string[] | null, lower: string): Suggestion[] {
  const counts = new Map<string, number>();
  for (const offer of offers) {
    const city = offer.clinic.city;
    if (!city) continue;
    const hay = `${city} ${getRegionForCity(city)}`.toLowerCase();
    if (terms && !terms.some((t) => hay.includes(t))) continue;
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([city, count]) => ({
      kind: "city" as const,
      value: city,
      label: city,
      detail: `${getRegionForCity(city)} · ${count} הצעות`,
      viaSynonym: terms ? synonymHint(lower, city.toLowerCase()) : undefined,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "he"));
}

/**
 * Every kind of thing the box can resolve, blended into one list. Scope no
 * longer gates the kinds — it only decides which bucket leads — because a
 * single field that finds doctors but not the institute down the road is a
 * field the patient has to learn the rules of.
 *
 * One of each kind is taken before any bucket goes deep, so a common word that
 * matches thirty services can't crowd the one matching hospital off the list.
 */
function blend(buckets: Suggestion[][], limit: number): Suggestion[] {
  const out: Suggestion[] = [];
  for (const bucket of buckets) if (bucket[0]) out.push(bucket[0]);
  for (const bucket of buckets) for (const suggestion of bucket.slice(1)) out.push(suggestion);
  return out.slice(0, limit);
}

/**
 * Typed-entity suggestions. A referral code always leads when one is typed —
 * it names exactly one thing, so there is nothing to rank it against.
 */
export function suggest(text: string, offers: Offer[], scope: SearchScope, limit = 8): Suggestion[] {
  const raw = text.trim();
  if (raw.length < 2) return [];
  const terms = expandTerms(raw);
  const lower = raw.toLowerCase();

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

  const services = serviceSuggestions(offers, terms, lower);
  const doctors = doctorSuggestions(offers, terms, lower);
  const organizations = organizationSuggestions(offers, terms, lower);
  const cities = citySuggestions(offers, terms, lower);
  const buckets =
    scope === "provider"
      ? [doctors, organizations, services, cities]
      : [services, doctors, organizations, cities];

  return [...out, ...blend(buckets, limit - out.length)];
}

/**
 * The whole catalogue, browsable before anything is typed — so choosing never
 * depends on already knowing a name. Blended like the typed suggestions, and
 * for the same reason: the entry points are services, people, places and
 * towns, and the box shouldn't hide three of the four until she guesses right.
 */
export function listEntities(offers: Offer[], scope: SearchScope, limit = 40): Suggestion[] {
  const services = serviceSuggestions(offers, null, "");
  const doctors = doctorSuggestions(offers, null, "");
  const organizations = organizationSuggestions(offers, null, "");
  const cities = citySuggestions(offers, null, "");
  return blend(
    scope === "provider"
      ? [doctors, organizations, services, cities]
      : [services, doctors, organizations, cities],
    limit
  );
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
   * A gate: shown as its own control at the top of the search rather than
   * inside the sheet. These are the axes a patient narrows by before caring
   * about price or timing — what kind of item, from what kind of person, at
   * what kind of unit.
   */
  primary?: boolean;
  /**
   * Contextual filters (the second visibility layer): only shown when the
   * current results actually contain one of these service types. This is how
   * "ללא צום" stays out of the way of someone booking a consultation.
   */
  appliesTo?: ProviderServiceType[];
  /**
   * This filter is the SECOND LEVEL of another — sub-domain under domain, city
   * under region. A child value only means anything inside its parent, so the
   * two must move together: drop the parent and its children go, choose a
   * child and its parent comes with it.
   *
   * Declared here rather than enforced inside one control on purpose. The rule
   * used to live only in TwoLevelGate, which left every OTHER way of writing
   * these filters — removing a chip, picking a city from the omnibox — free to
   * break it. As data it is enforced once, for every writer that exists now
   * and every one added later.
   */
  parentKey?: string;
  /** Maps one of THIS filter's values to the parent value containing it. */
  parentOf?: (value: string) => string | undefined;
  match: (offer: Offer, value: FilterValue, ctx: SearchContext) => boolean;
}

const AVAILABILITY_MAX_DAYS: Record<string, number> = { week: 7, twoWeeks: 14, month: 30 };
const PRICE_CEILINGS: Record<string, number> = { p150: 150, p300: 300, p600: 600, p1000: 1000, p1500: 1500 };

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "he"));
}

const SUBDOMAIN_BY_ID = new Map(SEED_SKILL_SUBDOMAINS.map((s) => [s.id, s]));

/** Taxonomy ids are what the filters store — names are only ever labels. */
export function domainLabel(id: string): string {
  return SEED_SKILL_DOMAINS.find((d) => d.id === id)?.name_he ?? id;
}

export function subdomainLabel(id: string): string {
  return SUBDOMAIN_BY_ID.get(id)?.name_he ?? id;
}

export function subdomainParent(id: string): string | undefined {
  return SUBDOMAIN_BY_ID.get(id)?.domain_id;
}

/**
 * The medical domain an item belongs to — the axis a patient thinks in
 * ("אורתופדיה") before she knows any item's name. Two sources, in this order:
 *
 *  1. the MoH code, which carries the domain on the PROCEDURE itself. An MRI
 *     ברך is orthopaedic whether a doctor or a station performs it, and this
 *     is the only source a machine-run item has.
 *  2. the performing doctor's specialty — kept in the taxonomy's own words on
 *     purpose (see medical-tree.ts), so no mapping table is needed.
 *
 * An item with neither has no domain and simply drops out of this gate,
 * rather than being filed under a domain nobody chose for it.
 */
export function offerDomainId(offer: Offer): string | undefined {
  const coded = findMohCode(offer.service.moh_code)?.skill_domain_id;
  if (coded) return coded;
  return domainFromSpecialty(offer.doctor?.specialty);
}

/**
 * The sub-domain, one level down. Same order of sources: the code carries it,
 * and failing that a doctor's own declared sub-specialty — which is worded to
 * match the taxonomy on purpose (see medical-tree.ts), and is only trusted
 * inside the domain we already resolved.
 */
export function offerSubdomainId(offer: Offer): string | undefined {
  const coded = findMohCode(offer.service.moh_code)?.skill_subdomain_id;
  if (coded) return coded;
  const domainId = offerDomainId(offer);
  if (!domainId) return undefined;
  const declared = offer.doctor?.sub_specialties ?? [];
  return SEED_SKILL_SUBDOMAINS.find((s) => s.domain_id === domainId && declared.includes(s.name_he))?.id;
}

function domainFromSpecialty(specialty?: string): string | undefined {
  if (!specialty) return undefined;
  const exact = SEED_SKILL_DOMAINS.find((d) => d.name_he === specialty);
  if (exact) return exact.id;
  // The register's specialty list and the taxonomy agree on the words, not
  // always on the whole string — "רפואת עור" vs "דרמטולוגיה (רפואת עור)".
  return SEED_SKILL_DOMAINS.find((d) => d.name_he.includes(specialty) || specialty.includes(d.name_he))?.id;
}

function byLabel(a: FilterOption, b: FilterOption): number {
  return a.label.localeCompare(b.label, "he");
}

/**
 * The age band an item is offered for, in the words the catalogue uses —
 * "18+", "עד 12", "6–18", or no limit at all. Read straight off the item's own
 * min_age/max_age, so the filter can never claim an age rule the item doesn't
 * carry.
 */
export function ageBandOf(service: ConsultationType): string {
  const min = service.min_age;
  const max = service.max_age;
  if (!min && !max) return "כל הגילאים";
  if (min && !max) return `${min}+`;
  if (!min && max) return `עד ${max}`;
  return `${min}–${max}`;
}

export const FILTER_REGISTRY: FilterDef[] = [
  // The four primary axes, first in the sheet because they answer "in what
  // field, what kind of thing, from what kind of person, at what kind of
  // place" — the questions that come before any preference about price or
  // timing.
  {
    key: "domain",
    group: "תחום",
    type: "multi",
    primary: true,
    options: (ctx) =>
      Array.from(new Set(ctx.offers.map((o) => offerDomainId(o)).filter(Boolean) as string[]))
        .map((id) => ({ value: id, label: domainLabel(id) }))
        .sort(byLabel),
    match: (offer, value) =>
      !Array.isArray(value) || value.length === 0 || value.includes(offerDomainId(offer) ?? ""),
  },
  // Second level of the same axis. It is a gate (so the sheet won't draw it
  // twice) but has no control of its own — the domain gate opens it inline,
  // under whichever domain was chosen.
  {
    key: "subdomain",
    group: "תת-תחום",
    type: "multi",
    primary: true,
    parentKey: "domain",
    parentOf: subdomainParent,
    options: (ctx) =>
      Array.from(new Set(ctx.offers.map((o) => offerSubdomainId(o)).filter(Boolean) as string[]))
        .map((id) => ({ value: id, label: subdomainLabel(id) }))
        .sort(byLabel),
    match: (offer, value) =>
      !Array.isArray(value) || value.length === 0 || value.includes(offerSubdomainId(offer) ?? ""),
  },
  {
    key: "serviceType",
    group: "סוג פריט",
    type: "multi",
    primary: true,
    options: (ctx) =>
      uniqueSorted(ctx.offers.map((o) => o.service.service_type ?? "consultation")).map((v) => ({
        value: v,
        label: PROVIDER_SERVICE_TYPE_LABELS[v as ProviderServiceType] ?? v,
      })),
    match: (offer, value) =>
      !Array.isArray(value) || value.length === 0 || value.includes(offer.service.service_type ?? "consultation"),
  },
  // No control of its own any more: the performer gate writes this when she
  // picks a KIND of unit without naming one ("כל המכונים"). Still a gate, so
  // the sheet doesn't draw a second control for it.
  {
    key: "unitType",
    group: "סוג יחידה רפואית",
    type: "multi",
    primary: true,
    options: (ctx) =>
      uniqueSorted(ctx.offers.map((o) => o.organization?.provider_type ?? "").filter(Boolean)).map((v) => ({
        value: v,
        label: PROVIDER_TYPE_LABELS[v as ProviderType] ?? v,
      })),
    // A solo doctor's own clinic belongs to no unit, so asking for a unit type
    // is asking to see only what happens inside one.
    match: (offer, value) =>
      !Array.isArray(value) ||
      value.length === 0 ||
      (!!offer.organization?.provider_type && value.includes(offer.organization.provider_type)),
  },
  /**
   * The doctor half of the performer axis. `unitType` asks which KIND OF PLACE
   * performs the item; this asks whether a PERSON does — the same question, put
   * to the two kinds of performer the catalogue actually has.
   *
   * It replaces what used to be a hidden mode (`groupBy`), and being an
   * ordinary registry entry is the entire point. Two things follow for free:
   * it gets a chip, a place in the filter count and a reset from "נקה הכל"
   * like every other filter; and because it narrows RESULTS rather than the
   * offer index every control reads from, a station-run unit it rules out now
   * greys out instead of vanishing from the very gate that would undo it.
   *
   * Redundant whenever a specific performer is anchored — `performerId`
   * already implies a doctor — so the gate sets it only for "כל הרופאים".
   */
  {
    key: "doctorDelivered",
    group: "נותן שירות",
    label: "רק שירותים שרופא מבצע",
    type: "toggle",
    primary: true,
    match: (offer, value) => value !== true || !!offer.doctor,
  },
  {
    key: "region",
    group: "מיקום",
    type: "multi",
    // Where in the country is one of the questions asked before price or
    // timing — it belongs on the bar, not three taps deep in the sheet.
    primary: true,
    collapsible: true,
    options: (ctx) =>
      uniqueSorted(ctx.offers.map((o) => getRegionForCity(o.clinic.city))).map((v) => ({
        value: v,
        label: v,
      })),
    match: (offer, value) =>
      !Array.isArray(value) || value.length === 0 || value.includes(getRegionForCity(offer.clinic.city)),
  },
  // Age is a property of the ITEM, not of whoever is searching: each item
  // declares the range it's offered for (min_age / max_age), and this filter
  // groups the items by the range they carry. Bands, never an exact age —
  // "16+" is what the catalogue actually says, and asking her to type 34 would
  // invent a precision the data doesn't have.
  {
    key: "ageBand",
    group: "קבוצת גיל",
    type: "multi",
    options: (ctx) => {
      const bands = new Map<string, number>();
      for (const offer of ctx.offers) bands.set(ageBandOf(offer.service), offer.service.min_age ?? 0);
      return Array.from(bands.entries())
        .sort((a, b) => a[1] - b[1])
        .map(([label]) => ({ value: label, label }));
    },
    match: (offer, value) =>
      !Array.isArray(value) || value.length === 0 || value.includes(ageBandOf(offer.service)),
  },
  // The second level of מיקום: the actual towns the branches sit in. Region is
  // how you narrow when you don't know the map; a town is how you narrow when
  // you do. Driven by the region gate, never drawn on its own.
  {
    key: "city",
    group: "עיר",
    type: "multi",
    primary: true,
    parentKey: "region",
    parentOf: cityRegion,
    options: (ctx) => uniqueSorted(ctx.offers.map((o) => o.clinic.city)).map((v) => ({ value: v, label: v })),
    match: (offer, value) =>
      !Array.isArray(value) || value.length === 0 || value.includes(offer.clinic.city),
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
  /**
   * Not "is it cheap" but "who is paying, and how". The six answers are the
   * real routes a bill can take in this system, told apart by the layer that
   * settles it — which is why they're split by SOURCE (קופה vs. ביטוח) and not
   * lumped into one "יש כיסוי": a patient with a שב"ן and a private policy is
   * asking about two different wallets, and one chip can't answer both.
   *
   * "ייתכן החזר" stays deliberately hedged. Reimbursement is never computed
   * anywhere in this system — the plan is worth calling, that's all we know —
   * and a chip reading "החזר מהקופה" would promise a sum nobody calculated.
   */
  {
    key: "coverage",
    group: "מחיר וכיסוי",
    label: "כיסוי ביטוחי",
    type: "single",
    options: [
      { value: "basket", label: "כלול בסל" },
      { value: "arrangementK", label: 'הסדר עם הקופה (שב"ן)' },
      { value: "arrangementB", label: "הסדר עם הביטוח הפרטי" },
      { value: "reimburseK", label: "ייתכן החזר מהקופה" },
      { value: "reimburseB", label: "ייתכן החזר מהביטוח" },
      { value: "base", label: "מחיר מלא, ללא כיסוי" },
    ],
    match: (offer, value, ctx) => {
      if (typeof value !== "string" || !value) return true;
      const pricing = offerPricing(offer, ctx.patient);
      // Without a patient profile we can't know the funding route, so this
      // filter simply doesn't exclude anything rather than emptying the page.
      if (!pricing) return true;
      const patient = ctx.patient;
      const hint = pricing.reimbursementHint ?? [];

      switch (value) {
        case "basket":
          return pricing.kind === "basket";
        case "arrangementK":
          return pricing.kind === "arrangement" && pricing.layer === "K";
        case "arrangementB":
          return pricing.kind === "arrangement" && pricing.layer === "B";
        // A hint names the PLANS worth checking, so "from the kupah" means her
        // own שב"ן is among them — never merely that some plan is.
        case "reimburseK":
          return pricing.kind === "base" && !!patient?.k_level && hint.includes(patient.k_level);
        case "reimburseB":
          return (
            pricing.kind === "base" &&
            (patient?.b_insurances ?? []).some((insurance) => hint.includes(insurance.company))
          );
        case "base":
          return pricing.kind === "base" && hint.length === 0;
        // No umbrella value here on purpose. There used to be an "arrangement"
        // case matching either layer, written only by a quick chip and absent
        // from the options above — so the sheet could not draw the state the
        // chip put the filter into. Every value this filter accepts is now one
        // the sheet lists.
        default:
          return true;
      }
    },
  },
  {
    key: "priceCeiling",
    group: "מחיר וכיסוי",
    label: "תקרת מחיר",
    type: "single",
    // Read against what SHE pays after her own coverage, not the list price —
    // an item in the basket sits under every ceiling, which is correct.
    options: [
      { value: "p150", label: "עד 150 ₪" },
      { value: "p300", label: "עד 300 ₪" },
      { value: "p600", label: "עד 600 ₪" },
      { value: "p1000", label: "עד 1,000 ₪" },
      { value: "p1500", label: "עד 1,500 ₪" },
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
  // Location and "who gives it" left the sheet: both are gates on the bar now,
  // and a second control writing the same axis would fight the first. What
  // stays here is what the bar doesn't ask — the language they speak and how
  // they're rated.
  {
    key: "language",
    group: "שפות",
    type: "multi",
    collapsible: true,
    options: (ctx) =>
      uniqueSorted(ctx.offers.flatMap((o) => attributeSource(o).languages ?? [])).map((v) => ({ value: v, label: v })),
    match: (offer, value) =>
      !Array.isArray(value) ||
      value.length === 0 ||
      value.every((lang) => (attributeSource(offer).languages ?? []).includes(lang)),
  },
  // A floor, not a band: nobody looks for "exactly 4 stars". Single-select,
  // because two floors at once is a contradiction.
  {
    key: "rating",
    group: "דירוגים",
    type: "single",
    options: [
      { value: "4.5", label: "4.5 ומעלה" },
      { value: "4", label: "4 ומעלה" },
      { value: "3.5", label: "3.5 ומעלה" },
    ],
    match: (offer, value) =>
      typeof value !== "string" || !value || (attributeSource(offer).rating ?? 0) >= Number(value),
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
 *
 * `filters` is not used to narrow this list — only to protect it. Passing the
 * live filter values is what lets an active filter override the relevance
 * test, so the promise above holds even if a future caller hands in something
 * narrower than the full index.
 */
export function visibleFilters(offers: Offer[], filters: SearchQuery["filters"]): FilterDef[] {
  const presentTypes = new Set(offers.map((o) => o.service.service_type ?? "consultation"));
  // Gates are rendered at the top of the search, so the sheet must not repeat
  // them — two controls writing one filter key would fight each other.
  return FILTER_REGISTRY.filter((f) => !f.primary).filter(
    // ACTIVE BEATS RELEVANT. The relevance test decides what to OFFER; it must
    // never decide what to HIDE. A contextual filter that is switched on has
    // to stay on screen even once its service type has left the catalogue,
    // because otherwise it goes on narrowing the results with no control
    // anywhere to switch it off — countable in the filter badge, invisible in
    // the sheet, escapable only by "נקה הכל". This guard makes that state
    // unreachable no matter what index a caller passes in.
    (f) => isActive(filters[f.key]) || !f.appliesTo || f.appliesTo.some((t) => presentTypes.has(t))
  );
}

/** The gates — the axes shown above the search rather than inside the sheet. */
export function primaryFilters(): FilterDef[] {
  return FILTER_REGISTRY.filter((f) => f.primary);
}

/**
 * A gate's options, ordered by what the rest of the search leaves reachable:
 * everything that passes the other gates first, everything else after it. The
 * unreachable ones are NOT dropped — each still renders, greyed out by its own
 * zero count, because a domain that silently disappears the moment she picks
 * "הדמיה" reads as a bug, while a greyed one says "not with what you've
 * chosen" and can be reasoned about.
 *
 * The gate's own value is excluded from the probe on purpose: a gate that
 * erased its own alternatives the moment it was used could only be cleared,
 * never changed.
 */
export function gateOptions(def: FilterDef, query: SearchQuery, ctx: SearchContext): FilterOption[] {
  const probe: SearchQuery = { ...query, filters: { ...query.filters, [def.key]: undefined } };
  const scoped: SearchContext = { ...ctx, offers: ctx.offers.filter((o) => matchesQuery(o, probe, ctx)) };
  const available = new Set(filterOptions(def, scoped).map((o) => o.value));
  const all = filterOptions(def, ctx);
  return [...all.filter((o) => available.has(o.value)), ...all.filter((o) => !available.has(o.value))];
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
  if (query.organizationId && offer.organization?.id !== query.organizationId) return false;
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
  return sortOffers(
    ctx.offers.filter((offer) => matchesQuery(offer, query, ctx)),
    ctx.patient
  );
}

/**
 * One item appears once per unit/provider that offers it AND once per branch —
 * MRI ראש at five institutes with two branches each is ten results, every one
 * of them a place she could actually drive to, with that place's own price.
 * That's the whole point of the offer model, so the ordering has to make the
 * repetition legible: identical items land next to each other, cheapest first
 * within the group. Otherwise the copies scatter through the list and the
 * comparison she came to make is impossible to see.
 *
 * City breaks a price tie, so the branches of one provider don't interleave
 * with another's at the same price — at equal cost the next question is where.
 */
export function sortOffers(offers: Offer[], patient?: Patient | null): Offer[] {
  const price = (offer: Offer) => offerPricing(offer, patient)?.price ?? Number.POSITIVE_INFINITY;
  return [...offers].sort(
    (a, b) =>
      a.service.name.localeCompare(b.service.name, "he") ||
      price(a) - price(b) ||
      a.clinic.city.localeCompare(b.clinic.city, "he") ||
      a.clinic.name.localeCompare(b.clinic.name, "he")
  );
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

/** Which region a town belongs to — the parent link of the מיקום gate. */
export function cityRegion(city: string): string {
  return getRegionForCity(city);
}

export interface GateChip {
  key: string;
  value: string;
  label: string;
  group: string;
  /**
   * A yes/no gate, whose label is already a whole sentence. Rendered without
   * the "axis: value" prefix the list-valued chips use, which would otherwise
   * read "נותן שירות: רק שירותים שרופא מבצע".
   */
  standalone?: boolean;
}

/**
 * Everything the gates are currently narrowing by, one chip per value. The bar
 * shows the first choice per axis and a "+2"; this is the full list, so nothing
 * she picked can keep filtering from a place she can't see it — every chip
 * carries its own X.
 */
export function activeGateChips(query: SearchQuery, ctx: SearchContext): GateChip[] {
  const chips: GateChip[] = [];
  for (const def of primaryFilters()) {
    const value = query.filters[def.key];
    // A yes/no gate holds no list of values — that it is ON *is* the chip.
    // Without this branch such a filter would keep narrowing with nothing on
    // screen to undo it, which is the exact failure this function exists for.
    if (value === true) {
      chips.push({
        key: def.key,
        value: "true",
        label: def.label ?? def.group,
        group: def.group,
        standalone: true,
      });
      continue;
    }
    if (!Array.isArray(value) || value.length === 0) continue;
    const options = filterOptions(def, ctx);
    for (const v of value) {
      chips.push({ key: def.key, value: v, label: options.find((o) => o.value === v)?.label ?? v, group: def.group });
    }
  }
  return chips;
}

/**
 * The single gate every filter write passes through. It applies the rules that
 * relate one filter to another, so no control has to remember them.
 *
 * Today that means the parent/child pairs declared in the registry. Both
 * directions are needed, and which one applies can only be decided by looking
 * at what CHANGED — which is why this takes the previous query as well as the
 * next one:
 *
 * - a parent that was just dropped takes its children with it. Without this,
 *   removing "אורתופדיה" from the chip row leaves "ברך" narrowing on its own,
 *   while its gate reads "הכל" and offers no way to switch it off — children
 *   are only drawn underneath a selected parent.
 * - a child that was just chosen brings its parent in. Without this, picking
 *   "חיפה" from the search box would leave the location gate reading "הכל"
 *   while a city quietly filtered.
 *
 * Deciding on the delta rather than on the final state is what keeps the two
 * rules from fighting: applied blindly, "a child implies its parent" would
 * simply put back any parent the patient just removed.
 */
export function normalizeQuery(prev: SearchQuery, next: SearchQuery): SearchQuery {
  const asList = (value: FilterValue) => (Array.isArray(value) ? value : []);
  let filters = next.filters;
  const write = (key: string, list: string[]) => {
    if (filters === next.filters) filters = { ...next.filters };
    filters[key] = list.length ? list : undefined;
  };

  for (const def of FILTER_REGISTRY) {
    const parentKey = def.parentKey;
    const parentOf = def.parentOf;
    if (!parentKey || !parentOf) continue;

    const parentsBefore = asList(prev.filters[parentKey]);
    const parentsAfter = asList(filters[parentKey]);
    const childrenBefore = asList(prev.filters[def.key]);
    const childrenAfter = asList(filters[def.key]);

    const droppedParents = parentsBefore.filter((p) => !parentsAfter.includes(p));
    if (droppedParents.length > 0) {
      const kept = childrenAfter.filter((c) => {
        const parent = parentOf(c);
        return !parent || !droppedParents.includes(parent);
      });
      if (kept.length !== childrenAfter.length) write(def.key, kept);
      // A write that removed a parent is never also adding a child, so the
      // second rule can't apply in the same step.
      continue;
    }

    const addedChildren = childrenAfter.filter((c) => !childrenBefore.includes(c));
    if (addedChildren.length > 0) {
      const missing = Array.from(
        new Set(addedChildren.map(parentOf).filter((p): p is string => !!p && !parentsAfter.includes(p)))
      );
      if (missing.length > 0) write(parentKey, [...parentsAfter, ...missing]);
    }
  }

  return filters === next.filters ? next : { ...next, filters };
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
  // No inner loop over branches any more: an offer IS a branch, so the set
  // handed in already contains every place she could go, each priced at its
  // own site's agreements.
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
    names.add(
      offer.organization ? `${offer.organization.display_name} · ${offer.clinic.name}` : offer.clinic.name
    );
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

export function groupOffers(
  offers: Offer[],
  groupBy: "service" | "provider",
  patient?: Patient | null
): ResultGroup[] {
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
        clinicCount: new Set(groupOffersList.map((o) => o.clinic.id)).size,
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
