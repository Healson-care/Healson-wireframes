// Core domain types for the HealthBridge / HEALSON mock platform.
// NOTE: This is a fully local, mock-data-driven app. No backend/API calls are made.

export type Role = "admin" | "provider" | "patient";

export type Kupah = "כללית" | "מכבי" | "מאוחדת" | "לאומית";

export const KUPOT: Kupah[] = ["כללית", "מכבי", "מאוחדת", "לאומית"];

export type Gender = "זכר" | "נקבה";
export const GENDERS: Gender[] = ["זכר", "נקבה"];

// Picked, not typed — see InsuranceProfileForm.
export const B_INSURANCE_COMPANIES = [
  "כלל ביטוח",
  "הראל ביטוח",
  "מגדל ביטוח",
  "הפניקס",
  "מנורה מבטחים",
  "איילון",
  "הכשרה ביטוח",
  "שירביט",
  "AIG",
  "ליברה",
];

export type CommunicationLanguage = "he" | "en";
export const COMMUNICATION_LANGUAGES: CommunicationLanguage[] = ["he", "en"];
export const COMMUNICATION_LANGUAGE_LABELS: Record<CommunicationLanguage, string> = {
  he: "עברית",
  en: "אנגלית",
};

export type NotificationChannel = "email" | "whatsapp";
export const NOTIFICATION_CHANNELS: NotificationChannel[] = ["email", "whatsapp"];
export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: "מייל",
  whatsapp: "וואטסאפ",
};

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
  "כללית": ["כללית בסיס", "כללית מושלם", "כללית פלטינום"],
  "מכבי": ["מכבי בסיס", "מכבי שלי", "מכבי כסף"],
  "מאוחדת": ["מאוחדת בסיס", "מאוחדת עדיף", "מאוחדת שיא"],
  "לאומית": ["לאומית בסיס", "לאומית זהב"],
} as const satisfies Record<Kupah, readonly string[]>;

export type KLevel = (typeof K_LEVELS_BY_KUPAH)[Kupah][number];

// Private health-insurance carriers (§B layer) a provider may hold a
// billing arrangement with — a provider can have more than one.
export const PRIVATE_INSURANCE_COMPANIES = [
  "הראל",
  "כלל",
  "מגדל",
  "הפניקס",
  "מנורה מבטחים",
  "איילון",
  "AIG",
  "שירביט",
] as const;

export type PrivateInsuranceCompany = (typeof PRIVATE_INSURANCE_COMPANIES)[number];

// Israeli bank clearing codes (מס' בנק) — used for provider payout accounts.
export const ISRAELI_BANKS = [
  { code: "10", name: "בנק לאומי" },
  { code: "12", name: "בנק הפועלים" },
  { code: "11", name: "בנק דיסקונט" },
  { code: "20", name: "בנק מזרחי טפחות" },
  { code: "31", name: "הבנק הבינלאומי" },
  { code: "17", name: "בנק מרכנתיל דיסקונט" },
  { code: "14", name: "בנק אוצר החייל" },
  { code: "04", name: "בנק יהב" },
  { code: "52", name: "בנק פועלי אגודת ישראל" },
  { code: "9", name: "בנק הדואר" },
] as const;

// Bank details a provider submits so Healson can transfer their monthly
// payout (§PRV-06/automation §"העברת תשלום לספקים"). Submitting this form
// requires uploading a signed bank-account-management authorization
// document — the same "אישור ניהול חשבון בנק" collected at onboarding —
// and the account is not usable for a real transfer until verified_at is
// set (mirrors the license_verified_at review pattern on ProviderProfile).
export interface ProviderBankAccount {
  account_holder_name: string;
  bank_code: string;
  branch_number: string;
  account_number: string;
  authorization_file?: UploadedFile;
  submitted_at: string;
  verified_at?: string;
}

// Monthly reconciliation between Healson and the provider (automation
// §"התחשבנות חודשית"): each closed month the provider reviews the activity
// report, approves it (or disputes it with a note), and uploads their
// invoice. Figures themselves stay derived from orders — only the review
// decision + invoice are persisted here, keyed by month ("YYYY-MM").
export const SETTLEMENT_STATUSES = ["ממתין לאישור", "אושר", "במחלוקת"] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export interface MonthlySettlement {
  month: string; // "YYYY-MM"
  status: SettlementStatus;
  approved_at?: string;
  dispute_note?: string;
  invoice_file?: UploadedFile;
}

