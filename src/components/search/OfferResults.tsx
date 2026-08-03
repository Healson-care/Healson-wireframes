"use client";

import { ReactNode, useState } from "react";
import { ArrowRight, ChevronLeft, FileText, MapPin, ReceiptText, ShieldCheck, Star, Stethoscope, Tag } from "lucide-react";
import { EmptyState } from "@/components/ui/Misc";
import { InsurancePriceBlock } from "@/components/book/InsurancePriceBlock";
import { InsuranceLogo } from "@/components/search/InsuranceLogo";
import { requiresReferral } from "@/lib/referral";
import { formatCurrency } from "@/lib/utils";
import { CoverageSummary, Offer, OfferPricing, ResultGroup, offerPricing, providerLabel } from "@/lib/search";
import { Patient, PROVIDER_SERVICE_TYPE_LABELS } from "@/types";

/**
 * One result set, two presentations. Grouping by service answers "who can do
 * this for me"; grouping by provider answers "what can this doctor do for me,
 * and where". Neither is a different search — same offers, same filters.
 */
export function OfferResults({
  groups,
  onOpenGroup,
  onSelectOffer,
}: {
  groups: ResultGroup[];
  /** Drill into a card — its own screen, not an inline expansion. */
  onOpenGroup: (group: ResultGroup) => void;
  onSelectOffer: (offer: Offer) => void;
}) {
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<Stethoscope className="h-10 w-10" />}
        title="לא נמצאו שירותים מתאימים"
        description="נסו להסיר מסנן או לשנות את החיפוש"
      />
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) =>
        group.kind === "service" ? (
          <ServiceGroupCard key={group.key} group={group} onOpen={onOpenGroup} onSelectOffer={onSelectOffer} />
        ) : (
          <ProviderGroupCard key={group.key} group={group} onOpen={onOpenGroup} onSelectOffer={onSelectOffer} />
        )
      )}
    </div>
  );
}

function ServiceGroupCard({
  group,
  onOpen,
  onSelectOffer,
}: {
  group: Extract<ResultGroup, { kind: "service" }>;
  onOpen: (group: ResultGroup) => void;
  onSelectOffer: (offer: Offer) => void;
}) {
  // A single provider means there is nothing to compare — skip the detail
  // screen and go straight to picking a time.
  const single = group.offers.length === 1;

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        onClick={() => (single ? onSelectOffer(group.offers[0]) : onOpen(group))}
        className="focus-ring flex w-full flex-col gap-2 rounded-xl p-4 text-right sm:flex-row sm:items-start sm:justify-between sm:gap-3"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{group.serviceName}</p>

          {/* Where it can be had — first, because it decides whether the rest
              of the card is even relevant to her. */}
          <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-400">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{group.clinicNames.join(" · ")}</span>
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {PROVIDER_SERVICE_TYPE_LABELS[group.serviceType]}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {group.durationMinutes} דק׳
            </span>
            {group.referral !== "none" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                <FileText className="h-3 w-3 shrink-0" />
                {group.referral === "all" ? "נדרשת הפניה" : "נדרשת הפניה בחלק מהמקומות"}
              </span>
            )}
          </div>

        </div>

        {/* On a phone this sits as its own row under the name instead of
            fighting it for width. */}
        <div className="flex shrink-0 items-end justify-between gap-2 sm:block sm:text-left">
          <BestPriceCell bestPricing={group.bestPricing} hasBasket={group.coverage.hasBasket} single={single} />
          {!single && <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400 sm:ms-auto sm:mt-1" />}
        </div>
      </button>

      <CoverageBadges coverage={group.coverage} title="מסלולי מימון לשירות הזה בפרופיל שלך" />
    </div>
  );
}

/**
 * A container's price corner: the lowest CERTAIN payable price, always with
 * the route it comes from — "החל מ־120 ₪ · בהסדר" — never a bare number that
 * mixes copays and full prices into one axis. All-basket containers have no
 * price at all: coverage isn't a point on the price scale.
 */
