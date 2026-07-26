// The provider join flow, split into two named phases and two paths.
//
// TERMINOLOGY (deliberate, and used verbatim in the UI):
//   רישום  — PHASE 1. Creating the account and sending the application to
//            Healson for license review. Deliberately as short as possible:
//            a user + a password + the minimum needed to identify the applicant.
//   הקמה   — PHASE 2. Everything AFTER the account exists: agreements, catalog,
//            branches/מערכים/עמדות, schedules, and go-live. This is the long
//            one, and it can be done across many sittings.
//
// THE TWO PATHS differ only in whether PHASE 1 exists at all:
//
//   solo  — a doctor/caregiver/store/lab signs themselves up. They go through
//           רישום (fast), wait for Healson to verify the license, get notified,
//           and only then does הקמה unlock.
//
//   unit  — a medical unit (מכון רפואי / מרפאת חוץ) is onboarded MANUALLY:
//           agreements and paperwork happen off-platform, and Ops opens the
//           user on their behalf (addOrganizationUnit + createProviderUnitUser).
//           There is no רישום for them — the account arrives already verified,
//           as a blank slate that starts directly in הקמה. Crucially this means
//           a unit NEVER picks its own provider_type: Ops already set it.
//
// Both paths unite at `status === "onboarding"` (= הקמה) and are identical from
// there on, which is why the setup screens need no path awareness.
import { ProviderProfile, isUnitProviderType } from "@/types";

export type ProviderPath = "solo" | "unit";

/** רישום → הקמה → פעיל. Maps 1:1 onto ProviderStatus, named for the product. */
export type ProviderPhase = "registration" | "setup" | "live";

export const PHASE_LABELS: Record<ProviderPhase, string> = {
  registration: "רישום",
  setup: "הקמה",
  live: "פעיל",
};

/** Which path this provider joined on.
 *
 * `onboarding_path` is stamped at creation (see registerProviderAccount /
 * addOrganizationUnit). It is optional so records created before the split —
 * demo seed data included — still resolve correctly: a unit provider type is
 * by definition Ops-created, since units are never offered in the public
 * type picker (see SOLO_PROVIDER_TYPES / ProviderTypePicker). */
export function getProviderPath(provider: ProviderProfile): ProviderPath {
  if (provider.onboarding_path) return provider.onboarding_path;
  return isUnitProviderType(provider.provider_type) ? "unit" : "solo";
}

export function isUnitPath(provider: ProviderProfile): boolean {
  return getProviderPath(provider) === "unit";
}

export function getProviderPhase(provider: ProviderProfile): ProviderPhase {
  if (provider.status === "pending_review") return "registration";
  if (provider.status === "onboarding") return "setup";
  return "live";
}

/** Whether a progress panel should be on screen at all.
 *
 * The rule from the product: ALWAYS show the progress of the current phase
 * until it is finished. Phase 1 finishes when the application is verified;
 * phase 2 finishes when the provider goes live. Once published, neither bar
 * is ever rendered again — the provider manages everything from the normal
 * profile pages. */
export function shouldShowPhaseProgress(provider: ProviderProfile): boolean {
  return getProviderPhase(provider) !== "live";
}
