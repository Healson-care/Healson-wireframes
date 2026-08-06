import { ProviderServiceType } from "@/types";

/**
 * The referral rule: whether a valid kupah referral is a PRECONDITION for
 * booking this item is a property of the ITEM, decided by whoever entered it —
 * `requires_referral`. Plenty of טיפולים are booked directly, so the type
 * alone can't say; a ניתוח usually needs pre-approval, a ייעוץ almost never
 * does, and both are only the DEFAULT the item form opens on (see
 * `defaultRequiresReferral`), never a lock.
 *
 * Items that carry no flag at all (entered before it existed) fall back to
 * that same type default, so nothing that used to be gated silently opens up.
 *
 * Everything patient-facing (the search badge, the filter, the prep list, and
 * the payment gate) goes through here, so the card, the instructions and the
 * block can never disagree.
 */
export function requiresReferral(
  service?: { service_type?: ProviderServiceType; requires_referral?: boolean } | null
): boolean {
  if (!service) return false;
  if (typeof service.requires_referral === "boolean") return service.requires_referral;
  return defaultRequiresReferral(service.service_type);
}

/** What the referral checkbox opens on for a newly added item of this type —
 * a starting point the provider can always change, not a rule. */
export function defaultRequiresReferral(serviceType?: ProviderServiceType): boolean {
  switch (serviceType ?? "consultation") {
    // Booked directly with the provider — the common case, and the whole point
    // of not locking the flag on.
    case "consultation":
    case "treatment":
    case "product":
      return false;
    // Institutional items: a kupah referral / התחייבות is the norm.
    default:
      return true;
  }
}
