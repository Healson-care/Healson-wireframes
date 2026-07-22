// SKBH pricing resolution (§2.2, §7.1) — centralizes what used to be 3
// duplicated per-kupah price lookups. A patient's price for a given
// provider+service depends on which insurance layer(s) they hold *and* which
// layers that specific provider has an active agreement for.
import { InsuranceLayer, Patient, PriceByLayer, ProviderAgreement } from "@/types";

const LAYER_PRIORITY: InsuranceLayer[] = ["S", "K", "B", "H"];

/** Which SKBH layers a patient holds. H is always available (fallback/full
 * private price); S only applies if the patient actually has a kupah on
 * file — a patient with none (tourist / no institutional coverage) holds
 * at most B (if privately insured) plus H, never S or K. */
export function getPatientLayers(patient?: Patient | null): InsuranceLayer[] {
  const layers: InsuranceLayer[] = [];
  if (patient?.kupah) layers.push("S");
  if (patient?.k_level) layers.push("K");
  if (patient?.has_b_insurance) layers.push("B");
  layers.push("H");
  return layers;
}

/**
 * Resolves the price a patient actually pays for a specific provider's
 * service, matching their held layers against what the provider accepts.
 * Returns the cheapest layer the patient is eligible for at this provider,
 * falling back to H (full price) — mirrors §7.1's pricing principle.
 */
export function resolveProviderPrice(
  prices: PriceByLayer[],
  agreements: ProviderAgreement[] | undefined,
  patient: Patient | null | undefined
): { layer: InsuranceLayer; price: number } | null {
  if (!patient) return null;
  const heldLayers = new Set(getPatientLayers(patient));

  for (const layer of LAYER_PRIORITY) {
    if (!heldLayers.has(layer)) continue;
    const entry = prices.find((p) => p.layer === layer);
    if (!entry) continue;

    if (layer === "H") return { layer, price: entry.price };

    const agreement = agreements?.find((a) => a.layer === layer);
    if (!agreement) continue;

    if (layer === "S" || layer === "K") {
      // patient.kupah is guaranteed set here — "S"/"K" only ever land in
      // heldLayers (above) when it is.
      if (
        agreement.kupah_list &&
        agreement.kupah_list.length > 0 &&
        (!patient.kupah || !agreement.kupah_list.includes(patient.kupah))
      ) {
        continue;
      }
    }
    if (layer === "B") {
      const companies = agreement.insurance_companies ?? [];
      if (companies.length > 0 && patient.b_insurance_company && !companies.includes(patient.b_insurance_company)) {
        continue;
      }
    }
    return { layer, price: entry.price };
  }
  return null;
}

export interface PriceBreakdown {
  /** Full/out-of-pocket price (layer H) — always shown as the baseline reference. */
  privatePrice: number;
  /**
   * A negotiated lower price this provider bills the patient directly, matched
   * against the patient's held S/K/B layer — patient pays this instead of the
   * private price up front.
   */
  arrangement?: { price: number; layer: InsuranceLayer; label: string };
  /**
   * No negotiated price at this provider, but the patient holds a plan under
   * a layer this provider generally engages with (declares an agreement for,
   * just not one matching this patient's specific kupah/insurer) — patient
   * pays the private price and can separately file for reimbursement.
   */
  reimbursementSources?: string[];
}

/**
 * Richer counterpart to resolveProviderPrice (§7.1): instead of collapsing
 * straight to a single number, separates "you pay less here" (an arrangement)
 * from "you pay full price but can claim it back" (reimbursement) so the UI
 * can explain *why* a price is what it is.
 */
export function resolvePriceBreakdown(
  prices: PriceByLayer[],
  agreements: ProviderAgreement[] | undefined,
  patient: Patient | null | undefined
): PriceBreakdown | null {
  const privateEntry = prices.find((p) => p.layer === "H");
  if (!patient || !privateEntry) return null;
  const privatePrice = privateEntry.price;

  const resolved = resolveProviderPrice(prices, agreements, patient);
  if (resolved && resolved.layer !== "H") {
    const label =
      resolved.layer === "S"
        ? "מחיר סל קופה"
        : resolved.layer === "K"
        ? `מחיר הסדר · ${patient.k_level}`
        : `מחיר הסדר · ${patient.b_insurance_company}`;
    return { privatePrice, arrangement: { price: resolved.price, layer: resolved.layer, label } };
  }

  // No arrangement matched this patient specifically — but if the provider
  // still declares that layer (just gated to other kupot/insurers), the
  // patient's own plan can still be claimed back from directly.
  const providerLayers = new Set((agreements ?? []).map((a) => a.layer));
  const reimbursementSources: string[] = [];
  if (patient.k_level && providerLayers.has("K")) reimbursementSources.push(patient.k_level);
  if (patient.has_b_insurance && providerLayers.has("B") && patient.b_insurance_company) {
    reimbursementSources.push(patient.b_insurance_company);
  }
  if (reimbursementSources.length > 0) return { privatePrice, reimbursementSources };

  return { privatePrice };
}

/**
 * Generic reference-catalog pricing (§5.3 items aren't tied to one booking
 * provider) — approximates the copay a patient would pay under their best
 * held layer, using typical Israeli supplemental/private insurance copay
 * ratios off the MOH tariff base price.
 */
export function resolveCatalogPrice(
  basePrice: number,
  patient: Patient | null | undefined
): { layer: InsuranceLayer; price: number } {
  if (patient?.has_b_insurance) return { layer: "B", price: Math.round(basePrice * 0.15) };
  if (patient?.k_level) return { layer: "K", price: Math.round(basePrice * 0.25) };
  return { layer: "H", price: basePrice };
}