// A provider's declared K-layer arrangement with a specific Kupah, at a
// given supplemental-plan level — collected at application time (§apply
// flow) and refined into full ProviderAgreement records later.
export interface KupahArrangement {
  kupah: Kupah;
  level: KLevel;
}

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

// Booking-lifecycle status from the patient's point of view (§waitlist/booking):
// slot picked -> ממתין לתשלום מקדמה -> (deposit payment succeeds) -> מאושר ->
// (balance paid, via the "שלם יתרה" action) -> שולם במלואו -> (service
// rendered) -> בוצע. בוטל is reachable from any pre-בוצע state (patient/admin/
// provider cancel, or a payment hold expiring unpaid).
//
// TODO(product, unresolved as of 2026-07-12): what should happen if the
// appointment date arrives while status is still "מאושר" (deposit paid,
// balance never collected)? No automatic enforcement exists yet — this is a
// fully local mock app with no background jobs, so nothing currently flags
// or blocks an appointment whose balance is overdue. See README.md.
export type AppointmentStatus = "ממתין לתשלום מקדמה" | "מאושר" | "שולם במלואו" | "בוצע" | "בוטל";

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "ממתין לתשלום מקדמה",
  "מאושר",
  "שולם במלואו",
  "בוצע",
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

// Provider onboarding state machine (PROV-APPLICATION / PROV-ONBOARDING):
// pending_review -> onboarding -> approved, with rejected/suspended off-ramps.
export type ProviderStatus = "pending_review" | "onboarding" | "approved" | "rejected" | "suspended";
export const PROVIDER_STATUSES: ProviderStatus[] = [
  "pending_review",
  "onboarding",
  "approved",
  "rejected",
  "suspended",
];
export const PROVIDER_STATUS_LABELS: Record<ProviderStatus, string> = {
  pending_review: "ממתין לבדיקת רישיון",
  onboarding: "באונבורדינג",
  approved: "מאושר",
  rejected: "נדחה",
  suspended: "מושהה",
};

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  phone?: string;
  avatar_url?: string;
  created_date: string;
  admin_title?: AdminTitle; // only meaningful when role === "admin"
}

// Admin staff sub-role (§8.4 ADM-07) — superadmins are seeded from the team;
// support reps are addable by an existing admin via the admin staff panel.
export type AdminTitle = "superadmin" | "support_rep";
export const ADMIN_TITLE_LABELS: Record<AdminTitle, string> = {
  superadmin: "מנהל-על",
  support_rep: "נציג שירות",
};

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

// A patient/applicant clicked "לא קיבלתי את הקוד" after resending an OTP
// twice — a signal something's actually broken (wrong number, carrier
// filtering, etc.), not just an impatient user. Not a DsrRequest: this can
// happen before a Patient record even exists (mid-registration, only the
// User account is there yet), so it can't carry a patient_id.
export type OtpIssueChannel = "sms" | "email";
export type OtpIssueContext = "registration" | "login";
export type OtpIssueStatus = "פתוח" | "טופל";
export const OTP_ISSUE_STATUSES: OtpIssueStatus[] = ["פתוח", "טופל"];

export interface OtpIssueReport {
  id: string;
  channel: OtpIssueChannel;
  contact: string; // phone or email the code was supposedly sent to
  context: OtpIssueContext;
  status: OtpIssueStatus;
  reported_at: string;
}

