// Core domain types for the HealthBridge / HEALSON mock platform.
// NOTE: This is a fully local, mock-data-driven app. No backend/API calls are made.

export type Role = "admin" | "provider" | "patient";

export type Kupah = "כללית" | "מכבי" | "מאוחדת" | "לאומית";

export const KUPOT: Kupah[] = ["כללית", "מכבי", "מאוחדת", "לאומית"];

// ---------------------------------------------------------------------------
// SKBH insurance layers (§2.2) — every patient holds at least S+H, and may
// additionally hold K (supplemental HMO insurance) and/or B (private health
// insurance). The same provider+service shows a different price per layer.
// ---------------------------------------------------------------------------
export type InsuranceLayer = "S" | "K" | "B" | "H";

export const INSURANCE_LAYERS: InsuranceLayer[] = ["S", "K", "B", "H"];

export const LAYER_LABELS: Record<InsuranceLayer, string> = {
  S: "סל קופה",
  K: 'ביטוח קופה (שב"ן)',
  B: "ביטוח בריאות פרטי",
  H: "פרטי מלא",
};

// Supplemental HMO insurance (שב"ן) plan names are branded per-kupah, not a
// shared generic tier list — e.g. מאוחדת sells "מאוחדת עדיף"/"מאוחדת שיא",
// כללית sells "כללית זהב"/"כללית מושלם"/"כללית פלטינום".
export const K_LEVELS_BY_KUPAH = {
  "כללית": ["כללית זהב", "כללית מושלם", "כללית פלטינום"],
  "מכבי": ["מכבי כסף", "מכבי זהב"],
  "מאוחדת": ["מאוחדת עדיף", "מאוחדת שיא"],
  "לאומית": ["לאומית כסף", "לאומית זהב"],
} as const satisfies Record<Kupah, readonly string[]>;

export type KLevel = (typeof K_LEVELS_BY_KUPAH)[Kupah][number];

export interface PriceByLayer {
  layer: InsuranceLayer;
  price: number;
}

/** @deprecated kept only for reference — superseded by PriceByLayer (SKBH model) */
export interface PriceByKupah {
  kupah: Kupah;
  price: number;
  discount?: number;
}

export type AppointmentStatus = "ממתין לאישור" | "מאושר" | "הושלם" | "בוטל";

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "ממתין לאישור",
  "מאושר",
  "הושלם",
  "בוטל",
];

export type PatientStatus = "פעיל" | "לא פעיל" | "ממתין";
export const PATIENT_STATUSES: PatientStatus[] = ["פעיל", "לא פעיל", "ממתין"];

export type LeadStatus = "חדש" | "נוצר קשר" | "מתוכנן" | "הומר" | "לא מעוניין";
export const LEAD_STATUSES: LeadStatus[] = [
  "חדש",
  "נוצר קשר",
  "מתוכנן",
  "הומר",
  "לא מעוניין",
];

export type OrderStatus = "ממתין" | "מאושר" | "בביצוע" | "הושלם" | "בוטל";
export const ORDER_STATUSES: OrderStatus[] = [
  "ממתין",
  "מאושר",
  "בביצוע",
  "הושלם",
  "בוטל",
];

export type OrderPaymentStatus = "ממתין" | "מקדמה שולמה" | "שולם במלואו" | "הוחזר";
export const ORDER_PAYMENT_STATUSES: OrderPaymentStatus[] = [
  "ממתין",
  "מקדמה שולמה",
  "שולם במלואו",
  "הוחזר",
];

export type ReferralStatus = "ממתין לעיבוד" | "בעיבוד" | "הושלם" | "שגיאה";
export const REFERRAL_STATUSES: ReferralStatus[] = [
  "ממתין לעיבוד",
  "בעיבוד",
  "הושלם",
  "שגיאה",
];

export type ProviderVerificationStatus = "ממתין" | "מאושר" | "נדחה";
export const PROVIDER_VERIFICATION_STATUSES: ProviderVerificationStatus[] = [
  "ממתין",
  "מאושר",
  "נדחה",
];

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  phone?: string;
  avatar_url?: string;
  created_date: string;
}

