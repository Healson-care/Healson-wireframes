import { ProviderServiceType } from "@/types";

/**
 * The deposit charged to confirm an appointment.
 *
 * The patient is shown ONE number — an amount, never a percentage and never a
 * breakdown. That is deliberate: the deposit is also how the platform takes
 * its cut, and exposing the rate would let anyone derive it (the same reason
 * a marketplace shows "you pay now: X" rather than "our fee is Y%").
 *
 * Whether it lands on the percentage or on a fixed sum is a business rule
 * that lives here alone, so it can change in one place without any screen
 * knowing about it.
 */

/** Applies unless a fixed rule below overrides it. */
const DEPOSIT_RATE = 0.2;

/**
 * Fixed deposits, by item type. Big-ticket work is where a percentage stops
 * making sense: a fifth of a surgery is thousands of shekels up front, which
 * would deter the booking the deposit exists to secure.
 */
const FIXED_DEPOSIT_BY_TYPE: Partial<Record<ProviderServiceType, number>> = {
  surgery: 500,
  treatment: 150,
};

/** Below this the percentage isn't worth charging at all. */
const MIN_DEPOSIT = 30;

export function resolveDepositAmount(
  price: number,
  service?: { service_type?: ProviderServiceType } | null
): number {
  if (price <= 0) return 0;
  const fixed = service?.service_type ? FIXED_DEPOSIT_BY_TYPE[service.service_type] : undefined;
  // A fixed deposit never exceeds the price itself.
  if (fixed !== undefined) return Math.min(fixed, price);
  return Math.min(price, Math.max(MIN_DEPOSIT, Math.round(price * DEPOSIT_RATE)));
}

/** What's left to pay at the appointment itself. */
export function resolveBalanceAmount(
  price: number,
  service?: { service_type?: ProviderServiceType } | null
): number {
  return Math.max(0, price - resolveDepositAmount(price, service));
}