export interface Patient {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  id_number?: string;
  id_document_type?: "id" | "passport";
  id_document_photo?: UploadedFile;
  date_of_birth?: string;
  gender?: Gender;
  address?: string;
  parent_name?: string;
  kupah: Kupah;
  k_level?: KLevel;
  has_b_insurance?: boolean;
  b_insurance_company?: string;
  b_policy_number?: string;
  communication_language?: CommunicationLanguage;
  notification_channel?: NotificationChannel;
  status: PatientStatus;
  assigned_provider?: string; // ProviderProfile id
  created_date: string;
  user_id?: string;
  processing_restricted?: boolean; // §11.2 / ADM-08 — blocks new data processing (bookings/orders) when true
  notes?: string; // internal staff notes — never shown to the patient
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

// ---------------------------------------------------------------------------
// Availability (§PRV-05) — a real scheduling model, not a single daily range.
//
// A location's week is a list of *shifts* per day (a day can have several:
// "בוקר 08:00-12:00" + "אחה״צ 16:00-19:00" — split hours), each shift may
// carve out mid-shift breaks, may run on its own slot length, and may be
// limited to a subset of the services offered at that location (so e.g. only
// surgeries are bookable in the afternoon shift). Days with no shifts are
// simply not active.
//
// `Clinic.hours` (the old single-range-per-day model) is kept for backward
// compatibility with data already persisted in localStorage/seed — read it
// only through `getWeeklySchedule()` in src/lib/schedule.ts, which converts a
// legacy `hours` record into an equivalent one-shift-per-day schedule.
// ---------------------------------------------------------------------------
export const DEFAULT_SLOT_MINUTES = 30;
export const SLOT_MINUTE_OPTIONS = [10, 15, 20, 30, 45, 60, 90] as const;

export interface ScheduleBreak {
  id: string;
  start: string; // HH:mm
  end: string; // HH:mm
  label?: string;
}

export interface ScheduleShift {
  id: string;
  start: string; // HH:mm
  end: string; // HH:mm
  label?: string; // "משמרת בוקר" — free text, optional
  slot_minutes?: number; // defaults to DEFAULT_SLOT_MINUTES
  breaks?: ScheduleBreak[];
  // ConsultationType ids bookable in this shift. Empty/undefined means "every
  // service offered at this location" — the common case, so a provider who
  // doesn't care about per-shift service scoping never has to touch it.
  service_ids?: string[];
}

export type WeeklySchedule = Record<DayKey, ScheduleShift[]>;

// A one-off override for a specific date, on top of the weekly schedule:
// either fully closed (חופשה/חג) or a different set of shifts for that day.
export interface ScheduleException {
  id: string;
  date: string; // yyyy-MM-dd
  closed: boolean;
  shifts?: ScheduleShift[]; // only when closed === false
  reason?: string;
}

// A function, not a shared constant — each caller needs its own day arrays.
export function emptyWeeklySchedule(): WeeklySchedule {
  return {
    sunday: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
  };
}

// A provider location's kind — drives which fields are required and how
// its weekly hours should be read (e.g. "home_visit" hours are when the
// provider travels to patients, not when a physical site is staffed).
export type LocationType = "clinic" | "home_visit" | "store" | "virtual";
export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  clinic: "מרפאה",
  home_visit: "ביקורי בית",
  store: "חנות",
  virtual: "מוקד / מרחוק",
};

export interface Clinic {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  is_primary: boolean;
  /** @deprecated legacy single-range-per-day hours — read via getWeeklySchedule() */
  hours: ClinicHours;
  // The real availability model (see ScheduleShift above). Undefined on
  // records created before the scheduler existed — getWeeklySchedule()
  // derives an equivalent schedule from `hours` in that case.
  schedule?: WeeklySchedule;
  schedule_exceptions?: ScheduleException[];
  location_type?: LocationType;
}

// A date the provider has closed (vacation/holiday/etc) on top of their
// recurring weekly hours — the real slot generator (src/lib/scheduling.ts)
// treats these days as fully closed regardless of what the weekly hours say.
export interface BlockedDate {
  id: string;
  date: string; // yyyy-MM-dd
  reason?: string;
}

// Service type a provider picks when adding a service to their own catalog
// (distinct from the admin-managed master-catalog ServiceType above — this
// is the provider-facing 7-category classification requested for provider
// onboarding, e.g. "ייעוץ" vs "טיפול" vs "ניתוח").
export type ProviderServiceType = "consultation" | "treatment" | "surgery" | "procedure" | "imaging" | "test" | "product";
export const PROVIDER_SERVICE_TYPES: ProviderServiceType[] = [
  "consultation",
  "treatment",
  "surgery",
  "procedure",
  "imaging",
  "test",
  "product",
];
export const PROVIDER_SERVICE_TYPE_LABELS: Record<ProviderServiceType, string> = {
  consultation: "ייעוץ",
  treatment: "טיפול",
  surgery: "ניתוח",
  procedure: "פעולה",
  imaging: "הדמייה",
  test: "בדיקה",
  product: "מוצר",
};

