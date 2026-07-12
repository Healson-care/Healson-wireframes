// What a provider must configure before publishing differs by ProviderType
// (a doctor needs a catalog + clinic/home-visit locations + availability; a
// store just needs products + a location; an insurance agency needs neither
// a calendar nor S/K/B/H agreements) — expressed as data so the dashboard
// doesn't need 11 hand-built screens.
import { LocationType, ProviderProfile, ProviderType } from "@/types";

export interface ProviderTypeSetupConfig {
  catalogLabel: string; // tab title, plural: "ייעוצים" / "מוצרים" / "בדיקות"
  catalogItemLabel: string; // singular, used by PriceListSection's dialogs: "ייעוץ" / "מוצר" / "בדיקה"
  catalogExtraFieldKey: string;
  catalogExtraFieldLabel: string;
  catalogExtraFieldType: "text" | "number";
  // Medical-service types pick their catalog items from the admin-managed
  // Skill Tree (ServiceCatalogSection); product/policy types (store,
  // pharmacy, lab, insurance) aren't part of that taxonomy and keep the
  // free-text PriceListSection editor.
  useSkillTreeCatalog: boolean;
  showExamsCatalog: boolean;
  showAgreements: boolean;
  locationTypes: LocationType[];
  locationLabelSingular: string;
  locationLabelPlural: string;
  showAvailability: boolean;
}

const DURATION_FIELD = {
  catalogExtraFieldKey: "duration_minutes",
  catalogExtraFieldLabel: "משך (דקות)",
  catalogExtraFieldType: "number" as const,
};

export const PROVIDER_SETUP_CONFIG: Record<ProviderType, ProviderTypeSetupConfig> = {
  doctor: {
    ...DURATION_FIELD,
    catalogLabel: "ייעוצים",
    catalogItemLabel: "ייעוץ",
    useSkillTreeCatalog: true,
    showExamsCatalog: true,
    showAgreements: true,
    locationTypes: ["clinic", "home_visit"],
    locationLabelSingular: "מרפאה",
    locationLabelPlural: "מרפאות",
    showAvailability: true,
  },
  caregiver: {
    ...DURATION_FIELD,
    catalogLabel: "טיפולים",
    catalogItemLabel: "טיפול",
    useSkillTreeCatalog: true,
    showExamsCatalog: false,
    showAgreements: true,
    locationTypes: ["clinic", "home_visit"],
    locationLabelSingular: "מיקום טיפול",
    locationLabelPlural: "מיקומי טיפול",
    showAvailability: true,
  },
  other_medical: {
    ...DURATION_FIELD,
    catalogLabel: "שירותים",
    catalogItemLabel: "שירות",
    useSkillTreeCatalog: true,
    showExamsCatalog: false,
    showAgreements: true,
    locationTypes: ["clinic", "home_visit"],
    locationLabelSingular: "מיקום",
    locationLabelPlural: "מיקומים",
    showAvailability: true,
  },
  lab: {
    catalogLabel: "בדיקות",
    catalogItemLabel: "בדיקה",
    catalogExtraFieldKey: "lab_code",
    catalogExtraFieldLabel: "קוד מעבדה",
    catalogExtraFieldType: "text",
    useSkillTreeCatalog: false,
    showExamsCatalog: false,
    showAgreements: true,
    locationTypes: ["clinic", "home_visit"], // home visit = home sample collection
    locationLabelSingular: "סניף מעבדה",
    locationLabelPlural: "סניפי מעבדה",
    showAvailability: true,
  },
  outpatient_clinic: {
    ...DURATION_FIELD,
    catalogLabel: "שירותים",
    catalogItemLabel: "שירות",
    useSkillTreeCatalog: true,
    showExamsCatalog: true,
    showAgreements: true,
    locationTypes: ["clinic"],
    locationLabelSingular: "מרפאה",
    locationLabelPlural: "מרפאות",
    showAvailability: true,
  },
  medical_institute: {
    ...DURATION_FIELD,
    catalogLabel: "שירותים",
    catalogItemLabel: "שירות",
    useSkillTreeCatalog: true,
    showExamsCatalog: true,
    showAgreements: true,
    locationTypes: ["clinic"],
    locationLabelSingular: "סניף",
    locationLabelPlural: "סניפים",
    showAvailability: true,
  },
  hospital: {
    ...DURATION_FIELD,
    catalogLabel: "מחלקות ושירותים",
    catalogItemLabel: "שירות",
    useSkillTreeCatalog: true,
    showExamsCatalog: true,
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
    catalogLabel: "מוצרים ושירותים",
    catalogItemLabel: "מוצר",
    catalogExtraFieldKey: "sku",
    catalogExtraFieldLabel: 'מק"ט',
    catalogExtraFieldType: "text",
    useSkillTreeCatalog: false,
    showExamsCatalog: false,
    showAgreements: true,
    locationTypes: ["store"],
    locationLabelSingular: "סניף",
    locationLabelPlural: "סניפים",
    showAvailability: false,
  },
  medical_call_center: {
    ...DURATION_FIELD,
    catalogLabel: "שירותים",
    catalogItemLabel: "שירות",
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

export function isAvailabilityComplete(provider: ProviderProfile): boolean {
  return provider.clinic_locations.some((c) => Object.values(c.hours).some((h) => h !== null));
}

export function isSetupReadyToPublish(provider: ProviderProfile): boolean {
  const config = getProviderSetupConfig(provider.provider_type);
  if (!isCatalogComplete(provider)) return false;
  if (config.locationTypes.length > 0 && !isLocationsComplete(provider)) return false;
  if (config.showAvailability && !isAvailabilityComplete(provider)) return false;
  return true;
}
