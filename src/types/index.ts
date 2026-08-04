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
] as const;

// Agents are picked per carrier, not typed free-hand — knowing which agent a
// policy runs through is what lets us quote the patient the price their own
// policy actually entitles them to (see the explainer in
// InsuranceProfileForm). "אחר" falls back to free text.
export const INSURANCE_AGENTS_BY_COMPANY: Record<(typeof B_INSURANCE_COMPANIES)[number], string[]> = {
  "כלל ביטוח": ["אבי שרון סוכנות לביטוח", "מיטב סוכנות ביטוח", "רונן לוי – סוכן ביטוח", "אשכול ביטוחים"],
  "הראל ביטוח": ["דוד פרידמן סוכנות לביטוח", "נועם ברק ביטוחים", "אופק סוכנות לביטוח", "שלמה את יעקב ביטוחים"],
  "מגדל ביטוח": ["יעל אדרי סוכנות ביטוח", "מרום סוכנות לביטוח", "איתן כהן – סוכן ביטוח", "גל ביטוחים"],
  "הפניקס": ["שגב סוכנות לביטוח", "ליאור מזרחי ביטוחים", "תמיר אשכנזי – סוכן ביטוח", "פסגות סוכנות ביטוח"],
  "מנורה מבטחים": ["נועה גרינברג סוכנות לביטוח", "כרמל ביטוחים", "עמית דגן – סוכן ביטוח", "רימון סוכנות ביטוח"],
  "איילון": ["אורן ביטון סוכנות לביטוח", "שחר ביטוחים", "מאיר טל – סוכן ביטוח", "נוף סוכנות לביטוח"],
  "הכשרה ביטוח": ["יובל אריאל סוכנות לביטוח", "מגן ביטוחים", "רועי שמיר – סוכן ביטוח", "תבור סוכנות ביטוח"],
  "שירביט": ["אלון רפאלי סוכנות לביטוח", "ספיר ביטוחים", "דנה הלוי – סוכנת ביטוח", "אלמוג סוכנות לביטוח"],
  AIG: ["ניר אבידן סוכנות לביטוח", "גלובל ביטוחים", "שירן קדוש – סוכנת ביטוח", "אורבן סוכנות ביטוח"],
  "ליברה": ["טל בן שושן סוכנות לביטוח", "דיגיטל ביטוחים", "עידו רם – סוכן ביטוח", "נובה סוכנות לביטוח"],
};

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
  // Not "לתייר": this is the out-of-pocket price anyone pays with no cover
  // that applies — an Israeli paying privately, and a tourist alike.
  H: "מחיר מלא (פרטי)",
};

// Supplemental HMO insurance (שב"ן) plan names are branded per-kupah, not a
// shared generic tier list — e.g. מאוחדת sells "מאוחדת עדיף"/"מאוחדת שיא",
// כללית sells "כללית זהב"/"כללית מושלם"/"כללית פלטינום".
// The plans actually sold in Israel today — a שב"ן is a paid programme, so
// there is no "בסיס" tier: a member either holds one of these or holds no שב"ן
// at all (layer S only).
export const K_LEVELS_BY_KUPAH = {
  "כללית": ["כללית מושלם", "כללית פלטינום"],
  "מכבי": ["מכבי שלי", "מכבי כסף", "מכבי זהב"],
  "מאוחדת": ["מאוחדת עדיף", "מאוחדת שיא"],
  "לאומית": ["לאומית כסף", "לאומית זהב"],
} as const satisfies Record<Kupah, readonly string[]>;

export type KLevel = (typeof K_LEVELS_BY_KUPAH)[Kupah][number];

// Private health-insurance carriers (§B layer) a provider may hold a billing
// arrangement with — a provider can have more than one.
//
// Deliberately THE SAME list the patient records their policy from: layer-B
// pricing matches a provider's `insurance_companies` against the patient's
// `b_insurances[].company` by exact string (see resolveProviderPrice), so a
// second, shorter-spelled list ("הראל" vs "הראל ביטוח") would silently make
// every B arrangement unmatchable and quietly bill patients the full price.
export const PRIVATE_INSURANCE_COMPANIES = B_INSURANCE_COMPANIES;

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

// How a specific payer settles a specific item (payments meeting §1/§8):
//   הסדר — the payer pays the provider directly and the patient is left with a
//          co-pay only (the price recorded here IS that co-pay);
//   החזר — the patient pays the full price and claims it back from the payer
//          themselves, outside Healson — so no co-pay is ever shown;
//   שניהם — the payer offers both, depending on the patient's plan.
export const PAYER_ARRANGEMENT_MODES = ["הסדר", "החזר", "שניהם"] as const;
export type PayerArrangementMode = (typeof PAYER_ARRANGEMENT_MODES)[number];

/** A price row for one payer — a קופה+שב"ן plan on layer K, or a private
 * carrier on layer B. Owned by the Healson catalog and negotiated by Healson
 * with the payer: a provider only ever READS these (payments meeting §6). */
