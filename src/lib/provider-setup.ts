// What a provider must configure before publishing differs by ProviderType
// (a doctor needs a catalog + clinic/home-visit locations + availability; a
// store just needs products + a location; an insurance agency needs neither
// a calendar nor S/K/B/H agreements) — expressed as data so the dashboard
// doesn't need 11 hand-built screens.
import { LocationType, ProviderProfile, ProviderType } from "@/types";
import { hasAnyAvailability } from "./schedule";
import { getUnitResources, isUnitProvider } from "./unit-resources";

export interface ProviderTypeSetupConfig {
  catalogLabel: string; // tab title, plural: "פריטים" / "מוצרים"
  catalogItemLabel: string; // singular, used by PriceListSection's dialogs: "פריט" / "מוצר"
  catalogExtraFieldKey: string;
  catalogExtraFieldLabel: string;
  catalogExtraFieldType: "text" | "number";
  // Medical types enter items by code/free-text search against their
  // reference catalog — קטלוג מב"ר or קטלוג הילסון, resolved by
  // catalogKindForProviderType (ServiceCatalogSection). Non-medical types
  // (store, insurance) keep the free-text PriceListSection editor.
  useSkillTreeCatalog: boolean;
  showExamsCatalog: boolean;
  showAgreements: boolean;
  locationTypes: LocationType[];
  locationLabelSingular: string;
  locationLabelPlural: string;
  showAvailability: boolean;
  // Organization types whose consultation-based items are delivered by
  // individual service providers — they get a "נותני שירות" section for
  // managing the providers affiliated with them and which items each one
  // delivers (§PRV-07).
  showAffiliatedDoctors?: boolean;
  // Medical units (§PRV-08): the unit IS the site — it has exactly one address
  // record and never sub-branches, so the locations screen becomes a single
  // "פרטי היחידה" form rather than a list you can add to.
  singleLocation?: boolean;
  // Medical units: rooms/machines (MRI 1, CT 1, חדר פעולות) that hold their own
  // queue and week, and that items are linked to.
  showFacilities?: boolean;
}

const DURATION_FIELD = {
  catalogExtraFieldKey: "duration_minutes",
  catalogExtraFieldLabel: "משך (דקות)",
  catalogExtraFieldType: "number" as const,
};

