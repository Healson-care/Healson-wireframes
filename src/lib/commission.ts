// Commission — and therefore the deposit (payments meeting §3/§8).
//
// The two are ONE number, deliberately: the deposit a patient pays at booking
// IS Healson's commission on that booking, which is why the patient is never
// shown a percentage and never sees the word "עמלה" (the Amazon model). There
// is no separate "deposit" setting anywhere in the product — change the
// commission and the deposit follows.
//
// Resolution order, most specific first:
//   1. a FIXED-fee rule matching this provider / provider category / item type
//   2. the provider's own negotiated rate (the per-provider discount)
//   3. a rate set for that item's service type
//   4. the platform default (20%)
import { ProviderProfile, ProviderType, ServiceType } from "@/types";

/** A flat fee that replaces the percentage for a slice of the business —
 * "₪200 per consultation at this unit" (payments meeting §8). At least one of
 * the three axes must be set; an all-empty rule would swallow everything. */
export interface FixedFeeRule {
  id: string;
  /** A specific unit / provider this rule applies to. Empty = any. */
  provider_id?: string;
  /** A provider CATEGORY — "every מכון רפואי". Empty = any. */
  provider_type?: ProviderType;
  /** An item type — "every ייעוץ". Empty = any. */
  service_type?: ServiceType;
  /** The flat commission in shekels. */
  amount: number;
}

export const DEFAULT_COMMISSION_RATE = 20;

export interface CommissionInput {
  provider?: ProviderProfile | null;
  serviceType?: ServiceType;
  price: number;
  fixedFeeRules?: FixedFeeRule[];
  providerRate?: number;
  defaultRate?: number;
  rateByServiceType?: Partial<Record<ServiceType, number>>;
}

export interface ResolvedCommission {
  /** Shekels Healson takes — and exactly what the patient pays as a deposit. */
  amount: number;
  kind: "fixed" | "percent";
  /** Set only for the percentage rule. */
  rate?: number;
  /** Plain-Hebrew explanation, for the admin screens. */
  explanation: string;
}

/** How specific a rule is — a rule naming the provider beats one naming only
 * their category, which beats one naming only the item type. */
function ruleScore(rule: FixedFeeRule): number {
  return (rule.provider_id ? 4 : 0) + (rule.provider_type ? 2 : 0) + (rule.service_type ? 1 : 0);
}

export function matchFixedFeeRule(
  rules: FixedFeeRule[] | undefined,
  provider: ProviderProfile | null | undefined,
  serviceType: ServiceType | undefined
): FixedFeeRule | undefined {
  if (!rules?.length) return undefined;
  const matches = rules.filter((r) => {
    if (r.provider_id && r.provider_id !== provider?.id) return false;
    if (r.provider_type && r.provider_type !== provider?.provider_type) return false;
    if (r.service_type && r.service_type !== serviceType) return false;
    // A rule with no axis set at all is a configuration error, not a wildcard.
    return !!(r.provider_id || r.provider_type || r.service_type);
  });
  return matches.sort((a, b) => ruleScore(b) - ruleScore(a))[0];
}

export function resolveCommission({
  provider,
  serviceType,
  price,
  fixedFeeRules,
  providerRate,
  defaultRate = DEFAULT_COMMISSION_RATE,
  rateByServiceType,
}: CommissionInput): ResolvedCommission {
  const fixed = matchFixedFeeRule(fixedFeeRules, provider, serviceType);
  if (fixed) {
    // A flat fee must never exceed the price itself — a ₪200 fee on a ₪150
    // item would mean the provider pays to work.
    const amount = Math.min(Math.round(fixed.amount), Math.round(price));
    return { amount, kind: "fixed", explanation: `עמלת פיקס לפי כלל ייעודי · ${amount} ₪` };
  }
  const rate =
    providerRate ??
    provider?.commission_rate ??
    (serviceType ? rateByServiceType?.[serviceType] : undefined) ??
    defaultRate;
  return {
    amount: Math.round((price * rate) / 100),
    kind: "percent",
    rate,
    explanation: `${rate}% מהמחיר`,
  };
}

/** The deposit charged at booking = the commission. Nothing else sets it. */
export function resolveDeposit(input: CommissionInput): number {
  return resolveCommission(input).amount;
}