export interface PayerPrice {
  layer: Extract<InsuranceLayer, "K" | "B">;
  kupah?: Kupah; // layer K
  level?: KLevel; // layer K — the specific שב"ן plan
  insurer?: string; // layer B
  /** The patient's co-pay under an הסדר. Absent on a pure החזר row. */
  price?: number;
  mode: PayerArrangementMode;
}

/** Display name of the payer a PayerPrice row belongs to. */
export function payerPriceLabel(p: PayerPrice): string {
  return p.level ?? p.insurer ?? p.kupah ?? "משלם";
}

/** @deprecated kept only for reference — superseded by PriceByLayer (SKBH model) */
export interface PriceByKupah {
  kupah: Kupah;
  price: number;
  discount?: number;
}

// Booking lifecycle (payments meeting 02.08.2026). Which states a booking
// actually passes through depends on the item and on the funding route:
//
//   referral gate (every item EXCEPT a consultation)
//     ממתין לאישור הפניה   — referral uploaded, the medical unit reviews it and
//                             approves/rejects; the slot is held meanwhile
//                             (slot_hold_expires_at).
//   funding gate
//     route S, and route B backed by an insurer commitment (mostly surgery):
//       ממתין להתחייבות  — waiting for the commitment document (טופס 17 /
//                          כתב התחייבות). No deposit is taken on this route.
//     every other route (K / B בהחזר / H):
//       ממתין לתשלום מקדמה -> מאושר
//   balance
//     ממתין לתשלום יתרה — the balance is charged automatically to the saved card
//                          the day before the appointment (12:00), UNLESS the
//                          unit collects it itself (balance_collector = "unit").
//     שולם במלואו -> בוצע
//
// Off-ramps: בוטל (anyone cancels, or the hold expires) and
// "בוטל — יתרה לא שולמה" (the automatic balance charge did not go through in
// time — kept distinct because it is a collection failure, not a decision).
export type AppointmentStatus =
  | "ממתין לאישור הפניה"
  | "ממתין להתחייבות"
  | "ממתין לתשלום מקדמה"
  | "מאושר"
  | "ממתין לתשלום יתרה"
  | "שולם במלואו"
  | "בוצע"
  | "בוטל"
  | "בוטל — יתרה לא שולמה";

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "ממתין לאישור הפניה",
  "ממתין להתחייבות",
  "ממתין לתשלום מקדמה",
  "מאושר",
  "ממתין לתשלום יתרה",
  "שולם במלואו",
  "בוצע",
  "בוטל",
  "בוטל — יתרה לא שולמה",
];

/** How long a slot stays reserved while the medical unit reviews the referral
 * ("ממתין לאישור הפניה"). */
export const UNIT_APPROVAL_HOLD_HOURS = 24;

/** The two cancellation states, kept together so callers never test one and
 * forget the other (a cancelled slot is free again either way). */
export const CANCELLED_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "בוטל",
  "בוטל — יתרה לא שולמה",
];

export function isCancelledAppointment(status: AppointmentStatus): boolean {
  return CANCELLED_APPOINTMENT_STATUSES.includes(status);
}

/** Who collects the balance left after the deposit — a policy set per medical
 * unit (payments meeting §5). Healson is the default: the balance is charged
 * automatically to the card saved at booking, the day before the appointment.
 * A unit may instead collect it at the counter, and then Healson never charges
 * the patient a second time. */
export type BalanceCollector = "healson" | "unit";

export const BALANCE_COLLECTORS: BalanceCollector[] = ["healson", "unit"];

export const BALANCE_COLLECTOR_LABELS: Record<BalanceCollector, string> = {
  healson: "Healson — חיוב אוטומטי יום לפני התור",
  unit: "גבייה עצמית במעמד הפגישה",
};

/** Payment picture of a single appointment, as the provider sees it on every
 * booking in the diary (payments meeting §7). Derived, never stored — see
 * src/lib/appointment-payments.ts. */
export type AppointmentPaymentState =
  | "ממתין למקדמה"
  | "מקדמה שולמה"
  | "ממתין להתחייבות"
  | "התחייבות הועלתה"
  | "יתרה ממתינה"
  | "יתרה שולמה"
  | 'נגבית ע"י היחידה'
  | "בוטל";

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
export type OtpIssueContext = "registration" | "login" | "password-reset" | "reauth";
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

export interface PatientInsurance {
  company: string;
  policy_number?: string;
  // Optional but strongly encouraged — the agent behind the policy determines
  // which terms apply, so it drives how accurately we can price for this
  // patient. Picked from INSURANCE_AGENTS_BY_COMPANY, or free text via "אחר".
  agent_name?: string;
}

