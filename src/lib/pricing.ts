// SKBH+P pricing resolution (§2.2, §7.1, and מודל התמחור.pdf) — the funding
// ROUTE is the primary entity; the number is a product of the route.
//
// The six routes, in the order the resolver considers them:
//
//   S  — covered by the health basket: no payable price at all, the patient
//        needs a kupah commitment (התחייבות / טופס 17).
//   K  — kupah arrangement: the displayed price is the copay only.
//   B  — private-insurance arrangement: same, gated by the insurer.
//   H  — tourist price: an EXCLUSIVE classification. A tourist has no Israeli
//        kupah, so H replaces the whole insurance profile — it is not a
//        fallback layer that insured patients ever land on.
//   P  — the base/full price. Every item has one; it is the anchor every
//        other presentation is measured against.
//   "ייתכן החזר" — not a price: an informational hint that the patient's own
//        שב"ן/private policy MAY reimburse a full-price service. The system
//        never calculates or displays reimbursement amounts, and the hint is
//        NOT derived from provider agreements — eligibility is between the
//        patient and her insurer.
import { InsuranceLayer, Patient, PriceByLayer, ProviderAgreement, ProviderServiceType } from "@/types";

const ARRANGEMENT_PRIORITY: InsuranceLayer[] = ["S", "K", "B"];

/** A patient with no Israeli kupah on file is priced as a tourist (route H). */
export function isTourist(patient?: Patient | null): boolean {
  return !patient?.kupah;
}

/** Which SKBH layers a patient holds — S/K/B only; tourists hold none. */
export function getPatientLayers(patient?: Patient | null): InsuranceLayer[] {
  const layers: InsuranceLayer[] = [];
  if (patient?.kupah) layers.push("S");
  if (patient?.k_level) layers.push("K");
  if (patient?.b_insurances?.length) layers.push("B");
  return layers;
}

/**
 * The item's base price (P). Prefer the dedicated price_full field; fall back
 * to the highest listed tier so legacy items without one still resolve.
 */
export function resolveBasePrice(prices: PriceByLayer[], priceFull?: number): number {
  if (priceFull) return priceFull;
  return prices.reduce((max, p) => Math.max(max, p.price), 0);
}

export type FundingKind = "basket" | "arrangement" | "tourist" | "base";

/**
 * Some routes are settled by a written undertaking from the payer rather than
 * by charging the patient: the kupah's טופס 17 for a basket service, and the
 * insurer's undertaking for the big-ticket private ones (chiefly surgery).
 * Where one of these exists, the platform collects the form and takes NO
 * deposit — the payer is paying the provider directly.
 */
export interface CommitmentRequirement {
  /** Who issues it — "מכבי", "מגדל"… shown to the patient. */
  source: string;
  /** What to call the document on screen. */
  formLabel: string;
}

/**
 * Which private-insurance arrangements are settled by an undertaking rather
 * than at the till. Surgery is the clear case; anything needing a hospital
 * behaves the same way.
 */
function bInsurerCommits(serviceType?: ProviderServiceType, requiresHospital?: boolean): boolean {
  return serviceType === "surgery" || !!requiresHospital;
}

export interface PriceBreakdown {
  kind: FundingKind;
  /** P — always present, the reference everything else is anchored on. */
  basePrice: number;
  /** What the patient actually pays now. 0 for a basket-covered service. */
  price: number;
  /** S/K/B for basket/arrangement, H for tourist, undefined for base. */
  layer?: InsuranceLayer;
  /** The route, phrased for the patient: "מחיר הסדר · מכבי שלי" and so on. */
  label: string;
  /**
   * Plans worth checking for reimbursement when paying the base price — the
   * patient's own שב"ן / insurer names. Informational only: presence of the
   * hint never implies eligibility, and no amount is ever attached to it.
   */
  reimbursementHint?: string[];
  /**
   * Present when the route is settled by an undertaking from the payer. The
   * booking then collects that document instead of a deposit.
   */
  commitment?: CommitmentRequirement;
}

/**
 * Resolves how a specific provider's item is funded for this patient. One
 * route wins, automatically — the patient never picks: basket, else the best
 * arrangement in S→K→B priority, else tourist for tourists, else base price.
 */