// ---------------------------------------------------------------------------
// Skill taxonomy (§5) — Domain → Sub-domain → Catalog item. Admin-editable.
// ---------------------------------------------------------------------------
export interface SkillDomain {
  id: string;
  name_he: string;
  emoji?: string;
  slug: string;
}

export interface SkillSubdomain {
  id: string;
  domain_id: string;
  name_he: string;
  slug: string;
}

export type ServiceType = "consultation" | "diagnostics" | "treatment" | "surgery" | "extra";

export const SERVICE_TYPES: ServiceType[] = [
  "consultation",
  "diagnostics",
  "treatment",
  "surgery",
  "extra",
];

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  consultation: "ייעוץ",
  diagnostics: "בדיקות",
  treatment: "טיפולים",
  surgery: "ניתוחים",
  extra: "שירותים נוספים",
};

// ---------------------------------------------------------------------------
// Consent (§4.2, §11.1) — one record per grant/revoke, never overwritten.
// ---------------------------------------------------------------------------
export type ConsentType = "health_data_storage" | "provider_transfer" | "analytics" | "marketing";

export const CONSENT_TYPES: ConsentType[] = [
  "health_data_storage",
  "provider_transfer",
  "analytics",
  "marketing",
];

export const CONSENT_REQUIRED: Record<ConsentType, boolean> = {
  health_data_storage: true,
  provider_transfer: true,
  analytics: false,
  marketing: false,
};

export const CONSENT_LABELS: Record<ConsentType, string> = {
  health_data_storage: "שמירת נתוני הבריאות שלי במערכת HEALSON",
  provider_transfer: "העברת פרטיי לספק השירות שבחרתי לצורך תיאום הטיפול",
  analytics: "שימוש בנתונים אנונימיים לצורכי שיפור השירות (אנליטיקס)",
  marketing: "קבלת תקשורת שיווקית ועדכונים על שירותים חדשים",
};

export const CONSENT_DOCUMENT_VERSION = "PP-2026-06-v1";

export interface ConsentRecord {
  id: string;
  patient_id: string;
  consent_type: ConsentType;
  version: string;
  granted: boolean;
  granted_at: string;
  revoked_at?: string;
}

// ---------------------------------------------------------------------------
// Data subject rights requests (§11.2)
// ---------------------------------------------------------------------------
export type DsrRequestType = "export" | "rectification" | "erasure";
export const DSR_REQUEST_TYPES: DsrRequestType[] = ["export", "rectification", "erasure"];
export const DSR_REQUEST_TYPE_LABELS: Record<DsrRequestType, string> = {
  export: "ייצוא נתונים",
  rectification: "תיקון פרטים",
  erasure: "מחיקת נתונים",
};

export type DsrRequestStatus = "ממתין" | "בטיפול" | "הושלם" | "נדחה";
export const DSR_REQUEST_STATUSES: DsrRequestStatus[] = ["ממתין", "בטיפול", "הושלם", "נדחה"];

export interface DsrRequest {
  id: string;
  patient_id: string;
  type: DsrRequestType;
  status: DsrRequestStatus;
  requested_at: string;
  resolved_at?: string;
  notes?: string;
}

export interface Patient {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  id_number?: string;
  date_of_birth?: string;
  address?: string;
  parent_name?: string;
  kupah: Kupah;
  k_level?: KLevel;
  has_b_insurance?: boolean;
  b_insurance_company?: string;
  b_policy_number?: string;
  status: PatientStatus;
  assigned_provider?: string; // ProviderProfile id
  created_date: string;
  user_id?: string;
}

export interface Lead {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  source: string;
  notes?: string;
  status: LeadStatus;
  last_contact?: string;
  conversion_date?: string;
  created_date: string;
}

export type DayKey =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export type ClinicHours = Record<DayKey, [string, string] | null>;

export interface Clinic {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  is_primary: boolean;
  hours: ClinicHours;
}