function BestPriceCell({
  bestPricing,
  hasBasket,
  single,
}: {
  bestPricing: OfferPricing | null;
  hasBasket: boolean;
  single: boolean;
}) {
  if (!bestPricing) {
    return hasBasket ? (
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-sm font-bold text-teal-700">
          <ShieldCheck className="h-4 w-4 shrink-0" /> מכוסה בסל
        </span>
      </span>
    ) : (
      <span className="text-xs text-slate-400">הרשמה להצגת מחיר</span>
    );
  }
  return (
    <span className="min-w-0">
      {!single && <span className="block text-[11px] text-slate-400">החל מ־</span>}
      <span className="text-lg font-bold text-slate-900">{formatCurrency(bestPricing.price)}</span>
      <span className="block text-[11px] font-medium text-slate-500">
        {bestPricing.kind === "arrangement" ? "בהסדר" : bestPricing.kind === "tourist" ? "מחיר תייר" : "מחיר מלא"}
      </span>
    </span>
  );
}

/** A provider inside a service group — the "compare providers" view. */
function OfferRow({
  offer,
  patient,
  onSelect,
}: {
  offer: Offer;
  patient?: Patient | null;
  onSelect: () => void;
}) {
  const pricing = offerPricing(offer, patient);
  return (
    <button
      onClick={onSelect}
      className="focus-ring flex w-full flex-col gap-2 rounded-lg border border-slate-200 p-3 text-right hover:border-primary sm:flex-row sm:items-start sm:justify-between sm:gap-3"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">
          {offer.doctor ? providerLabel(offer.doctor) : providerLabel(offer.provider)}
        </p>
        <p className="truncate text-xs text-slate-500">
          {offer.doctor ? offer.doctor.specialty : "מבוצע במכון — ללא רופא מטפל"}
        </p>
        <ClinicLine offer={offer} />
      </div>
      <PriceCell pricing={pricing} />
    </button>
  );
}