export function resolvePriceBreakdown(
  prices: PriceByLayer[],
  agreements: ProviderAgreement[] | undefined,
  patient: Patient | null | undefined,
  priceFull?: number,
  /** Needed only to decide whether a B arrangement is settled by undertaking. */
  service?: { service_type?: ProviderServiceType; requires_hospital?: boolean },
  /**
   * Which location this is priced for. An agreement can be limited to some of
   * the provider's clinics, so the same service is genuinely a different price
   * at different branches. Omit to price against every agreement the provider
   * holds — the right answer for a container that spans several locations.
   */
  clinicId?: string
): PriceBreakdown | null {
  if (!patient) return null;
  const basePrice = resolveBasePrice(prices, priceFull);
  if (basePrice === 0) return null;

  if (isTourist(patient)) {
    const touristEntry = prices.find((p) => p.layer === "H");
    return {
      kind: "tourist",
      basePrice,
      price: touristEntry?.price ?? basePrice,
      layer: "H",
      label: "מחיר תייר",
    };
  }

  // An agreement scoped to specific clinics only counts at those clinics.
  const applicable = (agreements ?? []).filter(
    (a) => !clinicId || !a.clinic_ids?.length || a.clinic_ids.includes(clinicId)
  );

  const held = new Set(getPatientLayers(patient));
  for (const layer of ARRANGEMENT_PRIORITY) {
    if (!held.has(layer)) continue;
    const entry = prices.find((p) => p.layer === layer);
    if (!entry) continue;
    const agreement = applicable.find((a) => a.layer === layer);
    if (!agreement) continue;

    if (layer === "S" || layer === "K") {
      if (
        agreement.kupah_list &&
        agreement.kupah_list.length > 0 &&
        (!patient.kupah || !agreement.kupah_list.includes(patient.kupah))
      ) {
        continue;
      }
    }
    if (layer === "S") {
      // Basket coverage is not a price — the service is covered, conditional
      // on a kupah commitment. The S entry's amount is deliberately ignored.
      return {
        kind: "basket",
        basePrice,
        price: 0,
        layer,
        label: "מכוסה בסל הבריאות",
        commitment: { source: patient.kupah ?? "הקופה", formLabel: "טופס 17 — התחייבות מהקופה" },
      };
    }
    if (layer === "K") {
      return { kind: "arrangement", basePrice, price: entry.price, layer, label: `מחיר הסדר · ${patient.k_level}` };
    }
    // layer === "B"
    const companies = agreement.insurance_companies ?? [];
    const patientCompanies = (patient.b_insurances ?? []).map((ins) => ins.company);
    const matched = companies.length === 0 ? patientCompanies[0] : patientCompanies.find((c) => companies.includes(c));
    if (companies.length > 0 && !matched) continue;
    return {
      kind: "arrangement",
      basePrice,
      price: entry.price,
      layer,
      label: `מחיר הסדר · ${matched}`,
      // Surgery and anything needing a hospital are settled by the insurer's
      // undertaking, so no deposit is taken. Smaller B items are paid for
      // normally.
      commitment: bInsurerCommits(service?.service_type, service?.requires_hospital)
        ? { source: matched ?? "חברת הביטוח", formLabel: "התחייבות מחברת הביטוח" }
        : undefined,
    };
  }

  // No arrangement — the patient pays the base price. Her own plans may
  // reimburse her; we say only that, never how much, and independently of
  // anything the provider declared.
  const reimbursementHint: string[] = [];
  if (patient.k_level) reimbursementHint.push(patient.k_level);
  for (const ins of patient.b_insurances ?? []) reimbursementHint.push(ins.company);

  return {
    kind: "base",
    basePrice,
    price: basePrice,
    label: "מחיר מלא",
    reimbursementHint: reimbursementHint.length > 0 ? reimbursementHint : undefined,
  };
}

/**
 * Staff-facing approximation ONLY (/catalog, /medical lookup tools): rough
 * copay ratios off the MOH tariff. Never show this to a patient — it invents
 * numbers the real resolver doesn't stand behind, and the product rule is
 * that reimbursements/copays are never estimated.
 */
export function resolveCatalogPrice(
  basePrice: number,
  patient: Patient | null | undefined
): { layer: InsuranceLayer; price: number } {
  if (patient?.b_insurances?.length) return { layer: "B", price: Math.round(basePrice * 0.15) };
  if (patient?.k_level) return { layer: "K", price: Math.round(basePrice * 0.25) };
  return { layer: "H", price: basePrice };
}