export const PROVIDER_SETUP_CONFIG: Record<ProviderType, ProviderTypeSetupConfig> = {
  doctor: {
    ...DURATION_FIELD,
    catalogLabel: "פריטים",
    catalogItemLabel: "פריט",
    useSkillTreeCatalog: true,
    showExamsCatalog: false,
    showAgreements: true,
    locationTypes: ["clinic", "home_visit"],
    locationLabelSingular: "מרפאה",
    locationLabelPlural: "מרפאות",
    showAvailability: true,
  },
  caregiver: {
    ...DURATION_FIELD,
    catalogLabel: "פריטים",
    catalogItemLabel: "פריט",
    useSkillTreeCatalog: true,
    showExamsCatalog: false,
    showAgreements: true,
    locationTypes: ["clinic", "home_visit"],
    locationLabelSingular: "מיקום טיפול",
    locationLabelPlural: "מיקומי טיפול",
    showAvailability: true,
  },
  lab: {
    catalogLabel: "פריטים",
    catalogItemLabel: "פריט",
    catalogExtraFieldKey: "lab_code",
    catalogExtraFieldLabel: "קוד מעבדה",
    catalogExtraFieldType: "text",
    useSkillTreeCatalog: true,
    showExamsCatalog: false,
    showAgreements: true,
    locationTypes: ["clinic", "home_visit"], // home visit = home sample collection
    locationLabelSingular: "סניף מעבדה",
    locationLabelPlural: "סניפי מעבדה",
    showAvailability: true,
  },
  outpatient_clinic: {
    ...DURATION_FIELD,
    catalogLabel: "פריטים",
    catalogItemLabel: "פריט",
    useSkillTreeCatalog: true,
    showExamsCatalog: false,
    showAgreements: true,
    locationTypes: ["clinic"],
    locationLabelSingular: "היחידה",
    locationLabelPlural: "פרטי היחידה",
    showAvailability: true,
    showAffiliatedDoctors: true,
    singleLocation: true,
    showFacilities: true,
  },
  medical_institute: {
    ...DURATION_FIELD,
    catalogLabel: "פריטים",
    catalogItemLabel: "פריט",
    useSkillTreeCatalog: true,
    showExamsCatalog: false,
    showAgreements: true,
    locationTypes: ["clinic"],
    locationLabelSingular: "היחידה",
    locationLabelPlural: "פרטי היחידה",
    showAvailability: true,
    showAffiliatedDoctors: true,
    singleLocation: true,
    showFacilities: true,
  },
  hospital: {
    ...DURATION_FIELD,
    catalogLabel: "פריטים",
    catalogItemLabel: "פריט",
    useSkillTreeCatalog: true,
    showExamsCatalog: false,
    showAgreements: true,
    locationTypes: ["clinic"],
    locationLabelSingular: "מתחם",
    locationLabelPlural: "מתחמים",
    showAvailability: true,
  },
  store: {
    catalogLabel: "מוצרים",
    catalogItemLabel: "מוצר",
    catalogExtraFieldKey: "sku",
    catalogExtraFieldLabel: 'מק"ט',
    catalogExtraFieldType: "text",
    useSkillTreeCatalog: false,
    showExamsCatalog: false,
    showAgreements: false,
    locationTypes: ["store"],
    locationLabelSingular: "סניף",
    locationLabelPlural: "סניפים",
    showAvailability: false,
  },
  pharmacy: {
    catalogLabel: "פריטים",
    catalogItemLabel: "פריט",
    catalogExtraFieldKey: "sku",
    catalogExtraFieldLabel: 'מק"ט',
    catalogExtraFieldType: "text",
    useSkillTreeCatalog: true,
    showExamsCatalog: false,
    showAgreements: true,
    locationTypes: ["store"],
    locationLabelSingular: "סניף",
    locationLabelPlural: "סניפים",
    showAvailability: false,
  },
  medical_call_center: {
    ...DURATION_FIELD,
    catalogLabel: "פריטים",
    catalogItemLabel: "פריט",
    useSkillTreeCatalog: true,
    showExamsCatalog: false,
    showAgreements: false,
    locationTypes: ["virtual"],
    locationLabelSingular: "מוקד",
    locationLabelPlural: "מוקדים",
    showAvailability: true,
  },
  insurance_agency: {
    catalogLabel: "מוצרי ביטוח",
    catalogItemLabel: "מוצר ביטוח",
    catalogExtraFieldKey: "policy_type",
    catalogExtraFieldLabel: "סוג פוליסה",
    catalogExtraFieldType: "text",
    useSkillTreeCatalog: false,
    showExamsCatalog: false,
    showAgreements: false,
    locationTypes: ["virtual", "clinic"],
    locationLabelSingular: "סניף",
    locationLabelPlural: "סניפים",
    showAvailability: false,
  },
};

export function getProviderSetupConfig(type?: ProviderType): ProviderTypeSetupConfig {
  return PROVIDER_SETUP_CONFIG[type ?? "doctor"];
}

export function isCatalogComplete(provider: ProviderProfile): boolean {
  return provider.consultation_types.length > 0;
}

export function isLocationsComplete(provider: ProviderProfile): boolean {
  return provider.clinic_locations.length > 0;
}

// A medical unit's availability lives on its resources (§PRV-08) — the unit is
// "covered" once at least one מתקן or רופא has a week, even if the unit's own
// general hours are still empty (and vice versa: general hours alone still
// count, since services with no resource fall back to them).
export function isAvailabilityComplete(provider: ProviderProfile): boolean {
  if (provider.clinic_locations.some(hasAnyAvailability)) return true;
  return isUnitProvider(provider) && getUnitResources(provider).some(hasAnyAvailability);
}

export function isAffiliatedDoctorsComplete(provider: ProviderProfile): boolean {
  return (provider.affiliated_doctors?.length ?? 0) > 0;
}

export function isFacilitiesComplete(provider: ProviderProfile): boolean {
  return (provider.facilities?.length ?? 0) > 0;
}

export function isSetupReadyToPublish(provider: ProviderProfile): boolean {
  const config = getProviderSetupConfig(provider.provider_type);
  if (!isCatalogComplete(provider)) return false;
  if (config.locationTypes.length > 0 && !isLocationsComplete(provider)) return false;
  if (config.showAvailability && !isAvailabilityComplete(provider)) return false;
  return true;
}

