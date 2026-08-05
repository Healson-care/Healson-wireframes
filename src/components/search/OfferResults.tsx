"use client";

import { Building2, FileText, MapPin, Star, Stethoscope } from "lucide-react";
import { EmptyState } from "@/components/ui/Misc";
import { InsurancePriceBlock } from "@/components/book/InsurancePriceBlock";
import { requiresReferral } from "@/lib/referral";
import { formatCurrency } from "@/lib/utils";
import {
  Offer,
  OfferPricing,
  domainLabel,
  offerDomainId,
  offerPricing,
  offerSubdomainId,
  providerLabel,
  subdomainLabel,
} from "@/lib/search";
import { Patient, PROVIDER_SERVICE_TYPE_LABELS } from "@/types";

/**
 * ONE card shape for every result. There is no "service card" and no "provider
 * card": a bookable thing is always an item AND whoever performs it AND where —
 * splitting them into two kinds of card meant each kind was missing half the
 * answer, and the patient had to open a second screen to find out who she'd be
 * seeing or where she'd be going.
 *
 * So every row here answers, in this order:
 *   what it is · who gives it · where · what it costs her.
 */
export function OfferResults({
  offers,
  patient,
  onSelectOffer,
}: {
  offers: Offer[];
  patient?: Patient | null;
  onSelectOffer: (offer: Offer) => void;
}) {
  if (offers.length === 0) {
    return (
      <EmptyState
        icon={<Stethoscope className="h-10 w-10" />}
        title="לא נמצאו פריטים מתאימים"
        description="נסו להסיר מסנן או לשנות את החיפוש"
      />
    );
  }

  return (
    <div className="space-y-2">
      {offers.map((offer) => (
        <OfferCard key={offer.id} offer={offer} patient={patient} onSelect={() => onSelectOffer(offer)} />
      ))}
    </div>
  );
}

export function OfferCard({
  offer,
  patient,
  onSelect,
}: {
  offer: Offer;
  patient?: Patient | null;
  onSelect: () => void;
}) {
  const pricing = offerPricing(offer, patient);
  const doctor = offer.doctor;

  return (
    <button
      onClick={onSelect}
      className="focus-ring w-full rounded-2xl border border-white/70 bg-white/85 p-4 text-right shadow-[0_18px_40px_-30px_rgba(20,42,79,0.4)] backdrop-blur-sm transition-colors hover:border-[var(--brand-navy)]/25"
    >
      {/* Name and price share the top line at every width — on a phone the
          price used to sit under everything else, which is the one number she
          scans a list of five MRIs for. */}
      <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        {/* 1 — what it is: the Ministry of Health code FIRST, then the full
            item name. That's the order the paperwork uses — a referral slip
            carries the code, and matching it against the card shouldn't take
            reading a line of Hebrew first. Free text searches the code too. */}
        <div className="flex flex-wrap items-baseline gap-1.5">
          <MabarCode code={offer.service.moh_code} />
          <p className="min-w-0 truncate font-semibold text-slate-900">{offer.service.name}</p>
        </div>

        {/* 1a — where it sits in the catalogue. A breadcrumb, not two chips:
            the sub-domain is only meaningful under its parent, and reading
            "אורתופדיה › עמוד שדרה" as one path is the whole point. An item
            whose sub-domain the taxonomy can't name shows the domain alone. */}
        <TaxonomyPath offer={offer} />

        {/* 2 — WHERE. High up and in the card's own ink, not a grey footnote
            at the bottom: whether it's a twenty-minute drive is the question
            she answers before she reads anything else. */}
        <BranchLine offer={offer} />

        {/* 3 — who gives it. A person when there is one; otherwise the unit
            itself, said plainly rather than left blank: an MRI is performed by
            a station, and pretending a doctor is behind it would be a lie the
            patient discovers at the counter. */}
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
          {doctor ? (
            <>
              <Stethoscope className="h-3.5 w-3.5 shrink-0 text-[var(--brand-navy)]/50" />
              <span className="min-w-0 truncate">
                <span className="font-medium text-slate-800">{providerLabel(doctor)}</span>
                {doctor.specialty && <span className="text-slate-500"> · {doctor.specialty}</span>}
              </span>
              {doctor.rating !== undefined && (
                <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-slate-600">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {doctor.rating}
                </span>
              )}
            </>
          ) : (
            <>
              <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--brand-navy)]/50" />
              <span className="min-w-0 truncate font-medium text-slate-800">
                {providerLabel(offer.organization ?? offer.provider)}
              </span>
            </>
          )}
        </p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {PROVIDER_SERVICE_TYPE_LABELS[offer.service.service_type ?? "consultation"]}
          </span>
          {/* Only when the item actually declares one. No default, no "30 דק׳"
              standing in for "we don't know" — a made-up duration is a promise
              about her afternoon. */}
          {offer.service.duration_minutes > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {offer.service.duration_minutes} דק׳
            </span>
          )}
          {requiresReferral(offer.service) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning-text">
              <FileText className="h-3 w-3 shrink-0" /> נדרשת הפניה
            </span>
          )}
        </div>
      </div>

        {/* 4 — what it costs her, on her own insurance profile. Top-left at
            every width, so five copies of one item can be compared by running
            a finger down the same column. */}
        <div className="max-w-[42%] shrink-0 sm:max-w-[45%]">
          <PriceCell pricing={pricing} />
        </div>
      </div>
    </button>
  );
}

