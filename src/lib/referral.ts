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
 * Item types the referral gate does not apply to by default. A consultation is
 * the entry point to care and a treatment continues care that was already
 * decided on, so neither is gated on paperwork. A מוצר is not an appointment at
 * all — there is no time to hold and no unit to answer — so the gate has
 * nothing to act on. Everything else (surgery, procedures, imaging, tests) is
 * referred.
 *
 * Exported so the provider catalogue locks its "נדרשת הפניה" checkbox off the
 * same list the patient gate reads, rather than restating the rule.
 */
export const REFERRAL_EXEMPT_TYPES: ProviderServiceType[] = ["consultation", "treatment", "product"];

/**
 * The referral rule: a valid kupah referral is a PRECONDITION for booking
 * every kind of item except a consultation or a treatment — and, on top of
 * that, for any single item a provider explicitly flagged as needing one.
 *
 * The two inputs are deliberately asymmetric. The item TYPE sets the floor,
 * and `requires_referral` can only ever ADD the gate, never lift it: a
 * provider can decide their own botox treatment needs a referral, but cannot
 * decide their surgery doesn't. Reading the flag as a plain override would
 * make the platform rule opt-out, which is exactly what it must not be.
 *
 * What "requires a referral" means procedurally is that no time is chosen up
 * front: the referral goes to the medical unit first, and only once the unit
 * approves it does the slot picker open. See the booking lifecycle comment on
 * AppointmentStatus in types/index.ts.
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
  if (service.requires_referral) return true;
  return !REFERRAL_EXEMPT_TYPES.includes(service.service_type ?? "consultation");
}