export type AnesthesiaType = "local" | "sedation" | "general";
export const ANESTHESIA_TYPES: AnesthesiaType[] = ["local", "sedation", "general"];
export const ANESTHESIA_TYPE_LABELS: Record<AnesthesiaType, string> = {
  local: "מקומית",
  sedation: "הרדמה מקומית + הרגעה",
  general: "כללית",
};

export interface ConsultationType {
  id: string;
  name: string;
  duration_minutes: number;
  prices: PriceByLayer[];
  catalog_item_id?: string; // links back to a CatalogItem chosen from the Skill Tree
  service_type?: ProviderServiceType;
  // Provider-type-specific category (see PROVIDER_TYPE_SERVICE_CATEGORIES) —
  // set instead of relying on service_type alone for organization types whose
  // catalogue has its own vocabulary ("בדיקות עד הבית", "בחירת מנתח"…).
  service_category?: string;
  linked_clinic_ids?: string[]; // Clinic ("calendar") ids this service can be booked against
  // Requires a referral/pre-authorization from the patient's kupah before
  // booking — relevant across every service_type, so kept ungated.
  requires_referral?: boolean;
  // "test" (בדיקה) prep fields.
  requires_fasting?: boolean;
  sample_type?: string;
  // "surgery" (ניתוח) prep/logistics fields.
  anesthesia_type?: AnesthesiaType;
  recovery_days?: number;
  requires_hospital?: boolean;
  // "imaging" (הדמייה) prep fields.
  requires_contrast?: boolean;
  has_radiation?: boolean;
  // When set, booking this consultation auto-creates a pending questionnaire
  // document (see PatientDocument) once the deposit is paid.
  requires_questionnaire?: boolean;
  questionnaire_title?: string;
  // Specific documents the patient must upload before the appointment (e.g.
  // a referral letter, prior imaging). Same "once the deposit is paid"
  // timing as requires_questionnaire — each entry becomes a pending
  // PatientDocument (category "referral_personal") linked to the appointment.
  required_documents?: { id: string; label: string }[];
}

export interface ExamType {
  id: string;
  name: string;
  lab_code: string;
  prices: PriceByLayer[];
  service_type?: ProviderServiceType;
  linked_clinic_ids?: string[];
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

// Provider type (§apply flow) — chosen as the second step of provider
// registration (after picking "individual" vs "organization"); drives which
// fields are mandatory before an admin can review the application.
// "caregiver" covers both nurses and complementary/alternative-medicine
// therapists (the applicant picks a sub-type within the form); "hospital"
// covers both general hospitals and standalone surgical facilities.
// NOTE: "נותן שירות רפואי אחר" (other_medical) was removed from the product —
// every provider now picks a concrete type, so there is no catch-all option in
// any provider-type picker.
export type ProviderType =
  | "doctor"
  | "caregiver"
  | "store"
  | "pharmacy"
  | "hospital"
  | "outpatient_clinic"
  | "medical_institute"
  | "lab"
  | "medical_call_center"
  | "insurance_agency";

export const PROVIDER_TYPES: ProviderType[] = [
  "doctor",
  "caregiver",
  "store",
  "pharmacy",
  "hospital",
  "outpatient_clinic",
  "medical_institute",
  "lab",
  "medical_call_center",
  "insurance_agency",
];

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  doctor: "רופא/ה",
  caregiver: "מטפל/ת",
  store: "חנות",
  pharmacy: "בית מרקחת",
  hospital: "בית חולים",
  outpatient_clinic: "מרפאות חוץ",
  medical_institute: "מכון רפואי",
  lab: "מעבדה",
  medical_call_center: "מוקד רפואי",
  insurance_agency: "סוכנות ביטוח",
};

export const PROVIDER_TYPE_DESCRIPTIONS: Record<ProviderType, string> = {
  doctor: "רופא/ה עצמאי/ת עם רישיון עיסוק ממשרד הבריאות",
  caregiver: "אח/ות או נותן/ת טיפול משלים ופרא-רפואי",
  store: "חנות מוצרי בריאות, ציוד רפואי או אופטיקה",
  pharmacy: "בית מרקחת עם רוקח אחראי",
  hospital: "בית חולים / מרכז רפואי המפעיל מחלקות אשפוז וחדרי ניתוח",
  outpatient_clinic: "רשת מרפאות חוץ / מרפאות קהילתיות",
  medical_institute: "מכון רפואי / מכון אבחוני",
  lab: "מעבדה רפואית לבדיקות דם, גנטיקה ואבחון",
  medical_call_center: "מוקד טלפוני לייעוץ, טריאז' ותמיכה רפואית מרחוק",
  insurance_agency: "סוכנות המתווכת פוליסות ביטוח בריאות ושירותים משלימים",
};

