import { ProviderServiceType } from "@/types";

/**
 * The referral rule: a valid kupah referral is a PRECONDITION for booking
 * every kind of item except a consultation. Consultations skip the step
 * entirely.
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
  return (service.service_type ?? "consultation") !== "consultation";
}