export interface ConsultationType {
  id: string;
  name: string;
  duration_minutes: number;
  prices: PriceByLayer[];
}

export interface ExamType {
  id: string;
  name: string;
  lab_code: string;
  prices: PriceByLayer[];
}

export interface ReferralFormField {
  id: string;
  name: string;
  type: "text" | "textarea" | "date" | "number";
  required: boolean;
}

export interface ReferralFormTemplate {
  id: string;
  name: string;
  fields: ReferralFormField[];
}

// ---------------------------------------------------------------------------
// Provider agreements (§6.3, §10.2) — which SKBH layers a provider works with.
// ---------------------------------------------------------------------------
export interface ProviderAgreement {
  id: string;
  provider_id: string;
  layer: InsuranceLayer;
  kupah_list?: Kupah[]; // relevant for layer "K" (and "S")
  insurance_companies?: string[]; // relevant for layer "B"
  notes?: string;
}

export interface ProviderProfile {
  id: string;
  user_id?: string;
  display_name: string;
  title?: string;
  specialty: string;
  bio?: string;
  languages?: string[];
  rating?: number;
  review_count?: number;
  license_number?: string;
  license_issuer?: string;
  license_issue_date?: string;
  license_expiry_date?: string;
  image_url?: string;
  is_published: boolean;
  is_active: boolean;
  verification_status: ProviderVerificationStatus;
  rejection_reason?: string;
  commission_rate?: number; // percent Healson takes on this provider's orders
  agreements: ProviderAgreement[];
  consultation_types: ConsultationType[];
  exam_types: ExamType[];
  clinic_locations: Clinic[];
  referral_forms: ReferralFormTemplate[];
  created_date: string;
}

// ---------------------------------------------------------------------------
// Service catalog (§5.3) — items belong to a skill domain/sub-domain and hold
// the Ministry of Health tariff (תב"ר) base price.
// ---------------------------------------------------------------------------
export interface CatalogItem {
  id: string;
  tavar_code?: string;
  name_he: string;
  skill_domain_id: string;
  skill_subdomain_id: string;
  service_type: ServiceType;
  base_price: number;
  typical_duration_min?: number;
  requires_referral: boolean;
  provider_id?: string;
  is_active: boolean;
}

export interface UploadedFile {
  file_name: string;
  uploaded_at: string;
  data_url: string;
}

export interface Appointment {
  id: string;
  client_name: string;
  client_phone?: string;
  provider_id?: string;
  provider_name: string;
  service_name: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  duration_minutes: number;
  status: AppointmentStatus;
  kupah?: Kupah;
  notes?: string;
  created_by_id?: string; // patient id
  referral_document?: UploadedFile;
}

export type WaitlistStatus = "ממתין" | "נוצר קשר" | "בוטל";
export const WAITLIST_STATUSES: WaitlistStatus[] = ["ממתין", "נוצר קשר", "בוטל"];

// A patient's request to be notified if a specific (currently taken) slot
// opens up — offered inline when they click an unavailable slot in the
// booking flow (both /book and the client personal-area search share this).
export interface WaitlistEntry {
  id: string;
  provider_id: string;
  provider_name: string;
  client_name: string;
  client_phone?: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  status: WaitlistStatus;
  created_by_id?: string; // patient id
  created_date: string;
}

export interface Order {
  id: string;
  item_id?: string;
  item_name: string;
  provider_id?: string;
  provider_name: string;
  created_by_id?: string;
  patient_name: string;
  final_price: number;
  status: OrderStatus;
  created_date: string;
  payment_status?: OrderPaymentStatus;
  deposit_amount?: number;
  balance_amount?: number;
  commission_rate?: number;
  commission_amount?: number;
  provider_payout_amount?: number;
}

export interface LabReferral {
  id: string;
  provider_id?: string;
  provider_name: string;
  patient_id?: string;
  patient_name: string;
  test_types: string[];
  lab_code?: string;
  status: ReferralStatus;
  created_date: string;
  completed_date?: string;
  notes?: string;
  results?: string;
  result_files?: UploadedFile[];
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  address: string;
}

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
}