function ProviderGroupCard({
  group,
  onOpen,
  onSelectOffer,
}: {
  group: Extract<ResultGroup, { kind: "provider" }>;
  onOpen: (group: ResultGroup) => void;
  onSelectOffer: (offer: Offer) => void;
}) {
  const { doctor, coverage } = group;
  const subSpecialties = doctor.sub_specialties?.join(" · ");
  const single = group.offers.length === 1;

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* A summary of the person, not a list of their services — who they are,
          what kinds of work they do, where, and which of the patient's own
          plans work at them. Services come on the next screen. */}
      <button
        onClick={() => (single ? onSelectOffer(group.offers[0]) : onOpen(group))}
        className="focus-ring flex w-full flex-col gap-2 rounded-xl p-4 text-right sm:flex-row sm:items-start sm:justify-between sm:gap-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate font-semibold text-slate-900">{providerLabel(doctor)}</p>
            {doctor.rating !== undefined && (
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-slate-600">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {doctor.rating}
                {doctor.review_count !== undefined && (
                  <span className="text-slate-400">({doctor.review_count})</span>
                )}
              </span>
            )}
          </div>

          <p className="mt-0.5 text-xs text-slate-500">
            {doctor.specialty}
            {subSpecialties && <span className="text-slate-400"> · {subSpecialties}</span>}
          </p>

          <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-400">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{group.clinicNames.join(" · ")}</span>
          </p>

          {/* The kinds of work, not the individual services. */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {group.serviceTypes.map((type) => (
              <span
                key={type}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
              >
                {PROVIDER_SERVICE_TYPE_LABELS[type]}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-end justify-between gap-2 sm:block sm:text-left">
          <BestPriceCell bestPricing={group.bestPricing} hasBasket={coverage.hasBasket} single={single} />
          <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400 sm:ms-auto sm:mt-1" />
        </div>
      </button>

      <CoverageBadges coverage={coverage} />
    </div>
  );
}

/**
 * The screen behind a result card: a provider's own services, or a service's
 * providers. Its own view rather than an expander, so a long list gets the
 * whole viewport instead of pushing the rest of the results out of reach.
 */
export function GroupDetail({
  group,
  patient,
  onBack,
  onSelectOffer,
}: {
  group: ResultGroup;
  patient?: Patient | null;
  onBack: () => void;
  onSelectOffer: (offer: Offer) => void;
}) {
  const isProvider = group.kind === "provider";
  // The summary badges up top double as filters on the item list below —
  // tapping "מכוסה בסל" shows only the basket-covered items. This is what
  // makes the summary trustworthy: it isn't prose maintained next to the
  // items, it's a live query over them.
  const [routeFilter, setRouteFilter] = useState<RouteKey | null>(null);

  const visibleOffers = routeFilter
    ? group.offers.filter((offer) => offerRoute(offerPricing(offer, patient)) === routeFilter)
    : group.offers;

  return (
    <div>
      <button onClick={onBack} className="focus-ring mb-3 flex items-center gap-1 text-sm text-primary">
        <ArrowRight className="h-3.5 w-3.5" /> חזרה לתוצאות
      </button>

      <div className="rounded-xl border border-slate-200 bg-white">
        {isProvider ? <ProviderDetailHeader group={group} /> : <ServiceDetailHeader group={group} />}
        <CoverageBadges
          coverage={group.coverage}
          title={isProvider ? "מסלולי המימון שלך אצלו — הקישו לסינון" : "מסלולי המימון שלך לשירות הזה — הקישו לסינון"}
          activeRoute={routeFilter}
          onToggleRoute={(route) => setRouteFilter((current) => (current === route ? null : route))}
        />
      </div>

      <p className="mb-2 mt-4 text-xs text-slate-500">
        {routeFilter
          ? `מציג רק פריטים במסלול שנבחר · ${visibleOffers.length} מתוך ${group.offers.length}`
          : isProvider
          ? "בחרו שירות"
          : "בחרו נותן שירות — המחיר משתנה ביניהם לפי ההסדרים שיש לכל אחד"}
      </p>

      <div className="space-y-2">
        {visibleOffers.map((offer) =>
          isProvider ? (
            <ServiceRow key={offer.id} offer={offer} patient={patient} onSelect={() => onSelectOffer(offer)} />
          ) : (
            <OfferRow key={offer.id} offer={offer} patient={patient} onSelect={() => onSelectOffer(offer)} />
          )
        )}
      </div>
    </div>
  );
}

/** The route identity used to match a summary badge against an item. */
type RouteKey = "basket" | "arrangement" | "hint" | "base";

function offerRoute(pricing: OfferPricing | null): RouteKey | null {
  if (!pricing) return null;
  if (pricing.kind === "basket") return "basket";
  if (pricing.kind === "arrangement") return "arrangement";
  if (pricing.kind === "base") return pricing.reimbursementHint?.length ? "hint" : "base";
  return null; // tourist — the whole page is one route, nothing to filter by
}

function ProviderDetailHeader({ group }: { group: Extract<ResultGroup, { kind: "provider" }> }) {
  const { doctor } = group;
  const subSpecialties = doctor.sub_specialties?.join(" · ");
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{providerLabel(doctor)}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {doctor.specialty}
            {subSpecialties && <span className="text-slate-400"> · {subSpecialties}</span>}
          </p>
        </div>
        {doctor.rating !== undefined && (
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-slate-600">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {doctor.rating}
            {doctor.review_count !== undefined && <span className="text-slate-400">({doctor.review_count})</span>}
          </span>
        )}
      </div>
      <p className="mt-2 flex items-start gap-1 text-[11px] text-slate-400">
        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
        <span>{group.clinicNames.join(" · ")}</span>
      </p>
    </div>
  );
}

function ServiceDetailHeader({ group }: { group: Extract<ResultGroup, { kind: "service" }> }) {
  return (
    <div className="p-4">
      <p className="font-semibold text-slate-900">{group.serviceName}</p>
      <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-400">
        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
        <span>{group.clinicNames.join(" · ")}</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {PROVIDER_SERVICE_TYPE_LABELS[group.serviceType]}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {group.durationMinutes} דק׳
        </span>
        {group.referral !== "none" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            <FileText className="h-3 w-3 shrink-0" />
            {group.referral === "all" ? "נדרשת הפניה" : "נדרשת הפניה בחלק מהמקומות"}
          </span>
        )}
      </div>
    </div>
  );
}

/** A service inside a provider's detail screen. */
function ServiceRow({
  offer,
  patient,
  onSelect,
}: {
  offer: Offer;
  patient?: Patient | null;
  onSelect: () => void;
}) {
  const pricing = offerPricing(offer, patient);
  return (
    <button
      onClick={onSelect}
      className="focus-ring flex w-full flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 text-right hover:border-primary sm:flex-row sm:items-start sm:justify-between sm:gap-3"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{offer.service.name}</p>
        <p className="text-xs text-slate-500">
          {offer.service.duration_minutes} דק׳
          {offer.service.service_type && ` · ${PROVIDER_SERVICE_TYPE_LABELS[offer.service.service_type]}`}
          {requiresReferral(offer.service) && <span className="text-amber-700"> · נדרשת הפניה</span>}
        </p>
        <ClinicLine offer={offer} />
      </div>
      <PriceCell pricing={pricing} />
    </button>
  );
}