/**
 * קוד מב"ר — the Ministry of Health item code. Only coded items carry one
 * (בדיקות, הדמיה, פרוצדורות, ניתוחים); a consultation has none, so this
 * renders nothing rather than an empty field. It's what the patient quotes to
 * the kupah when asking for a referral or a commitment.
 */
function MabarCode({ code }: { code?: string }) {
  if (!code) return null;
  return (
    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
      {'מב"ר'} <span className="tabular-nums text-slate-700">{code}</span>
    </span>
  );
}

function TaxonomyPath({ offer }: { offer: Offer }) {
  const domain = offerDomainId(offer);
  if (!domain) return null;
  const subdomain = offerSubdomainId(offer);
  return (
    <p className="mt-0.5 truncate text-[11px] text-[var(--brand-navy)]/60">
      {domainLabel(domain)}
      {subdomain && <span className="text-slate-400"> › {subdomainLabel(subdomain)}</span>}
    </p>
  );
}

/**
 * The unit and the branches this specific item can be booked at — per offer,
 * not per provider: an item may run at only some of a unit's branches, and a
 * station-run one runs exactly where its עמדה stands.
 */
function BranchLine({ offer }: { offer: Offer }) {
  // The town leads. It's the coarse answer she's after — the branch name and
  // the unit are the detail behind it, kept on the same line but lighter.
  const cities = Array.from(new Set(offer.clinics.map((c) => c.city).filter(Boolean)));
  const shownCities = cities.slice(0, 2).join(" · ");
  const moreCities = cities.length - Math.min(cities.length, 2);
  const detail = [offer.organization?.display_name, offer.clinics[0]?.name].filter(Boolean).join(" · ");

  return (
    // Wraps rather than truncates: a branch name cut to "סניף רא…" is worse
    // than a second line, and this is the line she navigates by.
    <p className="mt-1 flex items-start gap-1.5 text-xs">
      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand-navy)]/60" />
      <span className="min-w-0">
        <span className="font-semibold text-slate-800">
          {shownCities || "מיקום לא צוין"}
          {moreCities > 0 && ` +${moreCities}`}
        </span>
        {detail && <span className="text-slate-400"> · {detail}</span>}
        {offer.clinics.length > 1 && <span className="text-slate-400"> ועוד {offer.clinics.length - 1} סניפים</span>}
      </span>
    </p>
  );
}

function PriceCell({ pricing }: { pricing: OfferPricing | null }) {
  if (!pricing) {
    return <span className="text-xs text-slate-400 sm:shrink-0">הרשמה להצגת מחיר</span>;
  }
  // Not shrink-0 on mobile: the reimbursement explanation is a full sentence,
  // and letting it claim a fixed column would squeeze the item name to
  // nothing. It becomes its own row on a phone, a column from sm up.
  return (
    <div className="min-w-0">
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
