import { ProviderServiceType } from "@/types";

/**
 * The two item types a patient may book directly off the search results. A
 * consultation is the entry point to care and a treatment continues care that
 * was already decided on, so neither is gated on paperwork. Everything else —
 * surgery, procedures, imaging, tests, products — is a referred item.
 */
const REFERRAL_EXEMPT_TYPES: ProviderServiceType[] = ["consultation", "treatment"];

/**
 * The referral rule: a valid kupah referral is a PRECONDITION for booking
 * every kind of item except a consultation or a treatment.
 *
 * What "requires a referral" means procedurally is that no time is chosen up
 * front: the referral goes to the medical unit first, and only once the unit
 * approves it does the slot picker open. See the booking lifecycle comment on
 * AppointmentStatus in types/index.ts.
 *
 * This is a property of the item TYPE, not a per-service decision, so it
 * supersedes `ConsultationType.requires_referral` as the gate — that flag
 * stays on the type for provider-facing catalogue editing, but nothing in
 * the patient flow reads it any more. Everything patient-facing (the search
 * badge, the filter, the prep list, and the payment gate) goes through here,
 * so the card, the instructions and the block can never disagree.
 */
export function requiresReferral(service?: { service_type?: ProviderServiceType } | null): boolean {
  if (!service) return false;
  return !REFERRAL_EXEMPT_TYPES.includes(service.service_type ?? "consultation");
}