// Tab key of the first unfinished onboarding step, in the same order as the
// checklist shown on /provider/onboarding — used to auto-select that tab.
// Kept provider-null-safe so callers can run it unconditionally (e.g. in a
// hook that must fire on every render, before any early return).
export function getFirstIncompleteStepKey(provider: ProviderProfile): string | undefined {
  const config = getProviderSetupConfig(provider.provider_type);
  const steps: { done: boolean; key: string }[] = [
    { done: !!provider.agreement_signed_at, key: "sign" },
    ...(config.showAgreements ? [{ done: provider.agreements.length > 0, key: "agreements" }] : []),
    { done: isCatalogComplete(provider), key: "catalog" },
    ...(config.locationTypes.length > 0 ? [{ done: isLocationsComplete(provider), key: "locations" }] : []),
    ...(config.showAvailability ? [{ done: isAvailabilityComplete(provider), key: "availability" }] : []),
    ...(config.showAffiliatedDoctors ? [{ done: isAffiliatedDoctorsComplete(provider), key: "doctors" }] : []),
  ];
  return steps.find((s) => !s.done)?.key;
}

// Single source of truth for "what's the one thing to do next" — shown as a
// banner on both /provider/onboarding and the dashboard's overview tab, so a
// provider always sees the same prioritized message regardless of which page
// they're on. Returns null once there's nothing outstanding.
export function getNextProviderAction(
  provider: ProviderProfile,
  // A provider who works only inside medical units doesn't declare insurance
  // arrangements at all — the unit does, and they inherit them (payments
  // meeting §5). Asking them for arrangements they cannot enter would be a
  // dead end, so the caller (which can see the affiliations slice) waives it.
  opts: { inheritsArrangements?: boolean } = {}
): string | null {
  const config = getProviderSetupConfig(provider.provider_type);

  if (provider.status === "pending_review") {
    return provider.application_submitted_at
      ? "הבקשה שלך ממתינה לבדיקת רישיון על ידי צוות Healson — נעדכן אותך במייל בסיום הבדיקה."
      : "השלימו את פרטי הבקשה ושלחו אותה לבדיקת Healson.";
  }

  if (provider.status === "onboarding") {
    if (!provider.agreement_signed_at) return "יש לחתום על ההסכם עם Healson כדי להמשיך.";
    if (
      config.showAgreements &&
      !opts.inheritsArrangements &&
      (provider.agreements?.length ?? 0) === 0
    ) {
      return "הגדירו הסדרי ביטוח (S/K/B/H) לפני שתוכלו לפרסם פריטים.";
    }
    if (!isCatalogComplete(provider)) {
      return `נשאר לך להוסיף ${config.catalogItemLabel} ראשון כדי להתחיל לקבל הזמנות.`;
    }
    if (config.locationTypes.length > 0 && !isLocationsComplete(provider)) {
      return config.singleLocation
        ? "נשאר להשלים את כתובת היחידה ופרטי ההתקשרות שלה."
        : `נשאר לך להוסיף ${config.locationLabelSingular} ראשון/ה כדי להתחיל לקבל הזמנות.`;
    }
    if (config.showFacilities && !isFacilitiesComplete(provider)) {
      return "הוסיפו עמדות למערכים של היחידה (MRI 1, CT 1, חדר פעולות…) — הזמינות והפריטים מוגדרים ברמת העמדה.";
    }
    if (config.showAvailability && !isAvailabilityComplete(provider)) {
      return config.showFacilities
        ? "חסרה זמינות — הגדירו לו״ז לכל עמדה ולכל נותן/ת שירות ביחידה."
        : `חסרה זמינות פעילה עבור אחד ה${config.locationLabelPlural} שלך.`;
    }
    if (config.showAffiliatedDoctors && !isAffiliatedDoctorsComplete(provider)) {
      return "הוסיפו את נותני השירות המשויכים ושייכו אותם לפריטי הייעוץ שלכם.";
    }
    if (provider.go_live_requested_at) {
      return "ביקשת פרסום — ממתינים לאישור Go-Live סופי של צוות Healson.";
    }
    // The photo is recommended, never a gate — nudge without blocking.
    return provider.image_url
      ? 'החשבון שלך מוכן להפעלה — לחצו על "פרסם" כדי לשלוח לאישור סופי.'
      : 'החשבון שלך מוכן להפעלה — מומלץ להעלות תמונת פרופיל (זה מה שמטופלים יראו בחיפוש), ואז ללחוץ על "פרסם".';
  }

  if (provider.status === "approved" && !provider.is_published) {
    return isSetupReadyToPublish(provider)
      ? 'הפרופיל מוכן — לחצו על "פרסם" כדי להתחיל לקבל הזמנות.'
      : "השלימו קטלוג, מיקומים וזמינות כדי לפרסם את הפרופיל.";
  }

  return null;
}