/**
 * Which funding routes exist for ≥1 item in this container, in the one fixed
 * route language: basket and arrangements are FILLED (certain), the
 * reimbursement hint is OUTLINED — the visual encoding of "informational, not
 * promised". When onToggleRoute is passed (detail screens), the badges double
 * as filters over the item list.
 */
function CoverageBadges({
  coverage,
  title = "מסלולי המימון שלך כאן",
  activeRoute,
  onToggleRoute,
}: {
  coverage: CoverageSummary;
  title?: string;
  activeRoute?: RouteKey | null;
  onToggleRoute?: (route: RouteKey) => void;
}) {
  const { hasBasket, arrangements, reimbursementHints, hasBaseOnly } = coverage;
  if (!hasBasket && arrangements.length === 0 && reimbursementHints.length === 0 && !hasBaseOnly) return null;

  const badge = (route: RouteKey, key: string, className: string, content: ReactNode) => {
    const base = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium";
    const ring = activeRoute === route ? " ring-2 ring-primary/60" : "";
    if (!onToggleRoute) {
      return (
        <span key={key} className={`${base} ${className}`}>
          {content}
        </span>
      );
    }
    return (
      <button
        key={key}
        type="button"
        onClick={() => onToggleRoute(route)}
        aria-pressed={activeRoute === route}
        className={`focus-ring ${base} ${className}${ring}`}
      >
        {content}
      </button>
    );
  };

  return (
    <div className="border-t border-slate-100 px-4 py-3">
      <p className="mb-1.5 text-[11px] font-medium text-slate-500">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {hasBasket &&
          badge(
            "basket",
            "basket",
            "bg-teal-700 text-white",
            <>
              <ShieldCheck className="h-3 w-3 shrink-0" /> מכוסה בסל
            </>
          )}
        {arrangements.map((label) =>
          badge(
            "arrangement",
            label,
            "bg-success-bg text-success-text",
            <>
              <InsuranceLogo name={label} layers={["K"]} size={14} /> {label}
            </>
          )
        )}
        {reimbursementHints.map((plan) =>
          badge(
            "hint",
            plan,
            "border border-info-border bg-transparent text-info-text",
            <>
              <InsuranceLogo name={plan} layers={["B"]} size={14} />
              ייתכן החזר · {plan}
            </>
          )
        )}
        {hasBaseOnly &&
          badge(
            "base",
            "base",
            "bg-slate-100 text-slate-500",
            <>חלק מהפריטים במחיר מלא</>
          )}
      </div>
    </div>
  );
}

/**
 * Which branches this specific service is bookable at. A service can be
 * offered at only some of a provider's clinics, so this is per offer — not
 * per provider.
 */
function ClinicLine({ offer }: { offer: Offer }) {
  const names = offer.clinics.map((c) => c.name);
  const shown = names.slice(0, 2).join(" · ");
  const extra = names.length - Math.min(names.length, 2);
  return (
    <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
      <MapPin className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {/* The organization is named here, in the location line — it's a place
            the service happens at, not the one giving it. */}
        {offer.organization && <span className="text-slate-500">{offer.organization.display_name} · </span>}
        {shown}
        {extra > 0 && ` +${extra}`}
      </span>
    </p>
  );
}

function PriceCell({ pricing }: { pricing: OfferPricing | null }) {
  if (!pricing) {
    return <span className="text-xs text-slate-400 sm:shrink-0">הרשמה להצגת מחיר</span>;
  }
  // Not shrink-0 on mobile: the reimbursement explanation is a full sentence,
  // and letting it claim a fixed column would squeeze the service name to
  // nothing. It becomes its own row on a phone, a column from sm up.
  return (
    <div className="min-w-0 border-t border-slate-100 pt-2 sm:max-w-[45%] sm:shrink-0 sm:border-0 sm:pt-0">
      <InsurancePriceBlock breakdown={pricing.breakdown} />
      {/* A basket-covered item has no payments to split. */}
      {pricing.kind !== "basket" && (
        <p className="mt-1 text-[11px] text-slate-400">
          מקדמה {formatCurrency(pricing.deposit)} · יתרה {formatCurrency(pricing.balance)}
        </p>
      )}
    </div>
  );
}
