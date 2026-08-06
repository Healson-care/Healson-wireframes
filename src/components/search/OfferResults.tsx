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
      className="focus-ring w-full rounded-2xl border border-white/70 bg-white/85 p-3.5 text-right shadow-[0_18px_40px_-30px_rgba(20,42,79,0.4)] backdrop-blur-sm transition-colors hover:border-[var(--brand-navy)]/25 sm:p-4"
    >
      {/* Price beside the details from sm up, beneath them on a phone. Sharing
          the top line at every width meant the price column ate 42% of a 360px
          screen, and everything on the left — the item name, the doctor — was
          truncated to fit the ~190px that were left. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        {/* 1 — what it is: the Ministry of Health code FIRST, then the full
            item name. That's the order the paperwork uses — a referral slip
            carries the code, and matching it against the card shouldn't take
            reading a line of Hebrew first. Free text searches the code too. */}
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          <MabarCode code={offer.service.moh_code} />
          {/* Wraps rather than truncates. The item name is the one thing the
              card is about — "MRI עמוד שדרה מותני עם חומר…" answers nothing. */}
          <p className="min-w-0 break-words font-semibold leading-snug text-[var(--brand-navy)]">
            {offer.service.name}
          </p>
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
        {/* Wraps onto a second line rather than truncating: a long name and a
            long specialty on one 190px line is exactly how "ד״ר אברהם אשכנזי ·
            נוירולוגיה" became "ד״ר אברהם אשכ…". The rating stays pinned to the
            first line so the name never has to fight it for room. */}
        <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-600">
          {doctor ? (
            <>
              <Stethoscope className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand-navy)]/50" />
              <span className="min-w-0 flex-1 break-words leading-snug">
                <span className="font-medium text-slate-800">{providerLabel(doctor)}</span>
                {doctor.specialty && <span className="text-slate-500"> · {doctor.specialty}</span>}
              </span>
              {doctor.rating !== undefined && (
                <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-slate-600">
                  <Star className="h-3 w-3 fill-[var(--color-accent)] text-[var(--color-accent)]" />
                  {doctor.rating}
                </span>
              )}
            </>
          ) : (
            <>
              <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand-navy)]/50" />
              <span className="min-w-0 flex-1 break-words font-medium leading-snug text-slate-800">
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

        {/* 4 — what it costs her, on her own insurance profile. Its own tinted
            strip on a phone — separating it by a wash rather than a rule keeps
            the card quiet while still making the price a place your eye lands.
            From sm up it returns to being the left column, so five copies of
            one item can still be compared by running a finger down it. */}
        <div className="rounded-xl bg-[var(--brand-navy)]/[0.04] px-3 py-2.5 sm:max-w-[45%] sm:shrink-0 sm:rounded-none sm:bg-transparent sm:p-0">
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
  // The one officially-issued fact on the card, so it carries the brand's gold
  // — used here and nowhere else on the card, which is what keeps it an accent
  // rather than decoration.
  return (
    <span className="shrink-0 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.08] px-2 py-0.5 text-[11px] font-medium text-[var(--color-accent-text)]">
      {'מב"ר'} <span className="tabular-nums font-semibold">{code}</span>
    </span>
  );
}

/**
 * Where the item sits, from broad to narrow: the catalogue's domain and
 * sub-domain, then the item's OWN declared sub-specialty as the last and most
 * specific step ("נוירולוגיה › כאבי ראש › בוטוקס למיגרנה כרונית").
 *
 * The sub-specialty belongs to the ITEM, not to whoever performs it — a
 * neurologist who treats both migraine and epilepsy is not what this line says;
 * it says which of the two THIS item is for. Custom items usually carry no
 * taxonomy at all, so for them it is the only classification there is, which is
 * why it renders on its own rather than only as a suffix.
 *
 * Wraps rather than truncates — a path cut mid-word classifies nothing.
 */
function TaxonomyPath({ offer }: { offer: Offer }) {
  const domain = offerDomainId(offer);
  const subdomain = domain ? offerSubdomainId(offer) : undefined;
  const itemSub = offer.service.sub_specialty?.trim();

  const parts = [
    domain ? domainLabel(domain) : undefined,
    subdomain ? subdomainLabel(subdomain) : undefined,
    itemSub,
  ].filter((p): p is string => !!p);
  // A custom item often repeats its sub-domain as its sub-specialty; saying it
  // twice in one breadcrumb reads as a bug.
  const path = parts.filter((p, i) => parts.indexOf(p) === i);
  if (path.length === 0) return null;

  return (
    <p className="mt-0.5 break-words text-[11px] leading-snug text-[var(--brand-navy)]/60">
      {path.map((part, i) => (
        <span key={part}>
          {i > 0 && <span className="text-slate-400"> › </span>}
          {part}
        </span>
      ))}
    </p>
  );
}

/**
 * The ONE branch this card is about. An offer is now per branch, so this line
 * names a single place outright instead of summarising several — a card that
 * said "ועוד 2 סניפים" was asking her to book somewhere it hadn't priced.
 * The station is named too where there is one: an MRI is performed by a
 * specific עמדה, and that's the thing she'll be sent to at the counter.
 */
function BranchLine({ offer }: { offer: Offer }) {
  // The town leads. It's the coarse answer she's after — the branch name, the
  // unit and the station are the detail behind it, lighter on the same line.
  const { city, name, facilityName } = offer.clinic;
  const detail = [offer.organization?.display_name, name, facilityName].filter(Boolean).join(" · ");

  return (
    // Wraps rather than truncates: a branch name cut to "סניף רא…" is worse
    // than a second line, and this is the line she navigates by.
    <p className="mt-1 flex items-start gap-1.5 text-xs">
      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand-navy)]/60" />
      <span className="min-w-0">
        <span className="font-semibold text-slate-800">{city || "מיקום לא צוין"}</span>
        {detail && <span className="text-slate-400"> · {detail}</span>}
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