// ---------------------------------------------------------------------------
// Per-provider-type service catalogue (§PRV-02).
//
// Organization provider types don't all sell the same kinds of things: a
// מרפאת חוץ offers consultations and diagnostics, while a מכון רפואי also
// sells procedures, surgeries, home visits and equipment. These lists are the
// single source of truth for BOTH ends of the flow:
//   1. the "סוג השירותים" pick in the join application (provider/register), and
//   2. the "סוג שירות" classification when adding an item to the provider's
//      own catalog (ServiceCatalogSection).
// A type with no entry here falls back to the generic PROVIDER_SERVICE_TYPES
// classification above.
// ---------------------------------------------------------------------------
export const PROVIDER_TYPE_SERVICE_CATEGORIES: Partial<Record<ProviderType, string[]>> = {
  outpatient_clinic: ["ייעוץ", "חוות דעת נוספת", "ייעוץ חוזר", "אבחונים", "בדיקות", "טיפולים"],
  medical_institute: [
    "טיפולים",
    "פעולות",
    "בדיקות",
    "בדיקות עד הבית",
    "ניתוחים",
    "בחירת מנתח",
    "שירותים נוספים",
    "ייעוץ",
    "חוות דעת נוספת",
    "טיפולים עד הבית",
    "ציוד רפואי",
    "ייעוץ עד הבית",
  ],
};

export function getProviderServiceCategories(type?: ProviderType): string[] | undefined {
  return type ? PROVIDER_TYPE_SERVICE_CATEGORIES[type] : undefined;
}

// ---------------------------------------------------------------------------
// Affiliated doctors (§PRV-07) — every consultation-based service is actually
// delivered by a doctor, so an organization (מרפאת חוץ / מכון רפואי) manages
// the doctors working under it and which of its services each one delivers.
//
// A doctor is never duplicated: the record points at a real doctor
// ProviderProfile (`doctor_provider_id`). Adding a doctor who already exists
// in the platform links the existing record instead of creating a second one
// — see linkExistingDoctorToOrganization / addAffiliatedDoctor in store.ts.
// ---------------------------------------------------------------------------
export interface AffiliatedDoctor {
  id: string;
  doctor_provider_id: string; // ProviderProfile.id of a provider_type "doctor"
  role?: string; // "רופא בכיר", "מנהל יחידה"… free text
  service_ids: string[]; // ConsultationType ids of the organization's catalog
  clinic_ids?: string[]; // organization locations the doctor works at
  added_at: string;
}

// Provider types a member (child) provider belongs to — excludes
// "hospital", since a hospital is made up of the other provider types
// (departments/practitioners), not of other organizations.
export const ORGANIZATION_MEMBER_TYPES: ProviderType[] = PROVIDER_TYPES.filter(
  (t) => t !== "hospital"
);

// Doctor sub-type (§apply flow, doctor only) — a surgeon needs credentialing
// documents a regular physician doesn't: board certification in a surgical
// specialty, valid malpractice insurance, and the hospital/facility they
// hold surgical privileges at.
export type DoctorSubtype = "physician" | "surgeon";
export const DOCTOR_SUBTYPES: DoctorSubtype[] = ["physician", "surgeon"];
export const DOCTOR_SUBTYPE_LABELS: Record<DoctorSubtype, string> = {
  physician: "רופא/ה (לא מנתח/ת)",
  surgeon: "רופא/ה מנתח/ת",
};

