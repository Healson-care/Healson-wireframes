import { ProviderServiceType } from "@/types";

/**
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
  if (service.requires_referral) return true;
  return !REFERRAL_EXEMPT_TYPES.includes(service.service_type ?? "consultation");
}
