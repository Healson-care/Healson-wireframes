// SKBH pricing resolution (§2.2, §7.1) — centralizes what used to be 3
// duplicated per-kupah price lookups. A patient's price for a given
// provider+service depends on which insurance layer(s) they hold *and* which
// layers that specific provider has an active agreement for.
import { InsuranceLayer, Patient, PriceByLayer, ProviderAgreement } from "@/types";

const LAYER_PRIORITY: InsuranceLayer[] = ["S", "K", "B", "H"];

/** Which SKBH layers a patient holds. S + H are always available (S = kupah basket, H = fallback). */
export function getPatientLayers(patient?: Patient | null): InsuranceLayer[] {
  const layers: InsuranceLayer[] = ["S"];
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
      if (agreement.kupah_list && agreement.kupah_list.length > 0 && !agreement.kupah_list.includes(patient.kupah)) {
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