export interface ProviderProfile {
  id: string;
  provider_type?: ProviderType;
  user_id?: string;
  display_name: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  business_reg_number?: string;
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
  coordination_notes?: string; // free-text notes to the Healson ops team, not shown to patients
  is_published: boolean;
  status: ProviderStatus;
  phone_verified_at?: string;
  license_file?: UploadedFile;
  doctor_subtype?: DoctorSubtype;
  surgical_board_certificate?: UploadedFile;
  malpractice_insurance_file?: UploadedFile;
  surgical_privileges_hospital?: string;
  medical_resume_file?: UploadedFile;
  kupah_arrangements?: KupahArrangement[];
  private_insurance_companies?: string[];
  service_areas?: string[];
  sub_specialties?: string[];
  location_count?: number;
  member_provider_types?: ProviderType[]; // organization only — which provider types operate under it (set by Healson ops, not self-declared)
  // Organization only (outpatient_clinic / medical_institute) — doctors
  // working under this organization and the services each one delivers.
  affiliated_doctors?: AffiliatedDoctor[];
  // Doctor only — organizations this doctor is affiliated with (the inverse
  // of affiliated_doctors, kept in sync by the store so a doctor's own
  // profile can show where they practice).
  organization_provider_ids?: string[];
  license_verified_at?: string;
  // Set once the provider clicks "שלח לבדיקת Healson" on /apply, after
  // registering + logging in and filling out their profile — this is the
  // boundary between "still completing registration" (provider keeps editing
  // on /apply) and "submitted, awaiting Ops review" (admin queue picks it up).
  application_submitted_at?: string;
  agreement_signed_at?: string;
  onboarding_ready_at?: string;
  // Provider-initiated Go-Live request (§apply flow, stage 4) — the provider
  // clicks "פרסם" once onboarding_ready_at is set; this only queues the
  // request. Healson must still call approveProviderGoLive to actually flip
  // status to "approved" / is_published — see requestProviderGoLive in store.ts.
  go_live_requested_at?: string;
  rejection_reason?: string;
  commission_rate?: number; // percent Healson takes on this provider's orders
  bank_account?: ProviderBankAccount;
  monthly_settlements?: MonthlySettlement[];
  agreements: ProviderAgreement[];
  consultation_types: ConsultationType[];
  exam_types: ExamType[];
  clinic_locations: Clinic[];
  referral_forms: ReferralFormTemplate[];
  blocked_dates?: BlockedDate[];
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
  clinic_id?: string; // which of the provider's clinic_locations this was booked at
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  duration_minutes: number;
  status: AppointmentStatus;
  price?: number; // total consultation price, resolved at booking time
  deposit_amount?: number; // 30% of price, charged to hold the slot
  // ISO timestamp of the deposit charge — starts the 48h cancellation/refund
  // window (see CANCELLATION_WINDOW_HOURS in client/appointments/page.tsx).
  deposit_paid_at?: string;
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
  // Left undefined for a general "any time works" request, rather than one
  // tied to a specific slot that turned out to be taken.
  date?: string; // yyyy-MM-dd
  time?: string; // HH:mm
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

// A provider's own note on a specific patient — visit summary, clinical
// instructions and any documents they attach. Scoped to the provider who
// wrote it: a provider's patient-chart view only ever queries records where
// provider_id matches their own id, so a patient's history with a different
// provider never surfaces here (see /provider/patients/[id]).
export interface VisitRecord {
  id: string;
  provider_id: string;
  provider_name: string;
  patient_id: string;
  appointment_id?: string;
  visit_date: string; // yyyy-MM-dd
  summary: string;
  instructions?: string;
  provider_documents?: UploadedFile[];
  created_date: string;
}

// Patient-facing "documents" tab. Lab results (LabReferral, above) are shown
// in the same tab but keep living in their own array — the documents page
// adapts them into this shape for display instead of duplicating the data.
export type DocumentCategory =
  | "referral_personal"
  | "receipt"
  | "visit_summary"
  | "questionnaire"
  | "lab_result"
  | "other";

export const DOCUMENT_CATEGORIES: { id: DocumentCategory; label: string }[] = [
  { id: "referral_personal", label: "הפניות וטפסים" },
  { id: "receipt", label: "קבלות" },
  { id: "visit_summary", label: "סיכומי ביקור" },
  { id: "questionnaire", label: "שאלונים" },
  { id: "lab_result", label: "תוצאות מעבדה" },
  { id: "other", label: "אחר" },
];

export type DocumentStatus = "ממתין למילוי" | "זמין";

export interface PatientDocument {
  id: string;
  patient_id: string;
  category: DocumentCategory;
  title: string;
  uploaded_by: "patient" | "provider" | "system";
  appointment_id?: string;
  status?: DocumentStatus;
  created_date: string;
  file?: UploadedFile;
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
