// The provider-type taxonomy used by the join flow, shared between the
// dashboard's inline picker (ProviderTypePicker) and the application form
// (/provider/register) so both offer exactly the same choices and wording.
// Icons are component references (not JSX) so this stays a plain .ts module.
import {
  Building2,
  FlaskConical,
  HeartPulse,
  Hospital,
  Network,
  PhoneCall,
  Shield,
  Stethoscope,
  Store,
  User,
  type LucideIcon,
} from "lucide-react";
import { ProviderType, isSelfRegisterableType } from "@/types";

export type ProviderCategory = "individual" | "organization" | "store";

export interface ProviderCategoryConfig {
  key: ProviderCategory;
  label: string;
  description: string;
  /** Concrete examples — what makes the card feel real rather than abstract. */
  examples: string;
  icon: LucideIcon;
  types: ProviderType[];
}

// "store" maps to exactly one ProviderType, so picking that category can skip
// straight to the form instead of showing a single, redundant option.
export const PROVIDER_CATEGORIES: ProviderCategoryConfig[] = [
  {
    key: "individual",
    label: "נותן שירות יחיד",
    description: "רופא/ה או מטפל/ת עצמאי/ת שנותן/ת שירות בעצמו/ה",
    examples: "רופא/ה מומחה/ית · מנתח/ת · אח/ות · פיזיותרפיה · דיאטנ/ית",
    icon: User,
    types: ["doctor", "caregiver"],
  },
  {
    key: "organization",
    label: "יחידה או ארגון רפואי",
    description: "גוף המפעיל מספר מחלקות, סניפים או שירותים",
    examples: "מרפאות חוץ · מכון רפואי · מעבדה · מוקד · סוכנות ביטוח",
    icon: Network,
    types: ["outpatient_clinic", "medical_institute", "lab", "medical_call_center", "insurance_agency"],
  },
  {
    key: "store",
    label: "חנות מוצרי בריאות",
    description: "מכירת מוצרים ללא קביעת תורים",
    examples: "ציוד רפואי · אופטיקה · מוצרי טיפוח רפואי",
    icon: Store,
    types: ["store"],
  },
];

export const PROVIDER_TYPE_ICONS: Record<ProviderType, LucideIcon> = {
  doctor: Stethoscope,
  caregiver: HeartPulse,
  store: Store,
  pharmacy: Store,
  hospital: Hospital,
  outpatient_clinic: Building2,
  medical_institute: Network,
  lab: FlaskConical,
  medical_call_center: PhoneCall,
  insurance_agency: Shield,
};

// The join flow may only offer types that can actually self-register. Medical
// units (מכון רפואי / מרפאת חוץ) are onboarded manually — Healson signs the
// agreements and opens the user — so they are filtered out of every public
// picker rather than creating an account that bypasses that process. A category
// left with no types disappears entirely.
export function selfRegisterableCategories(): ProviderCategoryConfig[] {
  return PROVIDER_CATEGORIES.map((c) => ({
    ...c,
    types: c.types.filter((t) => isSelfRegisterableType(t)),
  })).filter((c) => c.types.length > 0);
}

/** The types a category hides because they're Ops-onboarded — used to explain
 * the omission instead of silently dropping "מכון רפואי" from the list. */
export function manuallyOnboardedTypes(key: ProviderCategory): ProviderType[] {
  return getCategory(key).types.filter((t) => !isSelfRegisterableType(t));
}

export function getCategory(key: ProviderCategory): ProviderCategoryConfig {
  return PROVIDER_CATEGORIES.find((c) => c.key === key) ?? PROVIDER_CATEGORIES[0];
}

export function categoryForType(type: ProviderType): ProviderCategory {
  return PROVIDER_CATEGORIES.find((c) => c.types.includes(type))?.key ?? "individual";
}

/** Individual types name a PERSON; organizations name a business instead. */
export function typeNamesAPerson(type: ProviderType): boolean {
  return type === "doctor" || type === "caregiver";
}