export interface Patient {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  // A fallback number (spouse, parent, work line) — contact only, never an
  // auth channel: OTP always goes to `phone`, the verified one.
  secondary_phone?: string;
  id_number?: string;
  id_document_type?: "id" | "passport";
  id_document_photo?: UploadedFile;
  date_of_birth?: string;
  gender?: Gender;
  address?: string;
  parent_name?: string;
  // Undefined = no Israeli kupah on file (tourist / no institutional
  // coverage) — pricing falls to layer H (full private) for these patients,
  // see getPatientLayers in lib/pricing.ts. A missing kupah also means no
  // k_level (שב"ן) is possible, since that's sold per-kupah.
  kupah?: Kupah;
  k_level?: KLevel;
  // A patient can hold several private policies at once (unlike kupah,
  // which is single by law) — "has private insurance" is just
  // (b_insurances?.length ?? 0) > 0, not a separate stored flag.
  b_insurances?: PatientInsurance[];
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

// A reusable weekly schedule (לו"ז) defined once at the unit level and applied
// to several resources at once (§PRV-08). Sharing a schedule means the resources
// keep the SAME open hours, NOT the same queue: each resource that references it
// still books against its own independent availability (see getUnitResources) —
// "לו״ז אחד המוחל על כמה משאבים, זמינות עצמאית לכל משאב מאחורי הקלעים".
// A resource with its own inline `schedule` ignores this; one with `schedule_id`
// takes its weekly grid from here, and may still add its own date exceptions
// (e.g. a single doctor's vacation) on top.
export interface ResourceSchedule {
  id: string;
  name: string; // "לו״ז בוקר משותף" — free text
  schedule: WeeklySchedule;
  schedule_exceptions?: ScheduleException[];
  created_at: string;
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
  // מחיר פריט מלא (P) — Healson-catalog items only. The full list price the
  // S/K/B/H layer prices sit on top of; S and H always mirror the Ministry of
  // Health price list and are not editable by the provider.
  price_full?: number;
  catalog_item_id?: string; // links back to a CatalogItem chosen from the Skill Tree
  service_type?: ProviderServiceType;
  // Provider-type-specific category (see PROVIDER_TYPE_SERVICE_CATEGORIES) —
  // set instead of relying on service_type alone for organization types whose
  // catalogue has its own vocabulary ("בדיקות עד הבית", "בחירת מנתח"…).
  service_category?: string;
  // Ministry-of-Health procedure code (§PRV-09). Mandatory for the clinical
  // service types that have an official code — test / imaging / procedure /
  // surgery — chosen from the searchable code book in src/lib/moh-codes.ts.
  // Consultations and internal/product-like entries have no MOH code.
  moh_code?: string;
  linked_clinic_ids?: string[]; // Clinic ("calendar") ids this service can be booked against
  // Medical units (§PRV-08): an item belongs to one or more מערכים (service
  // lines), NOT to a specific machine or person — that is the level a unit
  // reasons at ("MRI ראש is part of מערך ההדמיה"). Which עמדות inside the מערך
  // actually perform it is stored on the עמדות themselves (`service_ids`), and
  // defaults to all of them.
  service_array_ids?: string[];
  // True when the item deliberately runs on only SOME of its מערך's עמדות —
  // e.g. a cardiac MRI only the 3T scanner can do. Purely a UI intent flag:
  // the authoritative link is still each עמדה's `service_ids`.
  limited_to_stations?: boolean;
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
  // Clinics this agreement covers — meaningful only on a SITE's agreements
  // (an institute, a lab), where a chain can be in-network at one branch and
  // not another. A doctor is in-network as a person, so their own agreements
  // are never branch-scoped. Empty/absent means every location, which is what
  // every pre-existing record means, so nothing breaks by leaving it unset.
  clinic_ids?: string[];
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
  // A מכון sells examinations and procedures, not opinions: the consultation
  // categories were removed here deliberately (payments meeting §6/§9). A
  // patient books an MRI/CT at a מכון and a ייעוץ with a doctor — never the
  // other way around.
  medical_institute: [
    "טיפולים",
    "פעולות",
    "בדיקות",
    "בדיקות עד הבית",
    "ניתוחים",
    "בחירת מנתח",
    "שירותים נוספים",
    "טיפולים עד הבית",
    "ציוד רפואי",
  ],
};

export function getProviderServiceCategories(type?: ProviderType): string[] | undefined {
  return type ? PROVIDER_TYPE_SERVICE_CATEGORIES[type] : undefined;
}

// ---------------------------------------------------------------------------
// Who may sell a consultation (payments meeting §6/§9).
//
// A consultation is delivered by a named physician, so it belongs to a doctor
// or to an outpatient clinic (which sells it through one of its affiliated
// doctors). A מכון רפואי / lab / pharmacy never lists one — its catalog is the
// examination-and-procedure world. This gates BOTH the item-type picker and
// the reference-catalog search in the provider portal, so a מכון cannot even
// find a consultation item to add.
// ---------------------------------------------------------------------------
export const CONSULTATION_PROVIDER_TYPES: ProviderType[] = [
  "doctor",
  "caregiver",
  "outpatient_clinic",
  "hospital",
  "medical_call_center",
];

export function canSellConsultations(type?: ProviderType): boolean {
  return !type || CONSULTATION_PROVIDER_TYPES.includes(type);
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
//
// @deprecated (§PRV-10) — superseded by `ProviderAffiliation`, a first-class,
// bidirectionally-consented, provider-type-agnostic join entity living in its
// own top-level store slice. This embedded shape (plus the inverse
// `ProviderProfile.organization_provider_ids`) is kept only as a read fallback
// during migration; new code must read/write `affiliations` instead.
// ---------------------------------------------------------------------------
export interface AffiliatedDoctor {
  id: string;
  doctor_provider_id: string; // ProviderProfile.id of a provider_type "doctor"
  role?: string; // "רופא בכיר", "מנהל יחידה"… free text
  service_ids: string[]; // ConsultationType ids of the organization's catalog
  clinic_ids?: string[]; // organization locations the doctor works at
  // The מערך (ServiceArray) this doctor's עמדה belongs to — placing it in a
  // branch + service line. `branch_id` is derived from the מערך; the free-text
  // `service_array` is a legacy display fallback for resources not yet migrated.
  service_array_id?: string;
  branch_id?: string;
  service_array?: string;
  // The doctor's own week inside the unit (§PRV-08). In a medical unit
  // availability is owned by the *resource* that delivers the service, not by
  // the unit as a whole — a doctor with no schedule of their own simply has no
  // bookable slots (their services fall back to the unit's general hours).
  // When `schedule_id` is set the weekly grid comes from a shared ResourceSchedule
  // (see resolveResourceSchedule); `schedule_exceptions` here still apply on top.
  schedule_id?: string;
  schedule?: WeeklySchedule;
  schedule_exceptions?: ScheduleException[];
  added_at: string;
}

// ---------------------------------------------------------------------------
// Provider ⇄ unit affiliation (§PRV-10) — a first-class, bidirectionally-
// consented working relationship between an individual service provider (a
// רופא/אחות/מטפל ProviderProfile) and a medical unit. Replaces the embedded
// AffiliatedDoctor + the inverse `organization_provider_ids` with ONE
// indexable record per (provider, unit) pair, so both sides read the same
// source of truth and consent state has somewhere to live.
//
// Two entry points, resolved by `initiated_by` (the OTHER side approves):
//   • unit invites an existing provider  → status "invited_by_unit"
//   • solo provider asks to join a unit  → status "requested_by_provider"
// A brand-new provider the unit types in (not yet on the platform) starts
// "unclaimed": bookable with implicit consent until that person claims their
// account, then ratifies or leaves.
//
// The in-unit weekly schedule lives here and is owned by the UNIT ALWAYS — the
// provider never edits it, only sees it as a read-only reflection. (There is
// deliberately no schedule_governance flag: the rule is fixed.)
// ---------------------------------------------------------------------------
export type AffiliationStatus =
  | "invited_by_unit"
  | "requested_by_provider"
  | "active"
  | "suspended"
  | "declined"
  | "ended"
  | "unclaimed";

export const AFFILIATION_STATUSES: AffiliationStatus[] = [
  "invited_by_unit",
  "requested_by_provider",
  "active",
  "suspended",
  "declined",
  "ended",
  "unclaimed",
];

export const AFFILIATION_STATUS_LABELS: Record<AffiliationStatus, string> = {
  invited_by_unit: "ממתין לאישור נותן/ת השירות",
  requested_by_provider: "ממתין לאישור הפניה",
  active: "פעיל",
  suspended: "מושהה",
  declined: "נדחה",
  ended: "הסתיים",
  unclaimed: "טרם נתבע",
};

// Statuses in which the affiliation produces a live, bookable resource inside
// the unit. Everything else (pending / suspended / terminal) does not.
export const BOOKABLE_AFFILIATION_STATUSES: AffiliationStatus[] = ["active", "unclaimed"];

export function isAffiliationBookable(status: AffiliationStatus): boolean {
  return BOOKABLE_AFFILIATION_STATUSES.includes(status);
}

// Provider types delivered by a single human whose PERSONAL time is the
// scheduling constraint — the axis the cross-context double-booking guard keys
// on (see Appointment.practitioner_id / src/lib/practitioner-availability.ts).
// Entity providers (store/pharmacy/lab/unit/…) book against the entity's own
// calendar instead and are not on this list.
export const PRACTITIONER_PROVIDER_TYPES: ProviderType[] = ["doctor", "caregiver"];
export function isPractitionerProviderType(type?: ProviderType): boolean {
  return !!type && PRACTITIONER_PROVIDER_TYPES.includes(type);
}

export interface ProviderAffiliation {
  id: string;
  // The individual service provider — a ProviderProfile of ANY human-delivered
  // provider type (doctor/caregiver/…), not just "doctor".
  provider_id: string;
  // The medical unit — a ProviderProfile that isUnitProviderType().
  unit_id: string;
  // Placement inside the unit (a resource's branch is derived from its מערך).
  branch_id?: string;
  service_array_id?: string;
  role?: string; // "רופא בכיר", "מנהל יחידה"… free text
  // Which of the unit's catalog services this provider delivers.
  service_ids: string[];
  // Consent / lifecycle state machine.
  status: AffiliationStatus;
  initiated_by: "unit" | "provider";
  requested_at: string;
  decided_at?: string; // when accepted or declined
  ended_at?: string;
  // The provider's weekly grid INSIDE the unit — owned by the unit, edited only
  // by the unit (the provider sees it read-only). Same shared-לו״ז mechanics as
  // every other unit resource: `schedule_id` → a ResourceSchedule, else inline.
  schedule_id?: string;
  schedule?: WeeklySchedule;
  schedule_exceptions?: ScheduleException[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Medical units (§PRV-08) — מכון רפואי / מרפאת חוץ.
//
// A unit is a single site (the unit IS the branch — no sub-branches), and what
// it sells is delivered by one of two kinds of *resource*:
//   • מתקן  — a machine/room with its own queue: "MRI 1", "CT 1", "חדר פעולות".
//   • רופא  — an affiliated doctor (see AffiliatedDoctor above).
// Each resource keeps its own weekly schedule and the services linked to it
// ("MRI ראש" and "MRI בטן" hang off MRI 1), and each resource is booked
// independently — MRI 1, CT 1 and a doctor can all run at the same hour.
// The unit-level week ("זמינות כללית") is the unit's opening hours plus the
// combined picture of every resource — see src/lib/unit-resources.ts.
// ---------------------------------------------------------------------------
export const UNIT_PROVIDER_TYPES: ProviderType[] = ["medical_institute", "outpatient_clinic"];

export function isUnitProviderType(type?: ProviderType): boolean {
  return !!type && UNIT_PROVIDER_TYPES.includes(type);
}

// Types that may SELF-register through the public join flow (the "solo" path).
// A medical unit is deliberately absent: units are onboarded manually — the
// agreements are signed off-platform and Healson ops opens the user — so
// offering "מכון רפואי" in a public type picker would create an account that
// bypasses that process. See src/lib/provider-phases.ts.
export const SELF_REGISTERABLE_PROVIDER_TYPES: ProviderType[] = PROVIDER_TYPES.filter(
  (t) => !UNIT_PROVIDER_TYPES.includes(t) && t !== "hospital"
);

export function isSelfRegisterableType(type?: ProviderType): boolean {
  return !!type && SELF_REGISTERABLE_PROVIDER_TYPES.includes(type);
}

// ---------------------------------------------------------------------------
// מערך (service line) — a first-class service domain inside a branch (§PRV-08).
//
// The hierarchy is יחידה → סניף → מערך → משאבי שירות (עמדות). A מערך is picked
// from this dedicated predefined catalog (an OPERATIONAL vocabulary — how a unit
// organizes its service lines — NOT the clinical Skill tree), then given a free
// display name ("מערך MRI קומה -1"). Resources (facilities/doctors) point at a
// מערך via `service_array_id`, which also places them in that מערך's branch.
// The legacy free-text `service_array` string is kept only as a display fallback.
// ---------------------------------------------------------------------------
export type ServiceArrayType =
  | "imaging"
  | "consultations"
  | "lab"
  | "samples"
  | "procedures"
  | "treatments"
  | "surgery"
  | "rehab"
  | "womens_health"
  | "other";

export const SERVICE_ARRAY_TYPES: ServiceArrayType[] = [
  "imaging",
  "consultations",
  "lab",
  "samples",
  "procedures",
  "treatments",
  "surgery",
  "rehab",
  "womens_health",
  "other",
];

export const SERVICE_ARRAY_TYPE_LABELS: Record<ServiceArrayType, string> = {
  imaging: "מערך הדמיה",
  consultations: "מערך ייעוצים",
  lab: "מערך מעבדה",
  samples: "מערך דגימות",
  procedures: "מערך פעולות",
  treatments: "מערך טיפולים",
  surgery: "מערך ניתוחים",
  rehab: "מערך שיקום",
  womens_health: "מערך בריאות האישה",
  other: "מערך אחר",
};

/** A מערך instance: a service line inside a specific branch, typed by the
 * predefined SERVICE_ARRAY_TYPES catalog. Lives in its own top-level store
 * slice (like OrganizationBranch), keyed to its branch via `branch_id`. */
export interface ServiceArray {
  id: string;
  branch_id: string; // the OrganizationBranch (סניף) this מערך belongs to
  type: ServiceArrayType; // from the predefined catalog
  name: string; // display name — defaults to the type label, editable
  created_date: string;
  // A schedule set directly on the מערך — applies to every עמדה/doctor placed
  // in it that doesn't keep its own independent week (see ScheduleHolder in
  // src/lib/schedule.ts, which this structurally satisfies).
  schedule?: WeeklySchedule;
  schedule_exceptions?: ScheduleException[];
}

export type FacilityKind =
  | "mri"
  | "ct"
  | "ultrasound"
  | "xray"
  | "mammography"
  | "pet_ct"
  | "bone_density"
  | "endoscopy"
  | "cardiology"
  | "treatment_room"
  | "procedure_room"
  | "operating_room"
  | "sampling_station"
  | "other";

export const FACILITY_KINDS: FacilityKind[] = [
  "mri",
  "ct",
  "ultrasound",
  "xray",
  "mammography",
  "pet_ct",
  "bone_density",
  "endoscopy",
  "cardiology",
  "treatment_room",
  "procedure_room",
  "operating_room",
  "sampling_station",
  "other",
];

export const FACILITY_KIND_LABELS: Record<FacilityKind, string> = {
  mri: "MRI",
  ct: "CT",
  ultrasound: "אולטרסאונד",
  xray: "רנטגן",
  mammography: "ממוגרפיה",
  pet_ct: "PET-CT",
  bone_density: "צפיפות עצם",
  endoscopy: "אנדוסקופיה",
  cardiology: "מכשור קרדיולוגי",
  treatment_room: "חדר טיפולים",
  procedure_room: "חדר פעולות",
  operating_room: "חדר ניתוח",
  sampling_station: "עמדת דגימות",
  other: "אחר",
};

/** A bookable machine/room inside a medical unit — its own queue, its own
 * week, and the services performed on it. */
export interface ProviderFacility {
  id: string;
  name: string; // "MRI 1" — free text, this is what the schedule is labelled by
  kind: FacilityKind;
  model?: string; // "Siemens Magnetom Vida 3T"
  room?: string; // "חדר 4, קומה -1"
  is_active: boolean;
  // The מערך (ServiceArray) this עמדה belongs to — placing it in a branch +
  // service line. `branch_id` is derived from the מערך; the free-text
  // `service_array` is a legacy display fallback for un-migrated resources.
  service_array_id?: string;
  // Which branch (site) of the unit this עמדה physically sits in.
  branch_id?: string;
  // The מערך (service line) this עמדה belongs to — "מערך MRI", "מערך ייעוצים".
  service_array?: string;
  // How many identical stations/machines this one עמדה represents (a עמדה of
  // "ראשון 08–17, קיבולת 4" = 4 concurrent slots per time). Default 1.
  capacity?: number;
  // ConsultationType ids performed on this facility ("MRI ראש", "MRI בטן"…).
  // Empty means the facility exists but nothing is bookable on it yet.
  service_ids: string[];
  // When set, the weekly grid comes from a shared ResourceSchedule applied to
  // this facility (see resolveResourceSchedule); its own `schedule_exceptions`
  // still apply on top. Falls back to the inline `schedule` when unset.
  schedule_id?: string;
  schedule?: WeeklySchedule;
  schedule_exceptions?: ScheduleException[];
  created_at: string;
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
  // Which join path this provider came in on — see src/lib/provider-phases.ts.
  // "solo" self-registers through /provider/register (phase רישום, then הקמה);
  // "unit" is opened manually by Healson ops and skips רישום entirely, landing
  // straight in הקמה as a blank slate. Optional: pre-split records derive it
  // from provider_type (units are never self-registerable).
  onboarding_path?: "solo" | "unit";
  // Set by verifyProviderPhoneOtp, right after the phone is entered on the
  // application's "פרטים אישיים" sub-step. There is no email counterpart:
  // the mail sent at signup is a welcome notification, not a gate.
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
  // Admin-managed organizations (ניהול ספקים): Healson ops creates each real
  // organization by hand, then creates its medical units (each unit is a full
  // ProviderProfile pointing back here) and a login user per unit.
  is_organization?: boolean;
  parent_organization_id?: string; // set on a medical unit created under an organization
  // Organization only (outpatient_clinic / medical_institute) — doctors
  // working under this organization and the services each one delivers.
  affiliated_doctors?: AffiliatedDoctor[];
  // Medical units only (§PRV-08) — the unit's machines/rooms, each with its own
  // queue and week. Together with affiliated_doctors these are the unit's
  // bookable resources.
  facilities?: ProviderFacility[];
  // Medical units only (§PRV-08) — reusable weekly schedules (לו״זים) defined
  // once and applied to several resources via their `schedule_id`. Editing one
  // here re-times every resource that references it.
  resource_schedules?: ResourceSchedule[];
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
  // Medical units only (payments meeting §5) — who collects the balance left
  // after the deposit. Undefined means the default, "healson".
  balance_collector?: BalanceCollector;
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
// Organization hierarchy: ארגון (רשת) → יחידה רפואית → סניף (site) → …
// A branch (סניף) is a physical site of a MEDICAL UNIT — the unit is the
// contracting/licensed entity, a branch is one of its addresses. It's a
// lightweight record (NOT a ProviderProfile — not a bookable provider), so it
// never appears in the providers table. Each branch points at its unit via
// unit_id (a ProviderProfile that has parent_organization_id set).
// ---------------------------------------------------------------------------
export interface OrganizationBranch {
  id: string;
  unit_id: string; // the medical-unit ProviderProfile this branch (site) belongs to
  name: string;
  city?: string;
  address?: string;
  contact_phone?: string;
  contact_email?: string;
  created_date: string;
}

// ---------------------------------------------------------------------------
// Item catalogs (§5.3) — the platform holds two SEPARATE reference catalogs,
// and every provider is exposed to exactly one of them, by provider type:
//
//   • קטלוג מב"ר ("mabar") — Ministry of Health item codes with the official
//     MoH price list in layers S and H. Used exclusively by medical units of
//     type מכון רפואי (medical_institute), חדרי ניתוח (hospital) and בתי
//     מרקחת (pharmacy).
//   • קטלוג הילסון ("healson") — Healson's own item codes, negotiated with
//     individual providers and with medical units that are NOT one of the
//     three MABAR types (מרפאות חוץ, שירותים עד הבית, מעבדות, מוקדים…).
//     Each item carries a full item price P plus Healson tariffs K and B;
//     S and H always mirror the MoH price list.
// ---------------------------------------------------------------------------
export type CatalogKind = "mabar" | "healson";

export const CATALOG_KINDS: CatalogKind[] = ["mabar", "healson"];

export const CATALOG_KIND_LABELS: Record<CatalogKind, string> = {
  mabar: 'קטלוג מב"ר (משרד הבריאות)',
  healson: "קטלוג הילסון",
};

export const CATALOG_CODE_LABELS: Record<CatalogKind, string> = {
  mabar: 'קוד מב"ר',
  healson: "קוד הילסון",
};

// Provider types locked to the MABAR catalog; every other type sees the
// Healson catalog. store/insurance_agency keep their free-text price lists
// (they are not medical and don't draw from either catalog).
export const MABAR_PROVIDER_TYPES: ProviderType[] = [
  "medical_institute",
  "hospital",
  "pharmacy",
];

export function catalogKindForProviderType(type?: ProviderType): CatalogKind {
  return type && MABAR_PROVIDER_TYPES.includes(type) ? "mabar" : "healson";
}

export interface CatalogItem {
  id: string;
  // The item's code inside its catalog — a MoH מב"ר code for "mabar" items,
  // a Healson code (HLS-…) for "healson" items. Item entry in the provider
  // portal searches by this code or by free text on name_he.
  tavar_code?: string;
  name_he: string;
  // Which of the two reference catalogs this item belongs to. Older persisted
  // data may miss it — the store normalizes undefined to "healson" on hydration.
  catalog: CatalogKind;
  skill_domain_id: string;
  skill_subdomain_id: string;
  service_type: ServiceType;
  // Headline price: for "mabar" items the MoH S-layer price, for "healson"
  // items the full item price P.
  base_price: number;
  // מחיר פריט מלא (P) — "healson" items only.
  price_full?: number;
  // Per-layer list prices. "mabar": S + H (both from the MoH price list).
  // "healson": K + B are Healson tariffs; S + H always mirror the MoH list.
  layer_prices?: PriceByLayer[];
  // Per-payer breakdown behind the K/B headline tariffs — one row per שב"ן plan
  // or private carrier, with the arrangement type Healson negotiated with it.
  // Maintained by Healson ops; read-only everywhere in the provider portal.
  payer_prices?: PayerPrice[];
  typical_duration_min?: number;
  requires_referral: boolean;
  provider_id?: string;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Catalog requests — when a provider searches the Healson catalog and the
// item they need isn't there, they submit a short request instead of hitting
// a dead end. Ops triages it from the /catalog "בקשות קטלוג" tab: approve →
// create a catalog item, merge into an existing item, ask for more info, or
// reject. Requests only originate from the Healson catalog (never מב"ר/תבר).
// ---------------------------------------------------------------------------
export type CatalogRequestStatus =
  | "pending"
  | "needs_info"
  | "approved"
  | "rejected"
  | "merged";

export const CATALOG_REQUEST_STATUSES: CatalogRequestStatus[] = [
  "pending",
  "needs_info",
  "approved",
  "rejected",
  "merged",
];

export const CATALOG_REQUEST_STATUS_LABELS: Record<CatalogRequestStatus, string> = {
  pending: "ממתין לבדיקה",
  needs_info: "נדרשת השלמה",
  approved: "אושר ונוצר",
  rejected: "נדחה",
  merged: "מוזג לפריט קיים",
};

export interface CatalogRequest {
  id: string;
  provider_id: string;
  // The name the provider typed into the catalog search that returned nothing.
  requested_name: string;
  // The provider's best guess at the item type (optional — Ops decides finally).
  service_type?: ProviderServiceType;
  // Short justification / clinical details the provider added.
  description?: string;
  // Always "healson" in the current flow (מב"ר items are never provider-requested).
  catalog_kind: CatalogKind;
  status: CatalogRequestStatus;
  created_date: string;
  resolved_at?: string;
  // Ops note surfaced back to the provider on reject / needs_info.
  admin_note?: string;
  // The catalog item this request produced (approved) or was folded into (merged).
  resolved_item_id?: string;
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
  // For medical units (§PRV-08): which resource — a facility (MRI-1, CT-1) or an
  // affiliated doctor — actually holds this appointment. Capacity is counted per
  // resource, so two appointments at the same time on different resources are
  // legitimate. Undefined on unit appointments booked before the resource model
  // existed (and on every non-unit provider, which has a single calendar).
  resource_id?: string;
  // §PRV-10 — the single human whose time this appointment consumes, if any.
  // Independent of who OWNS the calendar: for a solo booking it equals
  // provider_id; for a unit booking delivered by an affiliated provider it is
  // that provider's OWN ProviderProfile id (not the unit, not the affiliation).
  // Undefined for facility/room bookings (no person) and legacy records. This
  // is the axis the cross-context double-booking guard keys on — a person is
  // never bookable twice at once across ALL their contexts. See
  // src/lib/practitioner-availability.ts.
  practitioner_id?: string;
  // §PRV-10 — the one calendar that OWNS this event (exactly one owner). For a
  // unit resource it is the resource_id; for a solo provider it is that
  // provider's id (optionally narrowed by clinic_id). Used to decide who may
  // edit/cancel the event vs. who merely sees it as a read-only reflection.
  owner_context_id?: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  duration_minutes: number;
  status: AppointmentStatus;
  price?: number; // total consultation price, resolved at booking time
  deposit_amount?: number; // deposit charged to hold the slot (see DEPOSIT_RATE)
  // ISO timestamp of the deposit charge — starts the 48h cancellation/refund
  // window (see CANCELLATION_WINDOW_HOURS in client/appointments/page.tsx).
  deposit_paid_at?: string;
  kupah?: Kupah;
  notes?: string;
  created_by_id?: string; // patient id
  referral_document?: UploadedFile;
  // --- payments meeting 02.08.2026 -----------------------------------------
  // Which funding route this booking runs on, resolved from the patient's
  // insurance profile at booking time. It decides whether the patient pays a
  // deposit at all (K/B-refund/H) or uploads a commitment instead (S, and B
  // backed by an insurer commitment).
  funding_layer?: InsuranceLayer;
  // The unit's decision on the uploaded referral (§7). A rejection frees the
  // slot, so it always comes with a reason the patient can act on.
  referral_decision?: "approved" | "rejected";
  referral_decided_at?: string;
  referral_rejection_reason?: string;
  // While the referral is under review the slot is held rather than booked —
  // roughly a day, after which it is released back to the calendar.
  slot_hold_expires_at?: string;
  // Route S / B-with-commitment: טופס 17 or the insurer's כתב התחייבות.
  commitment_document?: UploadedFile;
  // What is left after the deposit, when it falls due, and whether it was
  // collected. balance_collector is snapshotted from the unit's policy at
  // booking time so changing the policy never rewrites past bookings.
  balance_amount?: number;
  balance_due_at?: string;
  balance_paid_at?: string;
  balance_collector?: BalanceCollector;
}

// Deposit rule (payments meeting §3/§8): the deposit is derived from the
// commission — either a percentage of the price or a flat amount for the
// provider/item category. It is never presented to the patient as "commission"
// or as a percentage, only as a shekel figure.
export const DEPOSIT_RATE = 0.2;

/** The deposit for a price under the percentage rule, rounded to whole shekels. */
export function depositForPrice(price: number, rate: number = DEPOSIT_RATE): number {
  return Math.round(price * rate);
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
  // Set by system-generated docs (booking receipts, questionnaires, the
  // required-documents checklist) — always exactly one appointment.
  appointment_id?: string;
  // Set by patient-initiated manual uploads (the "מסמך חדש" / "הוספת מסמך
  // אחר" dialogs) — zero, one, or many linked appointments. Kept separate
  // from appointment_id rather than folding those flows onto it, since a
  // single scalar can't express "linked to two appointments".
  appointment_ids?: string[];
  status?: DocumentStatus;
  created_date: string;
  file?: UploadedFile;
}

/** Every appointment a document is linked to, regardless of which of the two
 * linking fields produced it (see PatientDocument). */
export function documentAppointmentIds(doc: PatientDocument): string[] {
  return doc.appointment_ids ?? (doc.appointment_id ? [doc.appointment_id] : []);
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
