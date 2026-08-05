import {
  Appointment,
  B_INSURANCE_COMPANIES,
  Branch,
  CatalogItem,
  CatalogRequest,
  Clinic,
  ScheduleShift,
  WeeklySchedule,
  ConsentRecord,
  CONSENT_DOCUMENT_VERSION,
  DocumentCategory,
  DsrRequest,
  INSURANCE_AGENTS_BY_COMPANY,
  Kupah,
  K_LEVELS_BY_KUPAH,
  Lead,
  LabReferral,
  Order,
  Patient,
  PatientDocument,
  PayerPrice,
  PriceByLayer,
  OrganizationBranch,
  ProviderAffiliation,
  ServiceArray,
  ServiceArrayType,
  ProviderProfile,
  ProviderType,
  User,
  VisitRecord,
  depositForPrice,
  emptyWeeklySchedule,
  isUnitProviderType,
} from "@/types";
import { generateId, isoDateDaysFromNow, isoTimestampHoursFromNow } from "./utils";
import { SEED_SKILL_DOMAINS, SEED_SKILL_SUBDOMAINS } from "./medical-tree";
import { scheduleToLegacyHours } from "./schedule";
import { resolveCatalogPrice, resolvePriceBreakdown } from "./pricing";
import { balanceDueAt } from "./appointment-payments";
import { DEFAULT_COMMISSION_RATE, FixedFeeRule } from "./commission";

// -------------------------------------------------------------------------
// Demo accounts — used by the mock auth flow (see src/lib/store.ts).
// Any email/password combination works; if the email matches one of these,
// the matching role + record is used. Otherwise a new patient is created.
// ---------------------------------------------------------------------------
export const DEMO_PATIENT_USER: User = {
  id: "user_patient_1",
  email: "patient@demo.co.il",
  full_name: "נועה כהן",
  role: "patient",
  phone: "050-1234567",
  created_date: isoDateDaysFromNow(-120),
};

// A patient-role user with no linked Patient record — used by the "מטופל
// חדש" demo login so the demo can show the pre-registration experience
// (no insurance profile yet => no prices, booking gated to /register).
export const DEMO_NEW_PATIENT_USER: User = {
  id: "user_patient_new",
  email: "new-patient@demo.co.il",
  full_name: "מטופל חדש",
  role: "patient",
  created_date: isoDateDaysFromNow(-1),
};

export const DEMO_PROVIDER_USER: User = {
  id: "user_provider_1",
  email: "provider@demo.co.il",
  full_name: "ד\"ר אבי לוי",
  role: "provider",
  phone: "050-7654321",
  created_date: isoDateDaysFromNow(-300),
};

// The specialist behind the payments-meeting examples (§9): a ₪2,000
// consultation with a real doctor. Given its own login so the deposit /
// balance flow can be demoed from the PROVIDER side, not only from admin.
export const DEMO_NEURO_USER: User = {
  id: "user_provider_neuro",
  email: "neuro@demo.co.il",
  full_name: 'ד"ר יערה בן-דוד',
  role: "provider",
  phone: "052-8112340",
  created_date: isoDateDaysFromNow(-150),
};

// Organization provider demo accounts — a מכון רפואי and a מרפאת חוץ. The
// "כניסה מאובטחת של ספק" demo offers these as the "יחידה רפואית" option,
// next to the single-practitioner account above.
export const DEMO_INSTITUTE_USER: User = {
  id: "user_provider_institute",
  email: "institute@demo.co.il",
  full_name: "מכון רפואי הדסה  ",
  role: "provider",
  phone: "03-5559090",
  created_date: isoDateDaysFromNow(-260),
};

export const DEMO_OUTPATIENT_USER: User = {
  id: "user_provider_outpatient",
  email: "clinic@demo.co.il",
  full_name: "מרפאות חוץ הדסה קהילה",
  role: "provider",
  phone: "02-5558080",
  created_date: isoDateDaysFromNow(-210),
};

// A THIRD unit account, deliberately mid-הקמה: the credentials Ops hands a
// newly-signed unit, before the unit has entered anything. The two accounts
// above are fully built and open on a finished profile, so neither can show
// what a unit actually does on day one — see prov_org_unit_setup below.
export const DEMO_UNIT_SETUP_USER: User = {
  id: "user_provider_unit_setup",
  email: "setup@demo.co.il",
  full_name: "מכון אורתופדי רמת גן",
  role: "provider",
  phone: "03-7000009",
  created_date: isoDateDaysFromNow(-2),
};

export const DEMO_ADMIN_USER: User = {
  id: "user_admin_1",
  email: "admin@demo.co.il",
  full_name: "מנהל מערכת",
  role: "admin",
  admin_title: "superadmin",
  created_date: isoDateDaysFromNow(-500),
};

// A second seeded superadmin — ADM-07 requires at least 2 superadmins from
// the team to exist out of the box (support reps are added later via the UI).
export const DEMO_ADMIN_USER_2: User = {
  id: "user_admin_2",
  email: "ops@demo.co.il",
  full_name: "דנה שגיא",
  role: "admin",
  admin_title: "superadmin",
  created_date: isoDateDaysFromNow(-400),
};

export const SEED_USERS: User[] = [
  DEMO_PATIENT_USER,
  DEMO_NEW_PATIENT_USER,
  DEMO_PROVIDER_USER,
  DEMO_NEURO_USER,
  DEMO_INSTITUTE_USER,
  DEMO_OUTPATIENT_USER,
  DEMO_UNIT_SETUP_USER,
  DEMO_ADMIN_USER,
  DEMO_ADMIN_USER_2,
];

const provider2ClinicId = generateId("clinic");
// Stable ids — the ergometry clinic below is scoped to that one item, and the
// consultation clinics to everything that fits their 30-minute grid, so shifts
// and items have to be able to reference each other.
const provider2ErgometryId = "ct_p2_ergometry";
const provider2ConsultId = "ct_p2_consult";
const provider2EcgId = "ct_p2_ecg";
const provider2EchoId = "ct_p2_echo";
const provider2HolterId = "ct_p2_holter";
const provider2ClinicServiceIds = [
  provider2ConsultId,
  provider2EcgId,
  provider2EchoId,
  provider2HolterId,
];

const provider2: ProviderProfile = {
  id: "prov_2",
  provider_type: "doctor",
  user_id: undefined,
  display_name: "ד\"ר מיכל ברק",
  title: "ד\"ר",
  specialty: "קרדיולוגיה",
  sub_specialties: ["קרדיולוגיה התערבותית", "אי ספיקת לב"],
  doctor_subtype: "physician",
  bio: "מומחית ברפואת לב עם ניסיון של מעל 15 שנה, בעלת תואר נוסף בקרדיולוגיה התערבותית. מתמחה באבחון מוקדם ומעקב מטופלי לב כרוניים.",
  languages: ["עברית", "אנגלית", "רוסית"],
  rating: 4.9,
  review_count: 212,
  license_number: "MD-44521",
  license_issuer: "משרד הבריאות",
  // Also practises under the מרפאות חוץ demo organization (see
  // providerOutpatient.affiliated_doctors) — one doctor record, two contexts.
  organization_provider_ids: ["prov_outpatient"],
  license_issue_date: isoDateDaysFromNow(-1500),
  license_expiry_date: isoDateDaysFromNow(900),
  is_published: true,
  status: "approved",
  commission_rate: 12,
  created_date: isoDateDaysFromNow(-400),
  agreements: [
    { id: generateId("agr"), provider_id: "prov_2", layer: "K", kupah_list: ["כללית", "מכבי", "לאומית"] },
    // Insurer names must be the canonical B_INSURANCE_COMPANIES strings — the
    // B price is matched against the policy on the patient's record, so a short
    // form ("הראל") would silently never match "הראל ביטוח".
    { id: generateId("agr"), provider_id: "prov_2", layer: "B", insurance_companies: ["כלל ביטוח", "הראל ביטוח"] },
    { id: generateId("agr"), provider_id: "prov_2", layer: "H" },
  ],
  kupah_arrangements: [
    { kupah: "כללית", level: "כללית פלטינום" },
    { kupah: "מכבי", level: "מכבי כסף" },
    { kupah: "לאומית", level: "לאומית זהב" },
  ],
  private_insurance_companies: ["כלל ביטוח", "הראל ביטוח"],
  consultation_types: [
    {
      id: provider2ConsultId,
      name: "ייעוץ קרדיולוגי כללי",
      duration_minutes: 30,
      prices: [
        { layer: "K", price: 130 },
        { layer: "B", price: 60 },
        { layer: "H", price: 480 },
      ],
      price_full: 420,
      service_type: "consultation",
      linked_clinic_ids: [provider2ClinicId],
      requires_questionnaire: true,
      questionnaire_title: "שאלון בריאות כללי",
      required_documents: [
        { id: generateId("reqdoc"), label: "רשימת תרופות נוכחית" },
        { id: generateId("reqdoc"), label: "תוצאות בדיקת דם אחרונה (אם קיימות)" },
      ],
    },
    {
      id: provider2EcgId,
      name: "אק״ג במנוחה",
      duration_minutes: 15,
      prices: [
        { layer: "K", price: 55 },
        { layer: "B", price: 25 },
        { layer: "H", price: 210 },
      ],
      price_full: 180,
      service_type: "test",
      moh_code: "21030",
      linked_clinic_ids: [provider2ClinicId],
    },
    {
      id: provider2ErgometryId,
      name: "מבחן מאמץ לבבי (ארגומטריה)",
      duration_minutes: 45,
      prices: [
        { layer: "K", price: 200 },
        { layer: "B", price: 90 },
        { layer: "H", price: 750 },
      ],
      price_full: 650,
      service_type: "test",
      moh_code: "21040",
      linked_clinic_ids: [provider2ClinicId],
      required_documents: [{ id: generateId("reqdoc"), label: "אק״ג אחרון (אם קיים)" }],
    },
    // Unified into the single services list (no more separate "בדיקות"
    // tab/section) — see B2/B3 in the services-merge fix.
    {
      id: provider2EchoId,
      name: "אקו לב (אקוקרדיוגרפיה)",
      duration_minutes: 30,
      prices: [
        { layer: "K", price: 260 },
        { layer: "B", price: 120 },
        { layer: "H", price: 920 },
      ],
      price_full: 800,
      service_type: "imaging",
      moh_code: "52040",
      linked_clinic_ids: [provider2ClinicId],
    },
    {
      id: provider2HolterId,
      name: "הולטר קצב לב 24 שעות",
      duration_minutes: 20,
      prices: [
        { layer: "K", price: 180 },
        { layer: "B", price: 80 },
        { layer: "H", price: 600 },
      ],
      price_full: 520,
      service_type: "test",
      moh_code: "21090",
      linked_clinic_ids: [provider2ClinicId],
    },
  ],
  exam_types: [],
  // A real cardiology week: consultation clinics on a 30-minute grid, and a
  // separate ergometry block on a 45-minute grid — a stress test cannot be
  // squeezed into a consultation slot, which is exactly what a flat
  // "08:00–16:00, every day" schedule was quietly implying.
  clinic_locations: [
    clinicWithSchedule({
      id: provider2ClinicId,
      name: "מרפאת הלב תל אביב",
      address: "אבן גבירול 50",
      city: "תל אביב",
      phone: "03-5551234",
      is_primary: true,
      location_type: "clinic",
      schedule: weekly({
        // The consultation clinics are scoped to the items that FIT a 30-minute
        // slot; the ergometry has its own 45-minute block. Leaving them
        // unscoped would offer patients a stress test in a slot half its length.
        sunday: [
          shift("sh_p2_sun", "08:00", "14:00", {
            label: "מרפאת בוקר",
            slot_minutes: 30,
            service_ids: provider2ClinicServiceIds,
          }),
        ],
        monday: [
          shift("sh_p2_mon", "08:00", "14:00", {
            label: "מרפאת בוקר",
            slot_minutes: 30,
            service_ids: provider2ClinicServiceIds,
            breaks: [{ id: "br_p2_mon", start: "11:00", end: "11:20", label: "הפסקה" }],
          }),
        ],
        tuesday: [
          shift("sh_p2_tue_am", "08:00", "12:00", {
            label: "מרפאת בוקר",
            slot_minutes: 30,
            service_ids: provider2ClinicServiceIds,
          }),
          shift("sh_p2_tue_pm", "14:00", "17:00", {
            label: "מרפאת מאמץ",
            slot_minutes: 45,
            service_ids: [provider2ErgometryId],
          }),
        ],
        wednesday: [
          shift("sh_p2_wed", "08:00", "16:00", {
            label: "יום רציף",
            slot_minutes: 30,
            service_ids: provider2ClinicServiceIds,
          }),
        ],
        thursday: [
          shift("sh_p2_thu", "08:00", "14:00", {
            label: "מרפאת בוקר",
            slot_minutes: 30,
            service_ids: provider2ClinicServiceIds,
          }),
        ],
      }),
      schedule_exceptions: [
        { id: "exc_p2_1", date: isoDateDaysFromNow(7), closed: true, reason: "כנס האיגוד הקרדיולוגי" },
      ],
    }),
  ],
  referral_forms: [
    {
      id: generateId("form"),
      name: "הפניה לבדיקת דם",
      fields: [
        { id: generateId("f"), name: "סוג בדיקה", type: "text", required: true },
        { id: generateId("f"), name: "הערות קליניות", type: "textarea", required: false },
      ],
    },
  ],
};

const provider1ClinicId = generateId("clinic");
// A second location for the same doctor (§location picker demo) — he splits
// his week between the two, so each has different weekly hours.
const provider1ClinicId2 = generateId("clinic");
// Stable ids — the injections clinic and the operating block are scoped to
// these specific items, so shift and item must reference each other.
const provider1ConsultId = "ct_p1_consult";
const provider1SecondOpinionId = "ct_p1_second_opinion";
const provider1InjectionId = "ct_p1_injection";
const provider1SurgeryId = "ct_p1_arthroscopy";

const provider1: ProviderProfile = {
  id: "prov_1",
  provider_type: "doctor",
  user_id: DEMO_PROVIDER_USER.id,
  display_name: "ד\"ר אבי לוי",
  title: "ד\"ר",
  specialty: "אורתופדיה",
  sub_specialties: ["כירורגיית ברך", "כירורגיית כתף", "ניתוחים זעיר-פולשניים"],
  // The bio says "מנתח" — so the record has to BE a surgeon: the surgeon
  // subtype is what makes the platform ask for board certification, malpractice
  // cover and hospital privileges (§apply flow).
  doctor_subtype: "surgeon",
  surgical_privileges_hospital: "מרכז רפואי הדסה עין כרם",
  bio: "מנתח אורתופד בכיר המתמחה בכירורגיית ברך וכתף, כולל ניתוחים זעיר-פולשניים. ליווה אלפי מטופלים בדרך להחלמה מלאה.",
  languages: ["עברית", "אנגלית"],
  rating: 4.8,
  review_count: 348,
  license_number: "MD-11823",
  license_issuer: "משרד הבריאות",
  license_issue_date: isoDateDaysFromNow(-2000),
  license_expiry_date: isoDateDaysFromNow(700),
  is_published: true,
  status: "approved",
  commission_rate: 15,
  created_date: isoDateDaysFromNow(-600),
  agreements: [
    { id: generateId("agr"), provider_id: "prov_1", layer: "S", kupah_list: ["כללית", "מכבי", "מאוחדת", "לאומית"] },
    // Deliberately NOT clinic-scoped: a doctor is in-network as a person, so
    // the same patient gets the same price at either of their clinics.
    { id: generateId("agr"), provider_id: "prov_1", layer: "K" },
    // A private surgery is what B cover is actually FOR — without this layer the
    // surgery below would only ever price at the full private rate.
    // Includes מגדל ביטוח — the demo patient's own policy — so her knee
    // arthroscopy demonstrates route B settled by an insurer undertaking:
    // the form is collected and no deposit is charged.
    { id: generateId("agr"), provider_id: "prov_1", layer: "B", insurance_companies: ["הראל ביטוח", "כלל ביטוח", "מנורה מבטחים", "מגדל ביטוח"] },
    { id: generateId("agr"), provider_id: "prov_1", layer: "H" },
  ],
  // Same קופה, two שב"ן plans — a provider can hold more than one plan of
  // the same קופה (e.g. both מאוחדת עדיף and מאוחדת שיא).
  kupah_arrangements: [
    { kupah: "מאוחדת", level: "מאוחדת עדיף" },
    { kupah: "מאוחדת", level: "מאוחדת שיא" },
    { kupah: "כללית", level: "כללית מושלם" },
  ],
  consultation_types: [
    {
      // A specialist visit reached with a kupah referral is exactly what layer
      // S funds — hence the S price here rather than on the private second
      // opinion below.
      id: provider1ConsultId,
      name: "ייעוץ אורתופדי — ברך וכתף",
      duration_minutes: 30,
      prices: [
        { layer: "S", price: 0 },
        { layer: "K", price: 120 },
        { layer: "B", price: 60 },
        { layer: "H", price: 520 },
      ],
      price_full: 450,
      service_type: "consultation",
      linked_clinic_ids: [provider1ClinicId, provider1ClinicId2],
      requires_referral: true,
      required_documents: [
        { id: generateId("reqdoc"), label: "הפניה/התחייבות מהקופה" },
        { id: generateId("reqdoc"), label: "צילומי רנטגן או MRI קודמים (אם קיימים)" },
      ],
    },
    {
      // A second opinion before surgery is a private product (or via שב"ן) —
      // the basket doesn't fund it, so no S price.
      id: provider1SecondOpinionId,
      name: "חוות דעת שנייה לפני ניתוח",
      duration_minutes: 30,
      prices: [
        { layer: "K", price: 100 },
        { layer: "H", price: 450 },
      ],
      price_full: 390,
      service_type: "consultation",
      linked_clinic_ids: [provider1ClinicId, provider1ClinicId2],
      required_documents: [{ id: generateId("reqdoc"), label: "מסמכי הייעוץ/הניתוח המוצע" }],
    },
    // An orthopaedist's clinic performs guided injections — it does NOT operate
    // an MRI scanner (that's an imaging institute's machine, see
    // providerInstitute). The item a knee patient actually books here is the
    // injection; the MRI is something they arrive WITH.
    {
      id: provider1InjectionId,
      name: "הזרקה תוך-מפרקית מונחית אולטרסאונד",
      duration_minutes: 20,
      prices: [
        { layer: "K", price: 180 },
        { layer: "B", price: 90 },
        { layer: "H", price: 750 },
      ],
      price_full: 650,
      service_type: "procedure",
      moh_code: "32020",
      linked_clinic_ids: [provider1ClinicId],
    },
    {
      id: provider1SurgeryId,
      name: "ארתרוסקופיה של הברך",
      duration_minutes: 90,
      prices: [
        { layer: "B", price: 1500 },
        { layer: "H", price: 21280 },
      ],
      price_full: 18500,
      service_type: "surgery",
      moh_code: "42010",
      linked_clinic_ids: [provider1ClinicId],
      requires_referral: true,
      anesthesia_type: "general",
      recovery_days: 21,
      requires_hospital: true,
      required_documents: [
        { id: generateId("reqdoc"), label: "MRI עדכני של הברך" },
        { id: generateId("reqdoc"), label: "אישור כשירות לניתוח (בדיקות דם + אק״ג)" },
      ],
    },
  ],
  exam_types: [],
  // An orthopaedic surgeon's real week: consultation clinics on a 30-minute
  // grid, a dedicated injections clinic on a 20-minute grid, and one operating
  // block a week at 90 minutes a case. A flat "09:00–17:00 every day" cannot
  // express any of that — and would offer patients a 90-minute operation in a
  // 30-minute consultation slot.
  clinic_locations: [
    clinicWithSchedule({
      id: provider1ClinicId,
      name: "מרפאת אורתופדיה רמת גן",
      address: "ביאליק 12",
      city: "רמת גן",
      phone: "03-6661234",
      is_primary: true,
      location_type: "clinic",
      schedule: weekly({
        sunday: [
          shift("sh_p1_sun_am", "09:00", "13:00", {
            label: "מרפאת בוקר",
            slot_minutes: 30,
            service_ids: [provider1ConsultId, provider1SecondOpinionId],
          }),
          shift("sh_p1_sun_pm", "16:00", "19:00", {
            label: "מרפאת אחר הצהריים",
            slot_minutes: 30,
            service_ids: [provider1ConsultId, provider1SecondOpinionId],
          }),
        ],
        monday: [
          shift("sh_p1_mon_am", "09:00", "13:00", {
            label: "מרפאת בוקר",
            slot_minutes: 30,
            service_ids: [provider1ConsultId, provider1SecondOpinionId],
          }),
          shift("sh_p1_mon_pm", "14:00", "17:30", {
            label: "ניתוחים — מרכז רפואי הדסה עין כרם",
            slot_minutes: 90,
            service_ids: [provider1SurgeryId],
          }),
        ],
        tuesday: [
          shift("sh_p1_tue_am", "09:00", "13:00", {
            label: "מרפאת בוקר",
            slot_minutes: 30,
            service_ids: [provider1ConsultId, provider1SecondOpinionId],
          }),
          shift("sh_p1_tue_pm", "14:00", "16:00", {
            label: "מרפאת הזרקות",
            slot_minutes: 20,
            service_ids: [provider1InjectionId],
          }),
        ],
        thursday: [
          shift("sh_p1_thu", "09:00", "17:00", {
            label: "יום רציף",
            slot_minutes: 30,
            service_ids: [provider1ConsultId, provider1SecondOpinionId],
            breaks: [{ id: "br_p1_thu", start: "13:00", end: "13:30", label: "הפסקת צהריים" }],
          }),
        ],
        friday: [
          shift("sh_p1_fri", "09:00", "12:00", {
            label: "בוקר מקוצר",
            slot_minutes: 30,
            service_ids: [provider1ConsultId, provider1SecondOpinionId],
          }),
        ],
      }),
      schedule_exceptions: [
        { id: "exc_p1_1", date: isoDateDaysFromNow(14), closed: true, reason: "כנס אורתופדיה שנתי" },
      ],
    }),
    clinicWithSchedule({
      id: provider1ClinicId2,
      name: "מרפאת אורתופדיה תל אביב",
      address: "דיזנגוף 150",
      city: "תל אביב",
      phone: "03-6669876",
      is_primary: false,
      location_type: "clinic",
      schedule: weekly({
        wednesday: [
          shift("sh_p1_wed", "10:00", "18:00", {
            label: "מרפאת תל אביב",
            slot_minutes: 30,
            breaks: [{ id: "br_p1_wed", start: "13:30", end: "14:00", label: "הפסקה" }],
          }),
        ],
      }),
    }),
  ],
  referral_forms: [
    {
      id: generateId("form"),
      name: "הפניה לבדיקת דימות",
      fields: [
        { id: generateId("f"), name: "אזור בדיקה", type: "text", required: true },
        { id: generateId("f"), name: "תאריך מבוקש", type: "date", required: false },
      ],
    },
  ],
};

const provider3: ProviderProfile = {
  id: "prov_3",
  display_name: "ד\"ר רונית שני",
  title: "ד\"ר",
  specialty: "נוירולוגיה",
  license_number: "MD-93221",
  license_file: {
    file_name: "license-ronit-shani.pdf",
    uploaded_at: isoDateDaysFromNow(-40),
    data_url: "data:application/pdf;base64,",
  },
  is_published: false,
  status: "pending_review",
  application_submitted_at: isoDateDaysFromNow(-40),
  created_date: isoDateDaysFromNow(-40),
  agreements: [],
  consultation_types: [],
  exam_types: [],
  clinic_locations: [],
  referral_forms: [],
};

// Mid-onboarding demo record (§PROV-ONBOARDING) — license already verified,
// all 3 steps complete, waiting on Admin's Go-Live decision.
const provider4: ProviderProfile = {
  id: "prov_4",
  display_name: "ד\"ר יעל אשכנזי",
  title: "ד\"ר",
  specialty: "רפואת עור",
  license_number: "MD-77410",
  license_file: {
    file_name: "license-yael-eshkenazi.pdf",
    uploaded_at: isoDateDaysFromNow(-10),
    data_url: "data:application/pdf;base64,",
  },
  is_published: false,
  status: "onboarding",
  application_submitted_at: isoDateDaysFromNow(-10),
  license_verified_at: isoDateDaysFromNow(-9),
  agreement_signed_at: isoDateDaysFromNow(-1),
  // Deliberately NOT onboarding_ready_at: this provider has signed the
  // agreement and added a service, but has no clinic_locations yet — a ready
  // seed to demo the "add a calendar before you can link a service" flag
  // without needing any extra hand-authored data.
  created_date: isoDateDaysFromNow(-10),
  agreements: [{ id: generateId("agr"), provider_id: "prov_4", layer: "H" }],
  consultation_types: [
    {
      id: generateId("ct"),
      name: "ייעוץ עור כללי",
      duration_minutes: 20,
      prices: [{ layer: "H", price: 400 }],
      price_full: 350,
      service_type: "consultation",
    },
    // Mole mapping is the one item every dermatology clinic sells alongside the
    // consultation — enough to make the mid-onboarding record read as real
    // without giving it the full catalogue of a live provider.
    {
      id: generateId("ct"),
      name: "מיפוי שומות דיגיטלי (דרמוסקופיה)",
      duration_minutes: 30,
      prices: [{ layer: "H", price: 630 }],
      price_full: 550,
      service_type: "test",
      moh_code: "21070",
    },
  ],
  exam_types: [],
  clinic_locations: [],
  referral_forms: [],
};

// Published gastro provider whose K/B agreements are gated to kupot/insurers
// other than the demo patient's own (§7.1) — no arrangement price here, but
// since the provider still declares those layers, the patient can claim the
// visit back from their own מכבי-שלי / מגדל cover after paying in full.
const provider5ClinicId = generateId("clinic");
const provider5ConsultId = "ct_p5_consult";
const provider5GastroId = "ct_p5_gastro";
const provider5ColonoId = "ct_p5_colono";

const provider5: ProviderProfile = {
  id: "prov_5",
  display_name: "ד\"ר עדי רון",
  title: "ד\"ר",
  specialty: "גסטרואנטרולוגיה",
  sub_specialties: ["אנדוסקופיה", "מחלות מעי דלקתיות"],
  bio: "מומחית לגסטרואנטרולוגיה ואנדוסקופיה, עם התמקדות באבחון וטיפול במחלות מערכת העיכול.",
  languages: ["עברית", "אנגלית"],
  rating: 4.7,
  review_count: 156,
  license_number: "MD-65310",
  license_issuer: "משרד הבריאות",
  license_issue_date: isoDateDaysFromNow(-1800),
  license_expiry_date: isoDateDaysFromNow(1000),
  is_published: true,
  status: "approved",
  commission_rate: 14,
  created_date: isoDateDaysFromNow(-250),
  agreements: [
    { id: generateId("agr"), provider_id: "prov_5", layer: "K", kupah_list: ["כללית", "מאוחדת", "לאומית"] },
    { id: generateId("agr"), provider_id: "prov_5", layer: "B", insurance_companies: ["כלל ביטוח", "הראל ביטוח"] },
    { id: generateId("agr"), provider_id: "prov_5", layer: "H" },
  ],
  private_insurance_companies: ["כלל ביטוח", "הראל ביטוח"],
  consultation_types: [
    {
      id: provider5ConsultId,
      name: "ייעוץ גסטרואנטרולוגי",
      duration_minutes: 30,
      prices: [
        { layer: "K", price: 150 },
        { layer: "B", price: 70 },
        { layer: "H", price: 550 },
      ],
      price_full: 480,
      service_type: "consultation",
      linked_clinic_ids: [provider5ClinicId],
    },
    // The bio says "מומחית לגסטרואנטרולוגיה ואנדוסקופיה" — so the two endoscopic
    // procedures a gastroenterologist is actually booked for belong here.
    {
      id: provider5GastroId,
      name: "גסטרוסקופיה אבחנתית",
      duration_minutes: 30,
      prices: [
        { layer: "K", price: 450 },
        { layer: "B", price: 200 },
        { layer: "H", price: 1730 },
      ],
      price_full: 1500,
      service_type: "procedure",
      moh_code: "31020",
      linked_clinic_ids: [provider5ClinicId],
      requires_referral: true,
      anesthesia_type: "sedation",
      required_documents: [{ id: generateId("reqdoc"), label: "בדיקות דם (ספירה ותפקודי קרישה)" }],
    },
    {
      id: provider5ColonoId,
      name: "קולונוסקופיה אבחנתית",
      duration_minutes: 45,
      prices: [
        { layer: "K", price: 650 },
        { layer: "B", price: 300 },
        { layer: "H", price: 2530 },
      ],
      price_full: 2200,
      service_type: "procedure",
      moh_code: "31010",
      linked_clinic_ids: [provider5ClinicId],
      requires_referral: true,
      anesthesia_type: "sedation",
      requires_fasting: true,
      required_documents: [{ id: generateId("reqdoc"), label: "בדיקות דם (ספירה ותפקודי קרישה)" }],
    },
  ],
  exam_types: [],
  // Consultation clinic in the morning, endoscopy list in the afternoon — the
  // way every gastroenterology practice actually runs, and the only way a
  // 45-minute colonoscopy and a 30-minute consultation can share one week.
  clinic_locations: [
    clinicWithSchedule({
      id: provider5ClinicId,
      name: "מרפאת עיכול חיפה",
      address: "הנמל 22",
      city: "חיפה",
      phone: "04-8551234",
      is_primary: true,
      location_type: "clinic",
      schedule: weekly({
        sunday: [
          shift("sh_p5_sun", "09:00", "14:00", {
            label: "מרפאת בוקר",
            slot_minutes: 30,
            service_ids: [provider5ConsultId],
          }),
        ],
        monday: [
          shift("sh_p5_mon_am", "09:00", "13:00", {
            label: "מרפאת בוקר",
            slot_minutes: 30,
            service_ids: [provider5ConsultId],
          }),
          shift("sh_p5_mon_pm", "14:00", "18:00", {
            label: "רשימת אנדוסקופיות",
            slot_minutes: 45,
            service_ids: [provider5GastroId, provider5ColonoId],
          }),
        ],
        tuesday: [
          shift("sh_p5_tue", "09:00", "15:00", {
            label: "מרפאת בוקר",
            slot_minutes: 30,
            service_ids: [provider5ConsultId],
          }),
        ],
        wednesday: [
          shift("sh_p5_wed_am", "09:00", "13:00", {
            label: "מרפאת בוקר",
            slot_minutes: 30,
            service_ids: [provider5ConsultId],
          }),
          shift("sh_p5_wed_pm", "14:00", "18:00", {
            label: "רשימת אנדוסקופיות",
            slot_minutes: 45,
            service_ids: [provider5GastroId, provider5ColonoId],
          }),
        ],
        thursday: [
          shift("sh_p5_thu", "09:00", "15:00", {
            label: "מרפאת בוקר",
            slot_minutes: 30,
            service_ids: [provider5ConsultId],
          }),
        ],
      }),
    }),
  ],
  referral_forms: [],
};

// Published private-pay-only provider (§7.1) — no S/K/B agreement declared
// at all, so no patient sees an arrangement or a reimbursement note here,
// regardless of what insurance they hold.
const provider6ClinicId = generateId("clinic");
const provider6ConsultId = "ct_p6_consult";
const provider6OctId = "ct_p6_oct";
const provider6CataractId = "ct_p6_cataract";

const provider6: ProviderProfile = {
  id: "prov_6",
  display_name: "ד\"ר יובל שרון",
  title: "ד\"ר",
  specialty: "רפואת עיניים",
  sub_specialties: ["ניתוחי קטרקט", "טיפולי לייזר"],
  bio: "רופא עיניים בכיר המתמחה בניתוחי קטרקט ובטיפול לייזר, עובד באופן פרטי בלבד.",
  languages: ["עברית", "אנגלית"],
  rating: 4.9,
  review_count: 87,
  license_number: "MD-58821",
  license_issuer: "משרד הבריאות",
  license_issue_date: isoDateDaysFromNow(-2200),
  license_expiry_date: isoDateDaysFromNow(1200),
  is_published: true,
  status: "approved",
  commission_rate: 15,
  created_date: isoDateDaysFromNow(-180),
  agreements: [{ id: generateId("agr"), provider_id: "prov_6", layer: "H" }],
  consultation_types: [
    {
      id: provider6ConsultId,
      name: "ייעוץ רפואת עיניים",
      duration_minutes: 20,
      prices: [{ layer: "H", price: 450 }],
      price_full: 390,
      service_type: "consultation",
      linked_clinic_ids: [provider6ClinicId],
    },
    // The bio promises cataract surgery and laser work — a private-only
    // ophthalmologist's catalogue is the pre-op imaging plus the operation.
    {
      id: provider6OctId,
      name: "בדיקת OCT — טומוגרפיה של הרשתית",
      duration_minutes: 20,
      prices: [{ layer: "H", price: 520 }],
      price_full: 450,
      service_type: "imaging",
      moh_code: "52050",
      linked_clinic_ids: [provider6ClinicId],
    },
    {
      id: provider6CataractId,
      name: "ניתוח קטרקט עם השתלת עדשה",
      duration_minutes: 45,
      prices: [{ layer: "H", price: 15530 }],
      price_full: 13500,
      service_type: "surgery",
      moh_code: "43010",
      linked_clinic_ids: [provider6ClinicId],
      anesthesia_type: "local",
      recovery_days: 7,
      requires_hospital: true,
      required_documents: [
        { id: generateId("reqdoc"), label: "בדיקת ביומטריה לחישוב עדשה" },
        { id: generateId("reqdoc"), label: "אישור כשירות לניתוח" },
      ],
    },
  ],
  exam_types: [],
  // Clinic days plus one weekly operating list — a cataract surgeon's week.
  clinic_locations: [
    clinicWithSchedule({
      id: provider6ClinicId,
      name: "מרפאת עיניים הרצליה",
      address: "סוקולוב 10",
      city: "הרצליה",
      phone: "09-9551234",
      is_primary: true,
      location_type: "clinic",
      schedule: weekly({
        sunday: [
          shift("sh_p6_sun", "08:30", "16:30", {
            label: "מרפאה",
            slot_minutes: 20,
            service_ids: [provider6ConsultId, provider6OctId],
            breaks: [{ id: "br_p6_sun", start: "12:30", end: "13:00", label: "הפסקת צהריים" }],
          }),
        ],
        monday: [
          shift("sh_p6_mon", "08:30", "16:30", {
            label: "מרפאה",
            slot_minutes: 20,
            service_ids: [provider6ConsultId, provider6OctId],
          }),
        ],
        tuesday: [
          shift("sh_p6_tue", "08:00", "14:00", {
            label: "יום ניתוחים — קטרקט",
            slot_minutes: 45,
            service_ids: [provider6CataractId],
          }),
        ],
        wednesday: [
          shift("sh_p6_wed", "08:30", "16:30", {
            label: "מרפאה",
            slot_minutes: 20,
            service_ids: [provider6ConsultId, provider6OctId],
          }),
        ],
        thursday: [
          shift("sh_p6_thu", "08:30", "16:30", {
            label: "מרפאה",
            slot_minutes: 20,
            service_ids: [provider6ConsultId, provider6OctId],
          }),
        ],
      }),
    }),
  ],
  referral_forms: [],
};

// ---------------------------------------------------------------------------
// The reference examples the payments meeting asked every wireframe to use
// (§9): a high-value specialist CONSULTATION with a doctor — never an
// examination — priced at ₪2,000 with a ₪400 deposit under the percentage rule,
// plus its ₪1,200 follow-up. Imaging and lab work belong to a מכון (see
// providerInstitute below); a doctor sells opinions and in-clinic procedures.
// ---------------------------------------------------------------------------
const provider7ClinicId = generateId("clinic");
const provider7ConsultId = "ct_p7_consult";
const provider7FollowUpId = "ct_p7_followup";

const provider7: ProviderProfile = {
  id: "prov_7",
  provider_type: "doctor",
  user_id: DEMO_NEURO_USER.id,
  display_name: "ד\"ר יערה בן-דוד",
  title: "ד\"ר",
  specialty: "נוירולוגיה",
  sub_specialties: ["נוירולוגיית ילדים", "אפילפסיה בילדים"],
  bio: "נוירולוגית ילדים בכירה, מתמחה באפילפסיה, עיכובים התפתחותיים והפרעות תנועה בגיל הרך.",
  languages: ["עברית", "אנגלית", "רוסית"],
  rating: 4.9,
  review_count: 64,
  license_number: "MD-70455",
  license_issuer: "משרד הבריאות",
  license_issue_date: isoDateDaysFromNow(-2600),
  license_expiry_date: isoDateDaysFromNow(900),
  doctor_subtype: "physician",
  is_published: true,
  status: "approved",
  commission_rate: 20,
  created_date: isoDateDaysFromNow(-150),
  agreements: [
    { id: generateId("agr"), provider_id: "prov_7", layer: "K", kupah_list: ["כללית", "מכבי"] },
    { id: generateId("agr"), provider_id: "prov_7", layer: "B", insurance_companies: ["הראל ביטוח", "מגדל ביטוח"] },
    { id: generateId("agr"), provider_id: "prov_7", layer: "H" },
  ],
  kupah_arrangements: [
    { kupah: "כללית", level: "כללית פלטינום" },
    { kupah: "מכבי", level: "מכבי שלי" },
  ],
  private_insurance_companies: ["הראל ביטוח", "מגדל ביטוח"],
  consultation_types: [
    {
      id: provider7ConsultId,
      name: "ייעוץ נוירולוגיית ילדים",
      duration_minutes: 45,
      prices: [
        { layer: "K", price: 340 },
        { layer: "B", price: 180 },
        { layer: "H", price: 2000 },
      ],
      price_full: 2000,
      service_type: "consultation",
      linked_clinic_ids: [provider7ClinicId],
    },
    {
      id: provider7FollowUpId,
      name: "ייעוץ חוזר — נוירולוגיית ילדים",
      duration_minutes: 25,
      prices: [
        { layer: "K", price: 200 },
        { layer: "B", price: 110 },
        { layer: "H", price: 1200 },
      ],
      price_full: 1200,
      service_type: "consultation",
      linked_clinic_ids: [provider7ClinicId],
    },
  ],
  exam_types: [],
  clinic_locations: [
    clinicWithSchedule({
      id: provider7ClinicId,
      name: "מרפאת נוירולוגיית ילדים רעננה",
      address: "אחוזה 108",
      city: "רעננה",
      phone: "09-7712340",
      is_primary: true,
      location_type: "clinic",
      schedule: weekly({
        sunday: [
          shift("sh_p7_sun", "09:00", "15:00", {
            label: "מרפאת ייעוצים",
            slot_minutes: 45,
            service_ids: [provider7ConsultId],
          }),
        ],
        tuesday: [
          shift("sh_p7_tue_am", "09:00", "13:00", {
            label: "מרפאת ייעוצים",
            slot_minutes: 45,
            service_ids: [provider7ConsultId],
          }),
          shift("sh_p7_tue_pm", "14:00", "17:00", {
            label: "מרפאת מעקב",
            slot_minutes: 25,
            service_ids: [provider7FollowUpId],
          }),
        ],
        thursday: [
          shift("sh_p7_thu", "09:00", "14:00", {
            label: "מרפאת מעקב",
            slot_minutes: 25,
            service_ids: [provider7FollowUpId],
          }),
        ],
      }),
    }),
  ],
  referral_forms: [],
};

// ---------------------------------------------------------------------------
// Organization demo accounts (§PRV-07) — a מכון רפואי and a מרפאת חוץ, both
// live, so the "כניסה מאובטחת של ספק" demo can show a medical *unit* portal
// (affiliated doctors, a per-type service catalogue, a real multi-shift
// weekly schedule) next to the single-practitioner portal (ד"ר אבי לוי).
// ---------------------------------------------------------------------------

/** Builds a Clinic with the shift-based schedule as the source of truth,
 * deriving the legacy `hours` mirror so anything still reading it stays
 * truthful (see src/lib/schedule.ts). */
function clinicWithSchedule(
  clinic: Omit<Clinic, "hours" | "schedule"> & { schedule: WeeklySchedule }
): Clinic {
  return { ...clinic, hours: scheduleToLegacyHours(clinic.schedule) };
}

function shift(id: string, start: string, end: string, extra: Partial<ScheduleShift> = {}): ScheduleShift {
  return { id, start, end, ...extra };
}

/** A week with only the working days spelled out. */
function weekly(days: Partial<WeeklySchedule>): WeeklySchedule {
  return { ...emptyWeeklySchedule(), ...days };
}

// A medical unit is a single site — the unit IS the branch (§PRV-08), so there
// is exactly one clinic record here, and the parallel queues are the מתקנים and
// the doctors below.
const instituteClinicId = "clinic_institute_1";
const instituteServiceIds = {
  mriSpine: "ct_inst_mri",
  mriHead: "ct_inst_mri_head",
  ctAbdomen: "ct_inst_ct",
  ctChest: "ct_inst_ct_chest",
  usAbdomen: "ct_inst_us_abdomen",
  biopsy: "ct_inst_biopsy",
  colono: "ct_inst_colono",
  homeBlood: "ct_inst_home_blood",
  surgeonPick: "ct_inst_surgeon",
};

// Doctors employed by the institute — real doctor records in the platform
// (never duplicated: an organization that adds a doctor who already exists
// links the existing record instead — see linkExistingDoctorToOrganization).
const instituteDoctor1: ProviderProfile = {
  id: "prov_inst_doc_1",
  provider_type: "doctor",
  display_name: "ד\"ר שרון גלעד",
  title: "ד\"ר",
  specialty: "רדיולוגיה",
  sub_specialties: ["CT ו-MRI", "רדיולוגיה התערבותית"],
  license_number: "MD-77410",
  contact_phone: "052-4410099",
  contact_email: "sharon.gilad@asuta-demo.co.il",
  doctor_subtype: "physician",
  is_published: false,
  status: "approved",
  organization_provider_ids: ["prov_institute"],
  agreements: [],
  consultation_types: [],
  exam_types: [],
  clinic_locations: [],
  referral_forms: [],
  created_date: isoDateDaysFromNow(-240),
};

const instituteDoctor2: ProviderProfile = {
  id: "prov_inst_doc_2",
  provider_type: "doctor",
  display_name: "ד\"ר עומר נבו",
  title: "ד\"ר",
  specialty: "כירורגיה כללית",
  sub_specialties: ["כירורגיה זעיר פולשנית", "כירורגיית בטן"],
  license_number: "MD-77522",
  contact_phone: "052-4410100",
  contact_email: "omer.navo@asuta-demo.co.il",
  doctor_subtype: "surgeon",
  surgical_privileges_hospital: "מרכז רפואי הדסה",
  is_published: false,
  status: "approved",
  organization_provider_ids: ["prov_institute"],
  agreements: [],
  consultation_types: [],
  exam_types: [],
  clinic_locations: [],
  referral_forms: [],
  created_date: isoDateDaysFromNow(-230),
};

const providerInstitute: ProviderProfile = {
  id: "prov_institute",
  provider_type: "medical_institute",
  user_id: DEMO_INSTITUTE_USER.id,
  display_name: "מכון רפואי הדסה",
  contact_name: "רונית אלמוג",
  contact_phone: "02-5559090",
  contact_email: "info@hadassah-demo.co.il",
  business_reg_number: "514882301",
  // A מכון רפואי sells procedures, not clinic visits: imaging, invasive
  // diagnostics, elective surgery and home sampling. Consultations are the
  // מרפאת חוץ's product (providerOutpatient) — keeping the two catalogues
  // distinct is what makes the demo read correctly to a clinician.
  specialty: "הדמיה, בדיקות, פעולות וניתוחים",
  bio: "מכון רפואי המשלב הדמיה מתקדמת, פעולות פולשניות קלות וניתוחים אלקטיביים, כולל שירותי בדיקות עד הבית.",
  license_number: "INST-2201",
  license_issuer: "משרד הבריאות",
  rating: 4.7,
  review_count: 431,
  is_published: true,
  status: "approved",
  commission_rate: 11,
  location_count: 1,
  created_date: isoDateDaysFromNow(-260),
  agreements: [
    { id: generateId("agr"), provider_id: "prov_institute", layer: "K", kupah_list: ["מכבי", "כללית"] },
    { id: generateId("agr"), provider_id: "prov_institute", layer: "B", insurance_companies: ["הראל ביטוח", "מגדל ביטוח"] },
    { id: generateId("agr"), provider_id: "prov_institute", layer: "H" },
  ],
  kupah_arrangements: [
    { kupah: "מכבי", level: "מכבי כסף" },
    { kupah: "כללית", level: "כללית פלטינום" },
  ],
  private_insurance_companies: ["הראל ביטוח", "מגדל ביטוח"],
  consultation_types: [
    {
      id: instituteServiceIds.mriSpine,
      name: "MRI עמוד שדרה מותני",
      duration_minutes: 45,
      prices: [
        { layer: "K", price: 390 },
        { layer: "H", price: 1670 },
      ],
      price_full: 1450,
      service_type: "imaging",
      service_category: "בדיקות",
      moh_code: "54021",
      linked_clinic_ids: [instituteClinicId],
      requires_referral: true,
    },
    {
      id: instituteServiceIds.mriHead,
      name: "MRI ראש ללא חומר ניגוד",
      duration_minutes: 40,
      prices: [
        { layer: "K", price: 410 },
        { layer: "H", price: 1750 },
      ],
      price_full: 1520,
      service_type: "imaging",
      service_category: "בדיקות",
      moh_code: "54010",
      linked_clinic_ids: [instituteClinicId],
      requires_referral: true,
    },
    {
      id: instituteServiceIds.ctAbdomen,
      name: "CT בטן ואגן עם חומר ניגוד",
      duration_minutes: 30,
      prices: [
        { layer: "K", price: 320 },
        { layer: "H", price: 1270 },
      ],
      price_full: 1100,
      service_type: "imaging",
      service_category: "בדיקות",
      moh_code: "53020",
      linked_clinic_ids: [instituteClinicId],
      requires_contrast: true,
      has_radiation: true,
    },
    {
      id: instituteServiceIds.ctChest,
      name: "CT חזה",
      duration_minutes: 20,
      prices: [
        { layer: "K", price: 280 },
        { layer: "H", price: 1090 },
      ],
      price_full: 950,
      service_type: "imaging",
      service_category: "בדיקות",
      moh_code: "53030",
      linked_clinic_ids: [instituteClinicId],
      has_radiation: true,
    },
    {
      id: instituteServiceIds.usAbdomen,
      name: "אולטרסאונד בטן שלמה",
      duration_minutes: 25,
      prices: [
        { layer: "K", price: 150 },
        { layer: "H", price: 550 },
      ],
      price_full: 480,
      service_type: "imaging",
      service_category: "בדיקות",
      moh_code: "52010",
      linked_clinic_ids: [instituteClinicId],
      requires_fasting: true,
    },
    {
      // The radiologist's own procedure — an image-guided biopsy is what an
      // interventional radiologist is booked for, and it is the institute's
      // answer to "what does a doctor here actually do", instead of a
      // consultation a מכון doesn't sell.
      id: instituteServiceIds.biopsy,
      name: "ביופסיה מונחית אולטרסאונד",
      duration_minutes: 40,
      prices: [
        { layer: "K", price: 480 },
        { layer: "H", price: 2010 },
      ],
      price_full: 1750,
      service_type: "procedure",
      service_category: "פעולות",
      moh_code: "31030",
      linked_clinic_ids: [instituteClinicId],
      requires_referral: true,
      anesthesia_type: "local",
      required_documents: [
        { id: generateId("reqdoc"), label: "הפניה עם שאלה קלינית" },
        { id: generateId("reqdoc"), label: "בדיקת תפקודי קרישה" },
      ],
    },
    {
      id: instituteServiceIds.colono,
      name: "קולונוסקופיה בהרדמה",
      duration_minutes: 60,
      prices: [
        { layer: "K", price: 650 },
        { layer: "H", price: 2760 },
      ],
      price_full: 2400,
      service_type: "procedure",
      service_category: "פעולות",
      moh_code: "31010",
      linked_clinic_ids: [instituteClinicId],
      anesthesia_type: "sedation",
      requires_referral: true,
    },
    {
      id: instituteServiceIds.homeBlood,
      name: "בדיקות דם עד הבית",
      duration_minutes: 20,
      prices: [
        { layer: "K", price: 90 },
        { layer: "H", price: 300 },
      ],
      price_full: 260,
      service_type: "test",
      service_category: "בדיקות עד הבית",
      moh_code: "20010",
      linked_clinic_ids: [instituteClinicId],
      requires_fasting: true,
      sample_type: "דם ורידי",
    },
    {
      id: instituteServiceIds.surgeonPick,
      name: "בחירת מנתח — ניתוח בקע",
      duration_minutes: 90,
      prices: [{ layer: "H", price: 16680 }],
      price_full: 14500,
      service_type: "surgery",
      service_category: "בחירת מנתח",
      moh_code: "41010",
      linked_clinic_ids: [instituteClinicId],
      anesthesia_type: "general",
      recovery_days: 14,
      requires_hospital: true,
      required_documents: [
        { id: generateId("reqdoc"), label: "הפניה כירורגית" },
        { id: generateId("reqdoc"), label: "אישור כשירות לניתוח" },
      ],
    },
  ],
  exam_types: [],
  // One record — the unit itself. Its week is the unit's OPENING hours
  // ("זמינות כללית"), shown to patients and used as a fallback for services not
  // yet linked to a resource; the real queues live on the facilities/doctors.
  clinic_locations: [
    clinicWithSchedule({
      id: instituteClinicId,
      name: "מכון רפואי הדסה",
      address: "הזית 8, עין כרם",
      city: "ירושלים",
      phone: "02-5559090",
      is_primary: true,
      location_type: "clinic",
      schedule: weekly({
        sunday: [shift("sh_inst_sun", "07:00", "19:00", { label: "שעות פעילות", slot_minutes: 30 })],
        monday: [shift("sh_inst_mon", "07:00", "19:00", { label: "שעות פעילות", slot_minutes: 30 })],
        tuesday: [shift("sh_inst_tue", "07:00", "15:00", { label: "שעות פעילות", slot_minutes: 30 })],
        wednesday: [shift("sh_inst_wed", "07:00", "19:00", { label: "שעות פעילות", slot_minutes: 30 })],
        thursday: [shift("sh_inst_thu", "07:00", "18:00", { label: "שעות פעילות", slot_minutes: 30 })],
        friday: [shift("sh_inst_fri", "07:00", "11:30", { label: "בוקר מקוצר", slot_minutes: 30 })],
      }),
      schedule_exceptions: [
        {
          id: "exc_inst_1",
          date: isoDateDaysFromNow(9),
          closed: true,
          reason: "יום היערכות ותחזוקת מכשור",
        },
        {
          id: "exc_inst_2",
          date: isoDateDaysFromNow(16),
          closed: false,
          reason: "ערב חג — פעילות מקוצרת",
          shifts: [shift("sh_inst_exc", "07:00", "12:00", { slot_minutes: 30 })],
        },
      ],
    }),
  ],
  // The unit's parallel queues (§PRV-08): MRI 1 and CT 1 can both scan at
  // 08:00, and the procedure room runs independently of both.
  facilities: [
    {
      id: "fac_inst_mri_1",
      name: "MRI 1",
      kind: "mri",
      model: "Siemens Magnetom Vida 3T",
      room: "חדר 4, קומה -1",
      service_array: "מערך MRI",
      capacity: 2,
      is_active: true,
      service_ids: [instituteServiceIds.mriSpine, instituteServiceIds.mriHead],
      created_at: isoDateDaysFromNow(-255),
      schedule: weekly({
        sunday: [
          shift("sh_mri1_sun", "07:00", "15:00", {
            label: "משמרת הדמיה",
            slot_minutes: 45,
            breaks: [{ id: "br_mri1_sun", start: "11:00", end: "11:30", label: "כיול ותחזוקה" }],
          }),
        ],
        monday: [shift("sh_mri1_mon", "07:00", "15:00", { label: "משמרת הדמיה", slot_minutes: 45 })],
        tuesday: [shift("sh_mri1_tue", "07:00", "13:00", { label: "משמרת בוקר", slot_minutes: 45 })],
        wednesday: [shift("sh_mri1_wed", "07:00", "15:00", { label: "משמרת הדמיה", slot_minutes: 45 })],
        thursday: [
          shift("sh_mri1_thu_am", "07:00", "13:00", { label: "משמרת בוקר", slot_minutes: 45 }),
          // Evening shift on this machine is head-scans only — per-shift service
          // scoping inside a single facility.
          shift("sh_mri1_thu_pm", "16:00", "19:00", {
            label: "משמרת ערב — MRI ראש",
            slot_minutes: 40,
            service_ids: [instituteServiceIds.mriHead],
          }),
        ],
      }),
    },
    {
      id: "fac_inst_ct_1",
      name: "CT 1",
      kind: "ct",
      model: "GE Revolution CT",
      room: "חדר 6, קומה -1",
      service_array: "מערך CT",
      is_active: true,
      service_ids: [instituteServiceIds.ctAbdomen, instituteServiceIds.ctChest],
      created_at: isoDateDaysFromNow(-255),
      schedule: weekly({
        sunday: [shift("sh_ct1_sun", "07:00", "17:00", { label: "משמרת CT", slot_minutes: 30 })],
        monday: [shift("sh_ct1_mon", "07:00", "17:00", { label: "משמרת CT", slot_minutes: 30 })],
        tuesday: [shift("sh_ct1_tue", "07:00", "15:00", { label: "משמרת CT", slot_minutes: 30 })],
        wednesday: [shift("sh_ct1_wed", "07:00", "17:00", { label: "משמרת CT", slot_minutes: 30 })],
        thursday: [shift("sh_ct1_thu", "07:00", "15:00", { label: "משמרת CT", slot_minutes: 30 })],
        friday: [shift("sh_ct1_fri", "07:00", "11:00", { label: "בוקר מקוצר", slot_minutes: 30 })],
      }),
      schedule_exceptions: [
        {
          id: "exc_ct1_1",
          date: isoDateDaysFromNow(4),
          closed: true,
          reason: "תחזוקה יזומה של המכשיר",
        },
      ],
    },
    {
      id: "fac_inst_us_1",
      name: "אולטרסאונד 1",
      kind: "ultrasound",
      model: "GE Logiq E10",
      room: "חדר 2, קומת כניסה",
      service_array: "מערך אולטרסאונד",
      is_active: true,
      // The plain scan runs on the machine with a technician; the guided biopsy
      // is booked against the radiologist below, because HE is the scarce
      // resource for it — not the room.
      service_ids: [instituteServiceIds.usAbdomen],
      created_at: isoDateDaysFromNow(-250),
      schedule: weekly({
        sunday: [shift("sh_us1_sun", "08:00", "15:00", { label: "משמרת אולטרסאונד", slot_minutes: 25 })],
        monday: [shift("sh_us1_mon", "08:00", "15:00", { label: "משמרת אולטרסאונד", slot_minutes: 25 })],
        tuesday: [shift("sh_us1_tue", "08:00", "13:00", { label: "משמרת בוקר", slot_minutes: 25 })],
        wednesday: [shift("sh_us1_wed", "08:00", "15:00", { label: "משמרת אולטרסאונד", slot_minutes: 25 })],
        thursday: [shift("sh_us1_thu", "08:00", "15:00", { label: "משמרת אולטרסאונד", slot_minutes: 25 })],
      }),
    },
    {
      id: "fac_inst_proc_1",
      name: "חדר פעולות 1",
      kind: "procedure_room",
      room: "קומה 1",
      service_array: "מערך פעולות",
      is_active: true,
      service_ids: [instituteServiceIds.colono],
      created_at: isoDateDaysFromNow(-250),
      schedule: weekly({
        sunday: [shift("sh_proc1_sun", "15:00", "19:00", { label: "משמרת פעולות", slot_minutes: 60 })],
        monday: [shift("sh_proc1_mon", "15:00", "19:00", { label: "משמרת פעולות", slot_minutes: 60 })],
        thursday: [shift("sh_proc1_thu", "15:00", "18:00", { label: "משמרת פעולות", slot_minutes: 60 })],
      }),
    },
  ],
  referral_forms: [],
  affiliated_doctors: [
    {
      id: "affdoc_inst_1",
      doctor_provider_id: instituteDoctor1.id,
      role: "מנהל היחידה להדמיה",
      service_array: "מערך אולטרסאונד",
      // Doctor-delivered work hangs off the doctor's own calendar rather than
      // off a machine — here that's the image-guided biopsy, the procedure an
      // interventional radiologist personally performs.
      service_ids: [instituteServiceIds.biopsy],
      clinic_ids: [instituteClinicId],
      added_at: isoDateDaysFromNow(-240),
      schedule: weekly({
        sunday: [shift("sh_doc1_sun", "09:00", "13:00", { label: "פעולות מונחות דימות", slot_minutes: 40 })],
        tuesday: [shift("sh_doc1_tue", "09:00", "12:00", { label: "פעולות מונחות דימות", slot_minutes: 40 })],
        wednesday: [shift("sh_doc1_wed", "09:00", "13:00", { label: "פעולות מונחות דימות", slot_minutes: 40 })],
      }),
    },
    {
      id: "affdoc_inst_2",
      doctor_provider_id: instituteDoctor2.id,
      role: "מנתח בכיר",
      service_array: "מערך פעולות",
      service_ids: [instituteServiceIds.colono, instituteServiceIds.surgeonPick],
      clinic_ids: [instituteClinicId],
      added_at: isoDateDaysFromNow(-230),
      schedule: weekly({
        sunday: [shift("sh_doc2_sun", "15:00", "19:00", { label: "פעולות וניתוחים", slot_minutes: 60 })],
        monday: [shift("sh_doc2_mon", "15:00", "19:00", { label: "פעולות וניתוחים", slot_minutes: 60 })],
        thursday: [shift("sh_doc2_thu", "15:00", "18:00", { label: "פעולות", slot_minutes: 60 })],
      }),
    },
  ],
};

const outpatientClinicId = "clinic_outpatient_1";
const outpatientServiceIds = {
  consult: "ct_out_consult",
  followUp: "ct_out_followup",
  secondOpinion: "ct_out_second_opinion",
  // Specialist clinics are what a מרפאת חוץ IS — each one delivered by the
  // matching specialist below, never by whoever happens to be affiliated.
  cardioConsult: "ct_out_cardio_consult",
  orthoConsult: "ct_out_ortho_consult",
  diagnostics: "ct_out_diagnostics",
  tests: "ct_out_tests",
  treatments: "ct_out_treatments",
};

const outpatientDoctor1: ProviderProfile = {
  id: "prov_out_doc_1",
  provider_type: "doctor",
  display_name: "ד\"ר תמר אביב",
  title: "ד\"ר",
  specialty: "רפואת משפחה",
  sub_specialties: ["רפואה מונעת", "ניהול מחלות כרוניות"],
  license_number: "MD-81244",
  contact_phone: "053-7710022",
  contact_email: "tamar.aviv@hadassah-demo.co.il",
  doctor_subtype: "physician",
  is_published: false,
  status: "approved",
  organization_provider_ids: ["prov_outpatient"],
  agreements: [],
  consultation_types: [],
  exam_types: [],
  clinic_locations: [],
  referral_forms: [],
  created_date: isoDateDaysFromNow(-200),
};

const providerOutpatient: ProviderProfile = {
  id: "prov_outpatient",
  provider_type: "outpatient_clinic",
  user_id: DEMO_OUTPATIENT_USER.id,
  display_name: "מרפאות חוץ הדסה קהילה",
  contact_name: "אורי בן-חיים",
  contact_phone: "02-5558080",
  contact_email: "clinic@hadassah-demo.co.il",
  business_reg_number: "513990877",
  specialty: "ייעוץ, בדיקות, טיפולים",
  bio: "רשת מרפאות חוץ קהילתיות הפועלת תחת ארגון רפואי, המספקת ייעוצים, אבחונים, בדיקות וטיפולים.",
  license_number: "CLN-4410",
  license_issuer: "משרד הבריאות",
  rating: 4.6,
  review_count: 298,
  is_published: true,
  status: "approved",
  commission_rate: 12,
  // This unit collects the balance at its own counter (payments meeting §5) —
  // the מכון opposite it keeps the Healson default, so the demo shows both.
  balance_collector: "unit",
  location_count: 1,
  created_date: isoDateDaysFromNow(-210),
  agreements: [
    { id: generateId("agr"), provider_id: "prov_outpatient", layer: "S", kupah_list: ["כללית", "מכבי", "מאוחדת", "לאומית"] },
    { id: generateId("agr"), provider_id: "prov_outpatient", layer: "K" },
    { id: generateId("agr"), provider_id: "prov_outpatient", layer: "H" },
  ],
  kupah_arrangements: [
    { kupah: "כללית", level: "כללית מושלם" },
    { kupah: "מאוחדת", level: "מאוחדת עדיף" },
  ],
  consultation_types: [
    {
      id: outpatientServiceIds.consult,
      name: "ייעוץ רפואת משפחה",
      duration_minutes: 20,
      prices: [
        { layer: "S", price: 0 },
        { layer: "K", price: 90 },
        { layer: "H", price: 370 },
      ],
      price_full: 320,
      service_type: "consultation",
      service_category: "ייעוץ",
      linked_clinic_ids: [outpatientClinicId],
    },
    {
      id: outpatientServiceIds.followUp,
      name: "ייעוץ חוזר",
      duration_minutes: 15,
      prices: [
        { layer: "K", price: 60 },
        { layer: "H", price: 240 },
      ],
      price_full: 210,
      service_type: "consultation",
      service_category: "ייעוץ חוזר",
      linked_clinic_ids: [outpatientClinicId],
    },
    {
      id: outpatientServiceIds.secondOpinion,
      name: "חוות דעת נוספת",
      duration_minutes: 30,
      prices: [{ layer: "H", price: 550 }],
      price_full: 480,
      service_type: "consultation",
      service_category: "חוות דעת נוספת",
      linked_clinic_ids: [outpatientClinicId],
    },
    {
      id: outpatientServiceIds.cardioConsult,
      name: "ייעוץ קרדיולוגי",
      duration_minutes: 30,
      prices: [
        { layer: "S", price: 0 },
        { layer: "K", price: 140 },
        { layer: "H", price: 520 },
      ],
      price_full: 450,
      service_type: "consultation",
      service_category: "ייעוץ",
      linked_clinic_ids: [outpatientClinicId],
      requires_referral: true,
    },
    {
      id: outpatientServiceIds.orthoConsult,
      name: "ייעוץ אורתופדי",
      duration_minutes: 20,
      prices: [
        { layer: "S", price: 0 },
        { layer: "K", price: 130 },
        { layer: "H", price: 500 },
      ],
      price_full: 430,
      service_type: "consultation",
      service_category: "ייעוץ",
      linked_clinic_ids: [outpatientClinicId],
      requires_referral: true,
    },
    {
      id: outpatientServiceIds.diagnostics,
      // Named exactly as the MOH code book names it (21040), so the same test
      // is called the same thing at every provider on the platform.
      name: "מבחן מאמץ לבבי (ארגומטריה)",
      duration_minutes: 45,
      prices: [
        { layer: "K", price: 180 },
        { layer: "H", price: 710 },
      ],
      price_full: 620,
      service_type: "test",
      service_category: "אבחונים",
      moh_code: "21040",
      linked_clinic_ids: [outpatientClinicId],
      requires_referral: true,
    },
    {
      id: outpatientServiceIds.tests,
      name: "בדיקות דם שגרתיות",
      duration_minutes: 10,
      prices: [
        { layer: "S", price: 0 },
        { layer: "H", price: 170 },
      ],
      price_full: 150,
      service_type: "test",
      service_category: "בדיקות",
      moh_code: "20010",
      linked_clinic_ids: [outpatientClinicId],
      requires_fasting: true,
    },
    {
      id: outpatientServiceIds.treatments,
      name: "טיפול בפצע כרוני",
      duration_minutes: 30,
      prices: [
        { layer: "K", price: 120 },
        { layer: "H", price: 440 },
      ],
      price_full: 380,
      service_type: "treatment",
      service_category: "טיפולים",
      linked_clinic_ids: [outpatientClinicId],
    },
  ],
  exam_types: [],
  clinic_locations: [
    clinicWithSchedule({
      id: outpatientClinicId,
      // A unit's site carries the unit's own name — no second name (§PRV-08).
      name: "מרפאות חוץ הדסה קהילה",
      address: "יפו 210",
      city: "ירושלים",
      phone: "02-5558080",
      is_primary: true,
      location_type: "clinic",
      schedule: {
        sunday: [
          shift("sh_out_sun_am", "08:00", "12:30", {
            label: "מרפאת בוקר",
            slot_minutes: 20,
            service_ids: [outpatientServiceIds.consult, outpatientServiceIds.followUp, outpatientServiceIds.tests],
          }),
          shift("sh_out_sun_pm", "16:00", "20:00", {
            label: "מרפאת ערב",
            slot_minutes: 20,
            breaks: [{ id: "br_out_sun", start: "18:00", end: "18:20", label: "הפסקה" }],
          }),
        ],
        monday: [
          shift("sh_out_mon_am", "08:00", "12:30", { label: "מרפאת בוקר", slot_minutes: 20 }),
        ],
        tuesday: [
          shift("sh_out_tue_am", "08:00", "12:30", { label: "מרפאת בוקר", slot_minutes: 20 }),
          shift("sh_out_tue_pm", "16:00", "20:00", {
            label: "מרפאת ערב — אבחונים",
            slot_minutes: 45,
            service_ids: [outpatientServiceIds.diagnostics, outpatientServiceIds.treatments],
          }),
        ],
        wednesday: [shift("sh_out_wed", "08:00", "15:00", { label: "יום רציף", slot_minutes: 20 })],
        thursday: [
          shift("sh_out_thu_am", "08:00", "12:30", { label: "מרפאת בוקר", slot_minutes: 20 }),
        ],
        friday: [shift("sh_out_fri", "08:00", "11:00", { label: "בוקר מקוצר", slot_minutes: 20 })],
        saturday: [],
      },
      schedule_exceptions: [
        { id: "exc_out_1", date: isoDateDaysFromNow(12), closed: true, reason: "יום השתלמות צוות" },
      ],
    }),
  ],
  // An outpatient clinic is a unit too — mostly doctor-driven, with a couple of
  // rooms that hold their own queue (§PRV-08).
  facilities: [
    {
      id: "fac_out_sampling_1",
      name: "עמדת דגימות 1",
      kind: "sampling_station",
      room: "קומת כניסה",
      is_active: true,
      service_ids: [outpatientServiceIds.tests],
      created_at: isoDateDaysFromNow(-205),
      schedule: weekly({
        sunday: [shift("sh_samp_sun", "07:00", "10:30", { label: "בדיקות דם בצום", slot_minutes: 10 })],
        monday: [shift("sh_samp_mon", "07:00", "10:30", { label: "בדיקות דם בצום", slot_minutes: 10 })],
        tuesday: [shift("sh_samp_tue", "07:00", "10:30", { label: "בדיקות דם בצום", slot_minutes: 10 })],
        wednesday: [shift("sh_samp_wed", "07:00", "10:30", { label: "בדיקות דם בצום", slot_minutes: 10 })],
        thursday: [shift("sh_samp_thu", "07:00", "10:30", { label: "בדיקות דם בצום", slot_minutes: 10 })],
      }),
    },
    {
      id: "fac_out_ergo_1",
      name: "חדר ארגומטריה",
      kind: "cardiology",
      model: "Schiller CS-200",
      room: "חדר 12",
      is_active: true,
      service_ids: [outpatientServiceIds.diagnostics],
      created_at: isoDateDaysFromNow(-190),
      schedule: weekly({
        tuesday: [shift("sh_ergo_tue", "16:00", "20:00", { label: "מרפאת אבחונים", slot_minutes: 45 })],
        wednesday: [shift("sh_ergo_wed", "09:00", "13:00", { label: "מרפאת אבחונים", slot_minutes: 45 })],
      }),
    },
  ],
  referral_forms: [],
  affiliated_doctors: [
    {
      id: "affdoc_out_1",
      doctor_provider_id: outpatientDoctor1.id,
      role: "מנהלת המרפאה",
      service_ids: [
        outpatientServiceIds.consult,
        outpatientServiceIds.followUp,
        outpatientServiceIds.treatments,
      ],
      clinic_ids: [outpatientClinicId],
      added_at: isoDateDaysFromNow(-200),
      schedule: weekly({
        sunday: [
          shift("sh_odoc1_sun_am", "08:00", "12:30", { label: "מרפאת בוקר", slot_minutes: 20 }),
          shift("sh_odoc1_sun_pm", "16:00", "20:00", {
            label: "מרפאת ערב",
            slot_minutes: 20,
            breaks: [{ id: "br_odoc1_sun", start: "18:00", end: "18:20", label: "הפסקה" }],
          }),
        ],
        monday: [shift("sh_odoc1_mon", "08:00", "12:30", { label: "מרפאת בוקר", slot_minutes: 20 })],
        wednesday: [shift("sh_odoc1_wed", "08:00", "15:00", { label: "יום רציף", slot_minutes: 20 })],
        thursday: [shift("sh_odoc1_thu", "08:00", "12:30", { label: "מרפאת בוקר", slot_minutes: 20 })],
        friday: [shift("sh_odoc1_fri", "08:00", "11:00", { label: "בוקר מקוצר", slot_minutes: 20 })],
      }),
    },
    {
      // A doctor who already existed in the platform as a standalone provider
      // (ד"ר מיכל ברק, prov_2) — linked, not duplicated (§PRV-07 dedup).
      id: "affdoc_out_2",
      doctor_provider_id: "prov_2",
      role: "יועצת קרדיולוגית",
      // A cardiologist runs the cardiology clinic and gives cardiac second
      // opinions — she is not a generic "second opinion" desk.
      service_ids: [outpatientServiceIds.cardioConsult, outpatientServiceIds.secondOpinion],
      clinic_ids: [outpatientClinicId],
      added_at: isoDateDaysFromNow(-120),
      schedule: weekly({
        tuesday: [shift("sh_odoc2_tue", "16:00", "20:00", { label: "מרפאת יועצים", slot_minutes: 30 })],
      }),
    },
  ],
};

// ---------------------------------------------------------------------------
// Demo organization hierarchy: רשת (organization) → סניפים (branches) →
// יחידות רפואיות (units) → סניפים (branches). Seeds the org→unit→branch tree so
// /organizations and the provider card aren't empty on first load.
// ---------------------------------------------------------------------------
const demoOrgId = "prov_org_demo";
const demoUnitInstituteId = "prov_org_unit_1";
const demoUnitClinicId = "prov_org_unit_2";
const demoBranchTlvId = "branch_demo_tlv";
const demoBranchHaifaId = "branch_demo_haifa";
const demoBranchClinicId = "branch_demo_clinic";

const demoOrg: ProviderProfile = {
  id: demoOrgId,
  display_name: "רשת הבריאות המאוחדת",
  contact_name: "אורלי מנהלת",
  contact_phone: "03-7000000",
  contact_email: "info@united-health.co.il",
  member_provider_types: ["medical_institute", "outpatient_clinic"],
  is_organization: true,
  specialty: "ארגון בריאות",
  status: "approved",
  is_published: false,
  license_verified_at: isoDateDaysFromNow(-90),
  agreements: [],
  consultation_types: [],
  exam_types: [],
  clinic_locations: [],
  referral_forms: [],
  created_date: isoDateDaysFromNow(-90),
};

function demoUnit(
  over: Partial<ProviderProfile> & { id: string; display_name: string; provider_type: ProviderType }
): ProviderProfile {
  return {
    specialty: "",
    is_published: true,
    status: "approved",
    license_verified_at: isoDateDaysFromNow(-80),
    application_submitted_at: isoDateDaysFromNow(-85),
    agreements: [],
    consultation_types: [],
    exam_types: [],
    clinic_locations: [],
    referral_forms: [],
    created_date: isoDateDaysFromNow(-80),
    parent_organization_id: demoOrgId,
    ...over,
  };
}

// Two medical units under the org; the מכון operates in two branches (ת"א +
// חיפה), the מרפאת חוץ in one (ת"א). The מכון's לוזים (מתקנים) are grouped by
// מערך (service line) and carry capacity — e.g. "מערך MRI · MRI 1 · 3 עמדות".
// Item ids for the org's imaging unit — an imaging unit whose machines carried
// no catalogue at all read as a shell; these are the three scans such a unit
// actually sells, each linked to the machines that can perform it.
const demoImagingServiceIds = {
  mriKnee: "ct_demo_mri_knee",
  mriSpine: "ct_demo_mri_spine",
  ctHead: "ct_demo_ct_head",
};

const demoUnitInstitute = demoUnit({
  id: demoUnitInstituteId,
  display_name: "מכון הדמיה המאוחדת",
  provider_type: "medical_institute",
  specialty: "הדמיה ואבחון",
  // A price in a layer the unit has no agreement for can never actually be
  // charged — the layers priced below and the agreements declared here have to
  // be the same set.
  agreements: [
    { id: generateId("agr"), provider_id: demoUnitInstituteId, layer: "K", kupah_list: ["מכבי", "כללית", "מאוחדת"] },
    { id: generateId("agr"), provider_id: demoUnitInstituteId, layer: "B", insurance_companies: ["הראל ביטוח", "הפניקס"] },
    { id: generateId("agr"), provider_id: demoUnitInstituteId, layer: "H" },
  ],
  kupah_arrangements: [
    { kupah: "מכבי", level: "מכבי כסף" },
    { kupah: "כללית", level: "כללית מושלם" },
  ],
  private_insurance_companies: ["הראל ביטוח", "הפניקס"],
  consultation_types: [
    {
      id: demoImagingServiceIds.mriKnee,
      name: "MRI ברך",
      duration_minutes: 40,
      prices: [
        { layer: "K", price: 380 },
        { layer: "B", price: 190 },
        { layer: "H", price: 1610 },
      ],
      price_full: 1400,
      service_type: "imaging",
      service_category: "בדיקות",
      moh_code: "54040",
      requires_referral: true,
    },
    {
      id: demoImagingServiceIds.mriSpine,
      name: "MRI עמוד שדרה מותני",
      duration_minutes: 45,
      prices: [
        { layer: "K", price: 390 },
        { layer: "B", price: 195 },
        { layer: "H", price: 1670 },
      ],
      price_full: 1450,
      service_type: "imaging",
      service_category: "בדיקות",
      moh_code: "54021",
      requires_referral: true,
    },
    {
      id: demoImagingServiceIds.ctHead,
      name: "CT ראש ללא חומר ניגוד",
      duration_minutes: 20,
      prices: [
        { layer: "K", price: 260 },
        { layer: "B", price: 130 },
        { layer: "H", price: 1020 },
      ],
      price_full: 890,
      service_type: "imaging",
      service_category: "בדיקות",
      moh_code: "53010",
      has_radiation: true,
    },
  ],
  facilities: [
    {
      id: "fac_mri_tlv",
      name: "MRI 1",
      kind: "mri",
      model: "Siemens Magnetom Vida 3T",
      branch_id: demoBranchTlvId,
      service_array_id: "sarr_mri_tlv",
      service_array: "מערך MRI",
      capacity: 3,
      is_active: true,
      service_ids: [demoImagingServiceIds.mriKnee, demoImagingServiceIds.mriSpine],
      created_at: isoDateDaysFromNow(-75),
    },
    {
      id: "fac_ct_tlv",
      name: "CT 1",
      kind: "ct",
      model: "GE Revolution CT",
      branch_id: demoBranchTlvId,
      service_array_id: "sarr_ct_tlv",
      service_array: "מערך CT",
      capacity: 1,
      is_active: true,
      service_ids: [demoImagingServiceIds.ctHead],
      created_at: isoDateDaysFromNow(-75),
    },
    {
      id: "fac_mri_haifa",
      name: "MRI 1",
      kind: "mri",
      model: "Philips Ingenia 1.5T",
      branch_id: demoBranchHaifaId,
      service_array_id: "sarr_mri_haifa",
      service_array: "מערך MRI",
      capacity: 2,
      is_active: true,
      service_ids: [demoImagingServiceIds.mriKnee, demoImagingServiceIds.mriSpine],
      created_at: isoDateDaysFromNow(-65),
    },
  ],
});
// §PRV-10 demo — the מרפאת חוץ staffs a cardiology consult delivered by an
// AFFILIATED external doctor (ד"ר מיכל ברק / prov_2) who ALSO runs her own
// private clinic. This is the scenario that exercises the unified calendar and
// the cross-context double-booking guard: her time is shared between the unit
// and her private practice, and a booking in one blocks the same hour in the
// other (see SEED_AFFILIATIONS + the two demo appointments below).
const demoClinicCardioId = "ct_demo_clinic_cardio";
const demoAffiliationId = "affil_demo_clinic_michal";
const demoAffiliationSchedule: WeeklySchedule = {
  ...emptyWeeklySchedule(),
  sunday: [{ id: generateId("shift"), start: "09:00", end: "14:00", slot_minutes: 30 }],
  monday: [{ id: generateId("shift"), start: "09:00", end: "14:00", slot_minutes: 30 }],
  wednesday: [{ id: generateId("shift"), start: "09:00", end: "14:00", slot_minutes: 30 }],
};
const demoUnitClinic = demoUnit({
  id: demoUnitClinicId,
  display_name: "מרפאות חוץ המאוחדת",
  provider_type: "outpatient_clinic",
  specialty: "רב-תחומי",
  agreements: [
    { id: generateId("agr"), provider_id: demoUnitClinicId, layer: "K", kupah_list: ["כללית", "מכבי", "מאוחדת"] },
    { id: generateId("agr"), provider_id: demoUnitClinicId, layer: "B", insurance_companies: ["הראל ביטוח", "כלל ביטוח"] },
    { id: generateId("agr"), provider_id: demoUnitClinicId, layer: "H" },
  ],
  kupah_arrangements: [{ kupah: "כללית", level: "כללית מושלם" }],
  private_insurance_companies: ["הראל ביטוח", "כלל ביטוח"],
  consultation_types: [
    {
      id: demoClinicCardioId,
      name: "ייעוץ קרדיולוגי",
      duration_minutes: 30,
      prices: [
        { layer: "K", price: 140 },
        { layer: "B", price: 70 },
        { layer: "H", price: 510 },
      ],
      price_full: 440,
      service_type: "consultation",
      service_array_ids: ["sarr_clinic_consult"],
    },
  ],
});

// ---------------------------------------------------------------------------
// Back-fill the full hierarchy for the standalone units (מכון הדסה / מרפאות חוץ
// הדסה) that predate the branch+מערך model: give each a branch, turn each of its
// resources' free-text `service_array` label into a first-class ServiceArray in
// that branch, and point the resource at it via service_array_id. Mutates the
// unit's facilities/doctors in place so every unit shows סניף → מערך → משאב.
// ---------------------------------------------------------------------------
function inferArrayType(label: string, kind?: string): ServiceArrayType {
  if (/MRI|CT|הדמי|רנטגן|אולטרסאונד|ממוגר|אבחון|קרדיולוג/.test(label)) return "imaging";
  if (/ייעוץ|ייעוצים|חוות דעת/.test(label)) return "consultations";
  if (/מעבד/.test(label)) return "lab";
  if (/דגימ/.test(label)) return "samples";
  if (/פעולו|פעולה/.test(label)) return "procedures";
  if (/ניתוח/.test(label)) return "surgery";
  if (/שיקום/.test(label)) return "rehab";
  if (/טיפול/.test(label)) return "treatments";
  if (kind === "sampling_station") return "samples";
  if (kind === "operating_room") return "surgery";
  if (kind === "procedure_room") return "procedures";
  if (kind === "treatment_room") return "treatments";
  if (kind && ["mri", "ct", "ultrasound", "xray", "mammography", "pet_ct", "bone_density", "cardiology"].includes(kind))
    return "imaging";
  return "other";
}

function facilityArrayLabel(kind?: string): string {
  switch (kind) {
    case "sampling_station":
      return "מערך דגימות";
    case "cardiology":
      return "מערך אבחונים";
    case "treatment_room":
      return "מערך טיפולים";
    case "procedure_room":
      return "מערך פעולות";
    case "operating_room":
      return "מערך ניתוחים";
    default:
      return "מערך הדמיה";
  }
}

// The blank-slate unit — the ONLY seeded record that shows הקמה from the unit
// side. Exactly what addOrganizationUnit + createProviderUnitUser leave behind:
// Healson signed the unit off-platform, opened the profile with the identity it
// already knows (name, ח.פ., איש קשר) and handed over credentials — so there is
// no רישום phase, license_verified_at is already stamped, and status starts at
// "onboarding". Everything the UNIT itself owns is deliberately empty: no
// branches or מערכים (they live in their own slices, so simply seeding none),
// no facilities/schedules, no catalogue, no agreements, no signature, no photo.
// Do not "enrich" this record — its emptiness is the demo.
const demoUnitSetup: ProviderProfile = {
  id: "prov_org_unit_setup",
  parent_organization_id: demoOrgId,
  provider_type: "medical_institute",
  user_id: DEMO_UNIT_SETUP_USER.id,
  display_name: "מכון אורתופדי רמת גן",
  contact_name: "שירן לוי",
  contact_phone: "03-7000009",
  contact_email: "setup@demo.co.il",
  business_reg_number: "515740233",
  specialty: "אורתופדיה והדמיה",
  license_number: "INST-4417",
  license_issuer: "משרד הבריאות",
  is_published: false,
  onboarding_path: "unit",
  status: "onboarding",
  license_verified_at: isoDateDaysFromNow(-2),
  application_submitted_at: isoDateDaysFromNow(-2),
  created_date: isoDateDaysFromNow(-2),
  agreements: [],
  consultation_types: [],
  exam_types: [],
  clinic_locations: [],
  referral_forms: [],
  facilities: [],
};

function buildUnitHierarchy(
  unit: ProviderProfile,
  branch: { id: string; name: string; city?: string; address?: string; phone?: string }
): { branch: OrganizationBranch; arrays: ServiceArray[] } {
  const branchRec: OrganizationBranch = {
    id: branch.id,
    unit_id: unit.id,
    name: branch.name,
    city: branch.city,
    address: branch.address,
    contact_phone: branch.phone,
    created_date: isoDateDaysFromNow(-200),
  };
  const byLabel = new Map<string, ServiceArray>();
  const ensure = (label: string, type: ServiceArrayType): ServiceArray => {
    let a = byLabel.get(label);
    if (!a) {
      a = {
        id: `sarr_${unit.id}_${byLabel.size + 1}`,
        branch_id: branch.id,
        type,
        name: label,
        created_date: isoDateDaysFromNow(-200),
      };
      byLabel.set(label, a);
    }
    return a;
  };
  (unit.facilities ?? []).forEach((f) => {
    const label = f.service_array || facilityArrayLabel(f.kind);
    const a = ensure(label, inferArrayType(label, f.kind));
    f.branch_id = branch.id;
    f.service_array_id = a.id;
    f.service_array = label;
  });
  (unit.affiliated_doctors ?? []).forEach((d) => {
    const label = d.service_array || "מערך ייעוצים";
    const a = ensure(label, inferArrayType(label));
    d.branch_id = branch.id;
    d.service_array_id = a.id;
    d.service_array = label;
  });
  return { branch: branchRec, arrays: [...byLabel.values()] };
}

const instituteHierarchy = buildUnitHierarchy(providerInstitute, {
  id: "branch_institute_main",
  name: "סניף ראשון לציון",
  city: "ראשון לציון",
  address: "רחוב הזית 8",
  phone: "03-5559090",
});
const outpatientHierarchy = buildUnitHierarchy(providerOutpatient, {
  id: "branch_outpatient_main",
  name: "סניף ירושלים",
  city: "ירושלים",
  address: "יפו 210",
  phone: "02-5558080",
});

export const SEED_ORGANIZATION_BRANCHES: OrganizationBranch[] = [
  instituteHierarchy.branch,
  outpatientHierarchy.branch,
  {
    id: demoBranchTlvId,
    unit_id: demoUnitInstituteId,
    name: "סניף תל אביב",
    city: "תל אביב",
    address: "דרך מנחם בגין 132",
    contact_phone: "03-7000001",
    created_date: isoDateDaysFromNow(-88),
  },
  {
    id: demoBranchHaifaId,
    unit_id: demoUnitInstituteId,
    name: "סניף חיפה",
    city: "חיפה",
    address: "שדרות המגינים 50",
    contact_phone: "04-7000002",
    created_date: isoDateDaysFromNow(-70),
  },
  {
    id: demoBranchClinicId,
    unit_id: demoUnitClinicId,
    name: "סניף תל אביב",
    city: "תל אביב",
    address: "יגאל אלון 94",
    contact_phone: "03-7000003",
    created_date: isoDateDaysFromNow(-60),
  },
];

// מערכים (service lines) inside the מכון's branches — each typed from the
// predefined SERVICE_ARRAY_TYPES catalog. The demo מכון's facilities point at
// these via service_array_id (ת"א has an MRI + a CT line, חיפה an MRI line).
export const SEED_SERVICE_ARRAYS: ServiceArray[] = [
  // Back-filled from the standalone units' resources (מכון הדסה / מרפאות חוץ).
  ...instituteHierarchy.arrays,
  ...outpatientHierarchy.arrays,
  // The demo מכון (under the org), per branch.
  {
    id: "sarr_mri_tlv",
    branch_id: demoBranchTlvId,
    type: "imaging",
    name: "מערך MRI",
    created_date: isoDateDaysFromNow(-75),
  },
  {
    id: "sarr_ct_tlv",
    branch_id: demoBranchTlvId,
    type: "imaging",
    name: "מערך CT",
    created_date: isoDateDaysFromNow(-75),
  },
  {
    id: "sarr_mri_haifa",
    branch_id: demoBranchHaifaId,
    type: "imaging",
    name: "מערך MRI",
    created_date: isoDateDaysFromNow(-65),
  },
  // The demo מרפאת חוץ's branch — service lines it will staff.
  {
    id: "sarr_clinic_consult",
    branch_id: demoBranchClinicId,
    type: "consultations",
    name: "מערך ייעוצים",
    created_date: isoDateDaysFromNow(-58),
  },
  {
    id: "sarr_clinic_tests",
    branch_id: demoBranchClinicId,
    type: "lab",
    name: "מערך בדיקות",
    created_date: isoDateDaysFromNow(-58),
  },
  {
    id: "sarr_clinic_treat",
    branch_id: demoBranchClinicId,
    type: "treatments",
    name: "מערך טיפולים",
    created_date: isoDateDaysFromNow(-58),
  },
];

// ---------------------------------------------------------------------------
// Provider ⇄ unit affiliations (§PRV-10) — first-class, bidirectionally-
// consented links. The one seeded affiliation puts the solo doctor ד"ר מיכל
// ברק (prov_2) under the demo מרפאת חוץ as an active נותנת שירות: the unit owns
// her in-unit weekly schedule, while she keeps her own private clinic — the
// two contexts share one person, so the cross-context guard keeps her from
// being booked twice at once. Every other unit still uses the deprecated
// embedded affiliated_doctors (getUnitResources falls back per-unit), so this
// slice can grow one unit at a time without disturbing the rest.
// Migrate the standalone units' embedded affiliated_doctors (§PRV-07 legacy)
// into first-class affiliations (§PRV-10). The affdoc id is REUSED as the
// affiliation id, so any resource_id already pointing at it stays valid, and
// the embedded array is cleared so each unit has a single source of truth.
// Runs after buildUnitHierarchy() populated branch_id/service_array_id above.
function migrateEmbeddedDoctors(unit: ProviderProfile): ProviderAffiliation[] {
  const out = (unit.affiliated_doctors ?? []).map(
    (ad): ProviderAffiliation => ({
      id: ad.id,
      provider_id: ad.doctor_provider_id,
      unit_id: unit.id,
      branch_id: ad.branch_id,
      service_array_id: ad.service_array_id,
      role: ad.role,
      service_ids: ad.service_ids,
      status: "active",
      initiated_by: "unit",
      requested_at: ad.added_at,
      decided_at: ad.added_at,
      schedule_id: ad.schedule_id,
      schedule: ad.schedule,
      schedule_exceptions: ad.schedule_exceptions,
      created_at: ad.added_at,
      updated_at: ad.added_at,
    })
  );
  unit.affiliated_doctors = [];
  return out;
}

export const SEED_AFFILIATIONS: ProviderAffiliation[] = [
  // The two loginable demo units (institute@ / clinic@) — their doctors now
  // live in the slice, so the new "נותני שירות" management screen lists them.
  ...migrateEmbeddedDoctors(providerInstitute),
  ...migrateEmbeddedDoctors(providerOutpatient),
  // ד"ר אבי לוי (prov_1 — the provider@ demo login) affiliated to the מרפאת
  // חוץ, so the provider SIDE (ProviderUnitsCard + the unified-calendar unit
  // reflection) is visible on a real login. See the seeded unit appointment.
  {
    id: "affil_out_avi",
    provider_id: "prov_1",
    unit_id: "prov_outpatient",
    role: "יועץ אורתופדי",
    // The orthopaedist runs the orthopaedic clinic here — NOT the family-
    // medicine consult, which belongs to ד"ר תמר אביב.
    service_ids: [outpatientServiceIds.orthoConsult],
    status: "active",
    initiated_by: "unit",
    requested_at: isoDateDaysFromNow(-30),
    decided_at: isoDateDaysFromNow(-29),
    schedule: weekly({
      tuesday: [shift("sh_avi_out_tue", "09:00", "12:00", { label: "מרפאת אורתופדיה", slot_minutes: 30 })],
    }),
    created_at: isoDateDaysFromNow(-30),
    updated_at: isoDateDaysFromNow(-29),
  },
  // The org demo unit (no login) — kept so the seed also exercises the guard on
  // ד"ר מיכל ברק, who runs a private clinic AND works here (see the two appts).
  {
    id: demoAffiliationId,
    provider_id: "prov_2",
    unit_id: demoUnitClinicId,
    branch_id: demoBranchClinicId,
    service_array_id: "sarr_clinic_consult",
    role: "רופאה בכירה",
    service_ids: [demoClinicCardioId],
    status: "active",
    initiated_by: "unit",
    requested_at: isoDateDaysFromNow(-40),
    decided_at: isoDateDaysFromNow(-39),
    schedule: demoAffiliationSchedule,
    created_at: isoDateDaysFromNow(-40),
    updated_at: isoDateDaysFromNow(-39),
  },
];

// Flat commissions that replace the 20% default for a slice of the business
// (payments meeting §8). Both rules below are the kind a real agreement
// actually contains: a flat platform fee per scan at an imaging institute
// (where 20% of a ₪2,000 MRI would be absurd), and a flat fee negotiated with
// one high-ticket specialist.
export const SEED_FIXED_FEE_RULES: FixedFeeRule[] = [
  {
    id: "fee_institute_imaging",
    provider_type: "medical_institute",
    service_type: "diagnostics",
    amount: 150,
  },
  {
    id: "fee_p7_consult",
    provider_id: "prov_7",
    service_type: "consultation",
    amount: 200,
  },
];

export const SEED_PROVIDERS: ProviderProfile[] = [
  provider1,
  provider2,
  provider3,
  provider4,
  provider5,
  provider6,
  provider7,
  providerInstitute,
  instituteDoctor1,
  instituteDoctor2,
  providerOutpatient,
  outpatientDoctor1,
  demoOrg,
  demoUnitInstitute,
  demoUnitClinic,
  demoUnitSetup,
];

// ---------------------------------------------------------------------------
// Catalog items — TWO separate reference catalogs (see CatalogKind in types):
//
//   קטלוג מב"ר   — Ministry of Health codes + the official MoH price list in
//                   layers S and H. Exposed only to מכון רפואי / חדרי ניתוח
//                   (hospital) / בתי מרקחת.
//   קטלוג הילסון — Healson codes (HLS-…) with a full item price P, Healson
//                   tariffs K + B, while S + H always mirror the MoH list.
//                   Exposed to individual providers and to every other
//                   medical unit (מרפאות חוץ, שירותים עד הבית, מעבדות…).
//
// Derived from the skill taxonomy, 3 items per sub-domain. `provider_id` is
// left undefined (global reference catalog, per §5.3) — only a handful of
// items below are pinned to a specific demo provider.
// ---------------------------------------------------------------------------

// MoH price list for a Healson item: S is the kupah-basket price, H the full
// private MoH tariff — both fixed by the ministry, never by the provider.
function healsonLayerPrices(fullPrice: number): PriceByLayer[] {
  return [
    { layer: "S", price: Math.round(fullPrice * 0.3) },
    { layer: "K", price: Math.round(fullPrice * 0.55) },
    { layer: "B", price: Math.round(fullPrice * 0.4) },
    { layer: "H", price: Math.round(fullPrice * 0.9) },
  ];
}

// The per-payer breakdown behind a Healson item's K/B headline tariffs
// (payments meeting §6/§8): Healson negotiates each שב"ן plan and each private
// carrier separately, so the same item is an הסדר with a small co-pay at one
// payer and a pure החזר (patient pays in full, claims it back themselves) at
// another. Providers read this table; only Healson ops maintains it.
function healsonPayerPrices(fullPrice: number): PayerPrice[] {
  const copay = (factor: number) => Math.round((fullPrice * factor) / 5) * 5;
  return [
    { layer: "K", kupah: "כללית", level: "כללית מושלם", price: copay(0.3), mode: "הסדר" },
    { layer: "K", kupah: "כללית", level: "כללית פלטינום", price: copay(0.2), mode: "הסדר" },
    { layer: "K", kupah: "מכבי", level: "מכבי שלי", price: copay(0.25), mode: "הסדר" },
    { layer: "K", kupah: "מאוחדת", level: "מאוחדת עדיף", price: copay(0.35), mode: "שניהם" },
    { layer: "K", kupah: "לאומית", level: "לאומית זהב", mode: "החזר" },
    { layer: "B", insurer: "הראל ביטוח", price: copay(0.15), mode: "הסדר" },
    { layer: "B", insurer: "מגדל ביטוח", price: copay(0.2), mode: "הסדר" },
    { layer: "B", insurer: "כלל ביטוח", mode: "החזר" },
  ];
}

// MoH price list for a מב"ר item — the ministry publishes S and H only.
function mabarLayerPrices(sPrice: number): PriceByLayer[] {
  return [
    { layer: "S", price: sPrice },
    { layer: "H", price: Math.round(sPrice * 3.4) },
  ];
}

// Prices must be STABLE across reloads: a reference catalog that reprices
// itself every refresh makes the demo impossible to talk about ("it said 412
// a minute ago"). A tiny deterministic spread off the item index gives variety
// without randomness, rounded to whole ₪10 like a real price list.
function priceStep(index: number, base: number, spread: number): number {
  const offset = ((index * 37) % (spread / 10 + 1)) * 10;
  return base + offset;
}

function buildCatalog(): CatalogItem[] {
  const items: CatalogItem[] = [];
  let mabarCode = 100000;
  let healsonCode = 20001;
  let itemIndex = 0;
  for (const domain of SEED_SKILL_DOMAINS) {
    const subdomains = SEED_SKILL_SUBDOMAINS.filter((s) => s.domain_id === domain.id);

    for (const sub of subdomains) {
      itemIndex++;
      const consultPrice = priceStep(itemIndex, 350, 150);
      items.push({
        id: generateId("cat"),
        tavar_code: `HLS-${healsonCode++}`,
        name_he: `ייעוץ ${domain.name_he} - ${sub.name_he}`,
        catalog: "healson",
        skill_domain_id: domain.id,
        skill_subdomain_id: sub.id,
        service_type: "consultation",
        base_price: consultPrice,
        price_full: consultPrice,
        layer_prices: healsonLayerPrices(consultPrice),
        payer_prices: healsonPayerPrices(consultPrice),
        typical_duration_min: 30,
        requires_referral: false,
        is_active: true,
      });

      const imagingPrice = priceStep(itemIndex, 900, 400);
      items.push({
        id: generateId("cat"),
        tavar_code: String(mabarCode++),
        // Deliberately "בדיקת אבחון" and not "בדיקת דימות": this generic entry
        // is generated for EVERY sub-domain, and there is no such thing as an
        // imaging scan of פסיכיאטריה or פתולוגיה. The real imaging items are
        // the curated MoH-coded ones below.
        name_he: `בדיקת אבחון - ${sub.name_he}`,
        catalog: "mabar",
        skill_domain_id: domain.id,
        skill_subdomain_id: sub.id,
        service_type: "diagnostics",
        base_price: imagingPrice,
        layer_prices: mabarLayerPrices(imagingPrice),
        typical_duration_min: 45,
        requires_referral: true,
        is_active: true,
      });

      const extraPrice = priceStep(itemIndex, 100, 150);
      items.push({
        id: generateId("cat"),
        tavar_code: `HLS-${healsonCode++}`,
        name_he: `ביקורת מעקב - ${sub.name_he}`,
        catalog: "healson",
        skill_domain_id: domain.id,
        skill_subdomain_id: sub.id,
        service_type: "extra",
        base_price: extraPrice,
        price_full: extraPrice,
        layer_prices: healsonLayerPrices(extraPrice),
        payer_prices: healsonPayerPrices(extraPrice),
        typical_duration_min: 20,
        requires_referral: false,
        is_active: true,
      });
    }
  }

  // Curated מב"ר items with real-style MoH codes — the kind a מכון / חדר
  // ניתוח / בית מרקחת actually enters by code.
  const curatedMabar: Array<{
    code: string;
    name: string;
    domain: string;
    subdomain: string;
    service_type: CatalogItem["service_type"];
    s: number;
    duration: number;
  }> = [
    // Codes and names must be the SAME strings the MoH code book publishes
    // (src/lib/moh-codes.ts) — the whole point of a coded catalog is that one
    // procedure carries one code everywhere on the platform.
    { code: "54021", name: "MRI עמוד שדרה מותני", domain: "dom_ortho", subdomain: "sub_ortho_spine", service_type: "diagnostics", s: 390, duration: 45 },
    { code: "54040", name: "MRI ברך", domain: "dom_ortho", subdomain: "sub_ortho_knee", service_type: "diagnostics", s: 380, duration: 40 },
    { code: "54010", name: "MRI ראש ללא חומר ניגוד", domain: "dom_neuro", subdomain: "sub_neuro_headache", service_type: "diagnostics", s: 420, duration: 40 },
    { code: "21040", name: "מבחן מאמץ לבבי", domain: "dom_cardio", subdomain: "sub_cardio_general", service_type: "diagnostics", s: 260, duration: 45 },
    { code: "52040", name: "אקו לב (אקוקרדיוגרפיה)", domain: "dom_cardio", subdomain: "sub_cardio_general", service_type: "diagnostics", s: 240, duration: 30 },
    { code: "31010", name: "קולונוסקופיה אבחנתית", domain: "dom_gastro", subdomain: "sub_gastro_gi", service_type: "diagnostics", s: 620, duration: 45 },
    { code: "42010", name: "ארתרוסקופיה של הברך", domain: "dom_ortho", subdomain: "sub_ortho_knee", service_type: "surgery", s: 2450, duration: 90 },
    { code: "43010", name: "ניתוח קטרקט עם השתלת עדשה", domain: "dom_eyes", subdomain: "sub_eyes_cataract", service_type: "surgery", s: 3100, duration: 45 },
  ];
  for (const c of curatedMabar) {
    items.push({
      id: generateId("cat"),
      tavar_code: c.code,
      name_he: c.name,
      catalog: "mabar",
      skill_domain_id: c.domain,
      skill_subdomain_id: c.subdomain,
      service_type: c.service_type,
      base_price: c.s,
      layer_prices: mabarLayerPrices(c.s),
      typical_duration_min: c.duration,
      requires_referral: true,
      is_active: true,
    });
  }

  // A few provider-pinned custom items (orthopedics/cardiology), demonstrating
  // the admin catalog's optional "ספק (אופציונלי)" field for a one-off item
  // that only that specific provider offers, on top of the global reference
  // catalog above.
  items.push({
    id: generateId("cat"),
    tavar_code: `HLS-${healsonCode++}`,
    name_he: "ייעוץ אורתופדי VIP - " + provider1.display_name,
    catalog: "healson",
    skill_domain_id: "dom_ortho",
    skill_subdomain_id: "sub_ortho_knee",
    service_type: "consultation",
    base_price: 600,
    price_full: 600,
    layer_prices: healsonLayerPrices(600),
    payer_prices: healsonPayerPrices(600),
    typical_duration_min: 45,
    requires_referral: false,
    provider_id: provider1.id,
    is_active: true,
  });
  items.push({
    id: generateId("cat"),
    tavar_code: `HLS-${healsonCode++}`,
    name_he: "בדיקת מאמץ מתקדמת - " + provider2.display_name,
    catalog: "healson",
    skill_domain_id: "dom_cardio",
    skill_subdomain_id: "sub_cardio_general",
    service_type: "diagnostics",
    base_price: 1200,
    price_full: 1200,
    layer_prices: healsonLayerPrices(1200),
    payer_prices: healsonPayerPrices(1200),
    typical_duration_min: 60,
    requires_referral: true,
    provider_id: provider2.id,
    is_active: true,
  });

  return items;
}

export const SEED_CATALOG: CatalogItem[] = buildCatalog();

// ---------------------------------------------------------------------------
// Catalog requests — providers asking Ops to add a Healson item they couldn't
// find. Seeded so the /catalog "בקשות קטלוג" queue isn't empty on first load.
// ---------------------------------------------------------------------------
// Each request must come from a provider who could plausibly HAVE made it:
// the item belongs to that provider's specialty, and the provider is past
// license verification (a pending_review provider has no catalog stage yet).
export const SEED_CATALOG_REQUESTS: CatalogRequest[] = [
  {
    id: "creq_1",
    provider_id: "prov_2", // קרדיולוגית
    requested_name: "ניטור לחץ דם ביתי מרחוק (טלה-קרדיולוגיה)",
    service_type: "test",
    description:
      "מטופלים מודדים בבית עם מכשיר שאני מנפיקה, והמעקב והפענוח מתבצעים מרחוק. אין פריט תואם בקטלוג הילסון — הולטר לחץ דם מתייחס למדידה רציפה של 24 שעות במרפאה.",
    catalog_kind: "healson",
    status: "pending",
    created_date: isoDateDaysFromNow(-1),
  },
  {
    id: "creq_2",
    provider_id: "prov_1", // מנתח אורתופד
    requested_name: "הזרקת PRP לברך (פלזמה עשירה בטסיות)",
    service_type: "procedure",
    description:
      "טיפול נפוץ בשחיקת סחוס בברך, נבדל מהזרקה תוך-מפרקית רגילה בהכנת המנה מדם המטופל ובמשך הפגישה (כ-45 דק').",
    catalog_kind: "healson",
    status: "needs_info",
    admin_note: "נא לפרט האם נדרשת הפניה ומהו משך הפגישה המומלץ.",
    created_date: isoDateDaysFromNow(-4),
  },
  {
    id: "creq_3",
    provider_id: "prov_6", // רופא עיניים
    requested_name: "טיפול לייזר YAG לאחר ניתוח קטרקט",
    service_type: "procedure",
    description: "טיפול משלים שכיח לאחר ניתוח קטרקט (עכירות הקופסית האחורית), שאינו קיים כיום בקטלוג.",
    catalog_kind: "healson",
    status: "pending",
    created_date: isoDateDaysFromNow(-2),
  },
];

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------
const PATIENT_NAMES = [
  "נועה כהן",
  "יוסי מזרחי",
  "שירה אברהם",
  "דניאל פרץ",
  "מאיה לוי",
  "איתי בן דוד",
  "טליה גולן",
  "עומר אזולאי",
  "הדס שמש",
  "רועי קפלן",
  "ליאת דהן",
  "אסף נחום",
];

// Father first names, paired below with the patient's own surname. "שם האב"
// is required on every patient record now, not just minors, so a seeded
// patient without one can't be saved from the CRM edit form.
const FATHER_FIRST_NAMES = ["אורי", "דוד", "משה", "יעקב", "אברהם", "יצחק", "שלמה", "בנימין", "נתן", "אליהו", "מרדכי", "שמעון"];

const KUPAH_CYCLE = ["כללית", "מכבי", "מאוחדת", "לאומית"] as const satisfies readonly Kupah[];

export const SEED_PATIENTS: Patient[] = PATIENT_NAMES.map((name, i) => {
  const hasK = i % 3 === 0;
  const hasB = i % 4 === 1;
  const kupah = KUPAH_CYCLE[i % 4];
  const kLevels = K_LEVELS_BY_KUPAH[kupah];
  return {
    id: generateId("pat"),
    full_name: name,
    email: `${name.split(" ")[0]}${i}@example.co.il`,
    phone: `05${i % 2 === 0 ? "2" : "4"}-${1000000 + i * 1234}`,
    id_number: `${200000000 + i * 37}`,
    // PATIENT_NAMES alternates female/male by index, so this stays in step
    // with the names rather than contradicting them.
    gender: i % 2 === 0 ? "נקבה" : "זכר",
    parent_name: `${FATHER_FIRST_NAMES[i % FATHER_FIRST_NAMES.length]} ${name.split(" ").slice(1).join(" ")}`,
    // Spread across ages ~24-57 — the CRM edit form requires a birth date, so
    // seeded patients need one or they can't be edited at all.
    date_of_birth: isoDateDaysFromNow(-(365 * (24 + i * 3) + i * 41)),
    kupah,
    k_level: hasK ? kLevels[i % kLevels.length] : undefined,
    b_insurances: hasB
      ? [
          {
            company: B_INSURANCE_COMPANIES[i % B_INSURANCE_COMPANIES.length],
            // Must come from the carrier's own roster — the agent picker
            // matches against it, so an off-list name would render as "אחר".
            agent_name: INSURANCE_AGENTS_BY_COMPANY[B_INSURANCE_COMPANIES[i % B_INSURANCE_COMPANIES.length]][i % 4],
          },
        ]
      : undefined,
    status: i % 5 === 0 ? "לא פעיל" : i % 7 === 0 ? "ממתין" : "פעיל",
    // Every seeded patient is assigned to one of the three demo providers —
    // the medical unit used to get none, which left its "מטופלים" tab empty on
    // the demo account even though it has appointments and orders.
    assigned_provider: i % 3 === 0 ? provider1.id : i % 3 === 1 ? provider2.id : "prov_institute",
    created_date: isoDateDaysFromNow(-i * 17),
    user_id: i === 0 ? DEMO_PATIENT_USER.id : undefined,
  };
});

// Make sure demo patient user has a matching Patient record, with a full
// insurance profile so the SKBH pricing demo has something to show.
SEED_PATIENTS[0].full_name = DEMO_PATIENT_USER.full_name;
SEED_PATIENTS[0].email = DEMO_PATIENT_USER.email;
SEED_PATIENTS[0].status = "פעיל";
SEED_PATIENTS[0].kupah = "מכבי";
SEED_PATIENTS[0].k_level = "מכבי שלי";
// One private policy, from the recognised carrier list — the demo patient
// should read as a realistic profile, so no free-text placeholder carrier.
// The company MUST be a canonical B_INSURANCE_COMPANIES string — the B price
// is matched against it, so the short form "מגדל" would silently never match
// a provider's "מגדל ביטוח" agreement.
// The demo patient is the one profile that has the (optional) policy document
// filed, so the collapsed disclosure has something to show a filename for.
SEED_PATIENTS[0].b_insurances = [
  {
    company: "מגדל ביטוח",
    agent_name: "יעל אדרי סוכנות ביטוח",
    policy_document: {
      file_name: "פוליסה_מגדל_בריאות.pdf",
      uploaded_at: isoDateDaysFromNow(-40),
      data_url: "data:application/pdf;base64,",
    },
  },
];

// ---------------------------------------------------------------------------
// Consent records (§4.2, §11.1) — required consents granted at signup for
// every seeded patient; demo patient also has an optional analytics grant.
// ---------------------------------------------------------------------------
export const SEED_CONSENT_RECORDS: ConsentRecord[] = SEED_PATIENTS.flatMap((p) => {
  const records: ConsentRecord[] = [
    {
      id: generateId("consent"),
      patient_id: p.id,
      consent_type: "health_data_storage",
      version: CONSENT_DOCUMENT_VERSION,
      granted: true,
      granted_at: p.created_date,
    },
    {
      id: generateId("consent"),
      patient_id: p.id,
      consent_type: "provider_transfer",
      version: CONSENT_DOCUMENT_VERSION,
      granted: true,
      granted_at: p.created_date,
    },
  ];
  if (p.id === SEED_PATIENTS[0].id) {
    records.push({
      id: generateId("consent"),
      patient_id: p.id,
      consent_type: "analytics",
      version: CONSENT_DOCUMENT_VERSION,
      granted: true,
      granted_at: p.created_date,
    });
  }
  return records;
});

// ---------------------------------------------------------------------------
// Data subject rights requests (§11.2) — a couple of demo rows for the
// admin DSR queue.
// ---------------------------------------------------------------------------
export const SEED_DSR_REQUESTS: DsrRequest[] = [
  {
    id: generateId("dsr"),
    patient_id: SEED_PATIENTS[1].id,
    type: "export",
    status: "ממתין",
    requested_at: isoDateDaysFromNow(-2),
  },
  {
    id: generateId("dsr"),
    patient_id: SEED_PATIENTS[2].id,
    type: "erasure",
    status: "ממתין",
    requested_at: isoDateDaysFromNow(-5),
    notes: "מטופל ביקש למחוק את חשבונו לאחר סיום הטיפול",
  },
];

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------
const LEAD_NAMES = [
  "רותם ישראלי",
  "גיא פלד",
  "מיכל אורן",
  "נדב שרון",
  "אורית ביטון",
  "אלון רביב",
];

export const SEED_LEADS: Lead[] = LEAD_NAMES.map((name, i) => ({
  id: generateId("lead"),
  full_name: name,
  email: `${name.split(" ")[0]}${i}@example.co.il`,
  phone: `05${i}-${2000000 + i * 999}`,
  source: i % 2 === 0 ? "אתר אינטרנט" : "הפניה",
  notes: "",
  status: (["חדש", "נוצר קשר", "מתוכנן", "הומר", "לא מעוניין"] as const)[i % 5],
  last_contact: i % 2 === 0 ? isoDateDaysFromNow(-i) : undefined,
  created_date: isoDateDaysFromNow(-i * 9),
}));

// ---------------------------------------------------------------------------
// Appointments — spread across the current week and surrounding weeks.
// ---------------------------------------------------------------------------
// Last-resort names, used only when a provider has no catalogue at all — kept
// spelled exactly like the real items so a fallback never invents a service
// that doesn't exist anywhere on the platform.
const SERVICE_NAMES = [
  "ייעוץ אורתופדי — ברך וכתף",
  "מבחן מאמץ לבבי (ארגומטריה)",
  "ייעוץ קרדיולוגי כללי",
  "אקו לב (אקוקרדיוגרפיה)",
  "חוות דעת שנייה לפני ניתוח",
  "אק״ג במנוחה",
];

// Cycled across every published demo provider — including the two
// organization accounts — so each one a patient can find in search also has
// booked slots to demonstrate "fully booked day" / waitlist against, and the
// unit portals open with real operational data rather than empty tables.
const APPOINTMENT_PROVIDERS = [
  provider1,
  provider2,
  provider5,
  provider6,
  providerInstitute,
  providerOutpatient,
];

// Which queue an appointment belongs to. Neither calendar in the provider
// portal can show "where does this happen" without it:
//   • a unit has no single queue — every appointment is served by one עמדה
//     (§PRV-08), which is also what makes capacity in the booking flow real
//     (an occupied עמדה stops offering that slot);
//   • a solo provider's queue is the מרפאה it was booked at, which is what
//     separates their own clinic work from the shifts a unit schedules them for.
function seedPlacement(
  provider: ProviderProfile,
  serviceId: string | undefined,
  pick: number
): { resource_id?: string; owner_context_id?: string; practitioner_id?: string; clinic_id?: string } {
  if (!serviceId) return {};
  if (!isUnitProviderType(provider.provider_type)) {
    const locations = provider.clinic_locations ?? [];
    if (locations.length === 0) return {};
    // Prefer a location the item is actually offered at.
    const service = provider.consultation_types.find((s) => s.id === serviceId);
    const linked = service?.linked_clinic_ids?.length
      ? locations.filter((c) => service.linked_clinic_ids!.includes(c.id))
      : locations;
    const pool = linked.length > 0 ? linked : locations;
    return { clinic_id: pool[pick % pool.length].id };
  }
  const candidates: { id: string; practitioner?: string }[] = [
    ...(provider.facilities ?? [])
      .filter((f) => f.is_active !== false && (f.service_ids ?? []).includes(serviceId))
      .map((f) => ({ id: f.id, practitioner: undefined })),
    ...SEED_AFFILIATIONS.filter(
      (a) => a.unit_id === provider.id && (a.service_ids ?? []).includes(serviceId)
    ).map((a) => ({ id: a.id, practitioner: a.provider_id })),
  ];
  if (candidates.length === 0) return {};
  const chosen = candidates[pick % candidates.length];
  return {
    resource_id: chosen.id,
    owner_context_id: chosen.id,
    practitioner_id: chosen.practitioner,
  };
}

export const SEED_APPOINTMENTS: Appointment[] = Array.from({ length: 24 }).map(
  (_, i): Appointment => {
    const dayOffset = Math.floor(i / 3) - 4; // spread -4..+3 days
    const provider = APPOINTMENT_PROVIDERS[i % APPOINTMENT_PROVIDERS.length];
    const patient = SEED_PATIENTS[i % SEED_PATIENTS.length];
    const hour = 8 + (i % 9);
    const statusPool: Appointment["status"][] = [
      "ממתין לתשלום מקדמה",
      "מאושר",
      "שולם במלואו",
      "בוצע",
      "בוטל",
    ];
    const rawStatus = statusPool[i % statusPool.length];
    const depositPaid = rawStatus === "מאושר" || rawStatus === "שולם במלואו" || rawStatus === "בוצע";
    // Prefer a service the provider actually offers, so an institute's
    // appointments don't read as orthopedic consultations.
    const service = provider.consultation_types[i % Math.max(1, provider.consultation_types.length)];
    // The price has to be THIS provider's price for THIS item at the patient's
    // insurance layer — a price copied from an unrelated catalog row is what
    // made a 20-minute consultation show up at an MRI's tariff.
    const resolved = service
      ? resolvePriceBreakdown(service.prices, provider.agreements, patient, service.price_full)
      : null;
    const price =
      resolved?.price ??
      resolveCatalogPrice(SEED_CATALOG[i % SEED_CATALOG.length].base_price, patient).price;
    // Payments model (02.08.2026). Route S never sees money at all — it is
    // settled with a commitment form (טופס 17), so seeding it with a deposit
    // and a balance would describe a flow that does not exist. Every other
    // route pays 20% up front and the rest the day before, unless the unit
    // collects it itself.
    const commitmentRoute = resolved?.layer === "S";
    const deposit = commitmentRoute ? undefined : depositForPrice(price);
    const balance = commitmentRoute ? undefined : Math.max(0, price - (deposit ?? 0));
    const collector = provider.balance_collector ?? "healson";
    // "waiting for a deposit" is meaningless on a route that never takes one —
    // there it means "waiting for the commitment form".
    const status: Appointment["status"] =
      commitmentRoute && rawStatus === "ממתין לתשלום מקדמה" ? "ממתין להתחייבות" : rawStatus;
    const settled = status === "שולם במלואו" || status === "בוצע";
    return {
      id: generateId("appt"),
      client_name: patient.full_name,
      client_phone: patient.phone,
      provider_id: provider.id,
      provider_name: provider.display_name,
      service_name: service?.name ?? SERVICE_NAMES[i % SERVICE_NAMES.length],
      ...seedPlacement(provider, service?.id, i),
      date: isoDateDaysFromNow(dayOffset),
      time: `${String(hour).padStart(2, "0")}:00`,
      // A booking lasts as long as the item says it does — a 45-minute MRI and
      // a 15-minute ECG were both being seeded as flat 30-minute slots.
      duration_minutes: service?.duration_minutes ?? 30,
      status,
      price,
      funding_layer: resolved?.layer,
      deposit_amount: deposit,
      // Alternate between "still inside the 48h refund window" and "long past
      // it" so the demo data shows both cancellation-policy states.
      deposit_paid_at: commitmentRoute || !depositPaid
        ? undefined
        : isoTimestampHoursFromNow(i % 2 === 0 ? -10 : -96),
      // Route S carries the commitment form instead of any money — present
      // once the booking is confirmed, still missing while it waits.
      commitment_document:
        commitmentRoute && depositPaid
          ? {
              file_name: `טופס_17_${patient.kupah ?? "קופה"}.pdf`,
              uploaded_at: isoTimestampHoursFromNow(-60),
              data_url: "data:application/pdf;base64,",
            }
          : undefined,
      balance_amount: balance,
      balance_due_at:
        !commitmentRoute && collector === "healson"
          ? balanceDueAt(isoDateDaysFromNow(dayOffset))
          : undefined,
      balance_paid_at: !commitmentRoute && settled ? isoTimestampHoursFromNow(-8) : undefined,
      balance_collector: commitmentRoute ? undefined : collector,
      kupah: patient.kupah,
      notes: "",
      created_by_id: patient.id,
    };
  }
).concat([
  // Two extra history items for the demo patient specifically, from two
  // different providers/services — the generated appointments above only
  // give the demo patient (SEED_PATIENTS[0]) a single past item, which
  // isn't enough to demo the "נותן שירות" / "סוג טיפול" filters on
  // /client/appointments (§ היסטוריית תורים).
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[0].full_name,
    client_phone: SEED_PATIENTS[0].phone,
    provider_id: provider1.id,
    provider_name: provider1.display_name,
    // Must be spelled exactly as the item in provider1.consultation_types —
    // that's what links a booking back to a price list and a catalog entry.
    service_name: "ייעוץ אורתופדי — ברך וכתף",
    clinic_id: provider1ClinicId,
    date: isoDateDaysFromNow(-10),
    time: "10:30",
    duration_minutes: 30,
    status: "בוצע",
    price: 450,
    deposit_amount: 135,
    deposit_paid_at: isoTimestampHoursFromNow(-240),
    kupah: SEED_PATIENTS[0].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[0].id,
  },
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[0].full_name,
    client_phone: SEED_PATIENTS[0].phone,
    provider_id: provider2.id,
    provider_name: provider2.display_name,
    service_name: "ייעוץ קרדיולוגי כללי",
    clinic_id: provider2ClinicId,
    date: isoDateDaysFromNow(-15),
    time: "09:00",
    duration_minutes: 30,
    status: "בוטל",
    price: 420,
    deposit_amount: 126,
    kupah: SEED_PATIENTS[0].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[0].id,
  },
  // §PRV-10 — ד"ר מיכל ברק's two contexts on the SAME day at different hours, so
  // her unified calendar shows both and neither collides. Booking her in the
  // unit at 10:00 (her private-clinic hour) is what the cross-context guard
  // blocks; 12:00 (her unit hour) blocks a new private booking there. Both
  // carry practitioner_id = prov_2 (the person), with distinct owners.
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[2].full_name,
    client_phone: SEED_PATIENTS[2].phone,
    provider_id: provider2.id,
    provider_name: provider2.display_name,
    service_name: "ייעוץ קרדיולוגי כללי",
    clinic_id: provider2ClinicId,
    practitioner_id: provider2.id,
    owner_context_id: provider2.id,
    date: isoDateDaysFromNow(2),
    time: "10:00",
    duration_minutes: 30,
    status: "מאושר",
    price: 420,
    deposit_amount: 126,
    deposit_paid_at: isoTimestampHoursFromNow(-30),
    kupah: SEED_PATIENTS[2].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[2].id,
  },
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[3].full_name,
    client_phone: SEED_PATIENTS[3].phone,
    provider_id: demoUnitClinicId,
    provider_name: "מרפאות חוץ המאוחדת",
    service_name: "ייעוץ קרדיולוגי",
    resource_id: demoAffiliationId,
    practitioner_id: provider2.id,
    owner_context_id: demoAffiliationId,
    date: isoDateDaysFromNow(2),
    time: "12:00",
    duration_minutes: 30,
    status: "מאושר",
    price: 440,
    deposit_amount: 132,
    deposit_paid_at: isoTimestampHoursFromNow(-30),
    kupah: SEED_PATIENTS[3].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[3].id,
  },
  // §PRV-10 — a unit booking delivered by ד"ר אבי לוי (prov_1, the provider@
  // login) inside the מרפאת חוץ. It shows on HIS unified calendar as a
  // read-only reflection (owned by the unit), demonstrating the provider side.
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[4].full_name,
    client_phone: SEED_PATIENTS[4].phone,
    provider_id: "prov_outpatient",
    provider_name: "מרפאות חוץ הדסה קהילה",
    service_name: "ייעוץ אורתופדי",
    resource_id: "affil_out_avi",
    practitioner_id: "prov_1",
    owner_context_id: "affil_out_avi",
    date: isoDateDaysFromNow(3),
    time: "09:00",
    duration_minutes: 30,
    status: "מאושר",
    price: 300,
    deposit_amount: 90,
    deposit_paid_at: isoTimestampHoursFromNow(-20),
    kupah: SEED_PATIENTS[4].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[4].id,
  },

  // -------------------------------------------------------------------------
  // The payments model from the 02.08.2026 meeting, one booking per state, on
  // the reference examples of §9. Together these make every provider-side
  // screen (the diary, "בקשות ממתינות", the payment chip) open with a real
  // case instead of an empty list.
  // -------------------------------------------------------------------------

  // §9 — a ₪2,000 paediatric-neurology CONSULTATION with a doctor. Deposit is
  // the 20% rule (₪400) and the ₪1,600 balance is charged by Healson at 12:00
  // the day before, which is exactly the disclosure the patient signed.
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[1].full_name,
    client_phone: SEED_PATIENTS[1].phone,
    provider_id: provider7.id,
    provider_name: provider7.display_name,
    service_name: "ייעוץ נוירולוגיית ילדים",
    clinic_id: provider7ClinicId,
    practitioner_id: provider7.id,
    owner_context_id: provider7.id,
    date: isoDateDaysFromNow(1),
    time: "09:00",
    duration_minutes: 45,
    status: "ממתין לתשלום יתרה",
    funding_layer: "H",
    price: 2000,
    deposit_amount: 400,
    deposit_paid_at: isoTimestampHoursFromNow(-72),
    balance_amount: 1600,
    balance_due_at: balanceDueAt(isoDateDaysFromNow(1)),
    balance_collector: "healson",
    kupah: SEED_PATIENTS[1].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[1].id,
  },
  // The same item under the FLAT deposit rule (₪200) — the second half of the
  // "מקדמה 200/400 לפי הכלל" example, still waiting for that deposit.
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[5].full_name,
    client_phone: SEED_PATIENTS[5].phone,
    provider_id: provider7.id,
    provider_name: provider7.display_name,
    service_name: "ייעוץ נוירולוגיית ילדים",
    clinic_id: provider7ClinicId,
    practitioner_id: provider7.id,
    owner_context_id: provider7.id,
    date: isoDateDaysFromNow(4),
    time: "10:30",
    duration_minutes: 45,
    status: "ממתין לתשלום מקדמה",
    funding_layer: "H",
    price: 2000,
    deposit_amount: 200,
    balance_amount: 1800,
    balance_due_at: balanceDueAt(isoDateDaysFromNow(4)),
    balance_collector: "healson",
    kupah: SEED_PATIENTS[5].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[5].id,
  },
  // §9 — the ₪1,200 follow-up consultation, fully settled.
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[1].full_name,
    client_phone: SEED_PATIENTS[1].phone,
    provider_id: provider7.id,
    provider_name: provider7.display_name,
    service_name: "ייעוץ חוזר — נוירולוגיית ילדים",
    clinic_id: provider7ClinicId,
    practitioner_id: provider7.id,
    owner_context_id: provider7.id,
    date: isoDateDaysFromNow(-6),
    time: "14:30",
    duration_minutes: 25,
    status: "בוצע",
    funding_layer: "H",
    price: 1200,
    deposit_amount: 240,
    deposit_paid_at: isoTimestampHoursFromNow(-200),
    balance_amount: 960,
    balance_due_at: balanceDueAt(isoDateDaysFromNow(-6)),
    balance_paid_at: isoTimestampHoursFromNow(-170),
    balance_collector: "healson",
    kupah: SEED_PATIENTS[1].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[1].id,
  },

  // §9 + §2 — an MRI at a מכון on route S: the referral was uploaded and the
  // unit has not decided yet, so there is no date on it at all — a time is only
  // offered once the answer comes back. This is the row the "בקשות ממתינות"
  // queue opens on.
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[6].full_name,
    client_phone: SEED_PATIENTS[6].phone,
    provider_id: providerInstitute.id,
    provider_name: providerInstitute.display_name,
    service_name: "MRI ראש ללא חומר ניגוד",
    resource_id: "fac_inst_mri_1",
    owner_context_id: "fac_inst_mri_1",
    date: "",
    time: "",
    duration_minutes: 40,
    status: "ממתין לאישור הפניה",
    funding_layer: "S",
    price: 420,
    referral_document: {
      file_name: "הפניה_MRI_ראש.pdf",
      uploaded_at: isoTimestampHoursFromNow(-6),
      data_url: "data:application/pdf;base64,",
    },
    kupah: SEED_PATIENTS[6].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[6].id,
  },
  // §9 — CT at a מכון on route S: referral approved, now waiting on the
  // commitment (טופס 17). No deposit is taken on this route at all.
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[7].full_name,
    client_phone: SEED_PATIENTS[7].phone,
    provider_id: providerInstitute.id,
    provider_name: providerInstitute.display_name,
    service_name: "CT בטן ואגן עם חומר ניגוד",
    resource_id: "fac_inst_ct_1",
    owner_context_id: "fac_inst_ct_1",
    date: isoDateDaysFromNow(6),
    time: "08:30",
    duration_minutes: 30,
    status: "ממתין להתחייבות",
    funding_layer: "S",
    price: 560,
    referral_document: {
      file_name: "הפניה_CT_בטן.pdf",
      uploaded_at: isoTimestampHoursFromNow(-50),
      data_url: "data:application/pdf;base64,",
    },
    referral_decision: "approved",
    referral_decided_at: isoTimestampHoursFromNow(-48),
    kupah: SEED_PATIENTS[7].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[7].id,
  },
  // Route S with the commitment already in hand — the appointment is simply
  // confirmed, and no money ever changes hands in the portal.
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[8].full_name,
    client_phone: SEED_PATIENTS[8].phone,
    provider_id: providerInstitute.id,
    provider_name: providerInstitute.display_name,
    service_name: "MRI עמוד שדרה מותני",
    resource_id: "fac_inst_mri_1",
    owner_context_id: "fac_inst_mri_1",
    date: isoDateDaysFromNow(2),
    time: "13:00",
    duration_minutes: 45,
    status: "מאושר",
    funding_layer: "S",
    price: 390,
    referral_document: {
      file_name: "הפניה_MRI_מותני.pdf",
      uploaded_at: isoTimestampHoursFromNow(-120),
      data_url: "data:application/pdf;base64,",
    },
    referral_decision: "approved",
    referral_decided_at: isoTimestampHoursFromNow(-118),
    commitment_document: {
      file_name: "טופס_17_מכבי.pdf",
      uploaded_at: isoTimestampHoursFromNow(-90),
      data_url: "data:application/pdf;base64,",
    },
    kupah: SEED_PATIENTS[8].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[8].id,
  },

  // §5 — the same balance, at a unit that collects it ITSELF: Healson takes
  // only the deposit and the counter takes the rest, so no automatic charge is
  // ever scheduled here.
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[9].full_name,
    client_phone: SEED_PATIENTS[9].phone,
    provider_id: providerOutpatient.id,
    provider_name: providerOutpatient.display_name,
    service_name: "ייעוץ קרדיולוגי",
    resource_id: "affil_out_avi",
    practitioner_id: "prov_1",
    owner_context_id: "affil_out_avi",
    date: isoDateDaysFromNow(3),
    time: "11:00",
    duration_minutes: 30,
    status: "מאושר",
    funding_layer: "H",
    price: 450,
    deposit_amount: 90,
    deposit_paid_at: isoTimestampHoursFromNow(-40),
    balance_amount: 360,
    balance_collector: "unit",
    kupah: SEED_PATIENTS[9].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[9].id,
  },
  // The collection failure the new terminal state exists for: the balance was
  // not paid by 12:00 the day before, so the booking cancelled itself.
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[10].full_name,
    client_phone: SEED_PATIENTS[10].phone,
    provider_id: provider7.id,
    provider_name: provider7.display_name,
    service_name: "ייעוץ נוירולוגיית ילדים",
    clinic_id: provider7ClinicId,
    practitioner_id: provider7.id,
    owner_context_id: provider7.id,
    date: isoDateDaysFromNow(-2),
    time: "12:00",
    duration_minutes: 45,
    status: "בוטל — יתרה לא שולמה",
    funding_layer: "H",
    price: 2000,
    deposit_amount: 400,
    deposit_paid_at: isoTimestampHoursFromNow(-260),
    balance_amount: 1600,
    balance_due_at: balanceDueAt(isoDateDaysFromNow(-2)),
    balance_collector: "healson",
    kupah: SEED_PATIENTS[10].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[10].id,
  },

  // A second referral in the מכון's queue, so the queue reads as a queue —
  // and an ultrasound is the everyday case next to the MRI above.
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[11].full_name,
    client_phone: SEED_PATIENTS[11].phone,
    provider_id: providerInstitute.id,
    provider_name: providerInstitute.display_name,
    service_name: "אולטרסאונד בטן שלמה",
    resource_id: "fac_inst_us_1",
    owner_context_id: "fac_inst_us_1",
    date: "",
    time: "",
    duration_minutes: 30,
    status: "ממתין לאישור הפניה",
    funding_layer: "K",
    price: 260,
    deposit_amount: 52,
    balance_amount: 208,
    // No balance_due_at: it is "the day before the appointment", and there is
    // no appointment date to count back from yet.
    balance_collector: "healson",
    referral_document: {
      file_name: "הפניה_US_בטן.pdf",
      uploaded_at: isoTimestampHoursFromNow(-3),
      data_url: "data:application/pdf;base64,",
    },
    kupah: SEED_PATIENTS[11].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[11].id,
  },
  // A referral the unit REJECTED — the audit trail a provider needs when the
  // patient calls to ask why their appointment disappeared.
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[2].full_name,
    client_phone: SEED_PATIENTS[2].phone,
    provider_id: providerInstitute.id,
    provider_name: providerInstitute.display_name,
    service_name: "CT חזה",
    resource_id: "fac_inst_ct_1",
    owner_context_id: "fac_inst_ct_1",
    date: isoDateDaysFromNow(-1),
    time: "15:00",
    duration_minutes: 30,
    status: "בוטל",
    funding_layer: "S",
    price: 480,
    referral_document: {
      file_name: "הפניה_CT_חזה.pdf",
      uploaded_at: isoTimestampHoursFromNow(-96),
      data_url: "data:application/pdf;base64,",
    },
    referral_decision: "rejected",
    referral_decided_at: isoTimestampHoursFromNow(-90),
    referral_rejection_reason: "ההפניה פגת תוקף (הונפקה לפני יותר מ-6 חודשים) — נדרשת הפניה מעודכנת מרופא/ת המשפחה.",
    kupah: SEED_PATIENTS[2].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[2].id,
  },

  // The מרפאת חוץ collects at its own counter: an ergometry that still needs a
  // referral decision, and a blood test whose balance is paid at reception.
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[5].full_name,
    client_phone: SEED_PATIENTS[5].phone,
    provider_id: providerOutpatient.id,
    provider_name: providerOutpatient.display_name,
    service_name: "מבחן מאמץ לבבי (ארגומטריה)",
    date: "",
    time: "",
    duration_minutes: 45,
    status: "ממתין לאישור הפניה",
    funding_layer: "K",
    price: 180,
    deposit_amount: 36,
    balance_amount: 144,
    balance_collector: "unit",
    referral_document: {
      file_name: "הפניה_ארגומטריה.pdf",
      uploaded_at: isoTimestampHoursFromNow(-9),
      data_url: "data:application/pdf;base64,",
    },
    kupah: SEED_PATIENTS[5].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[5].id,
  },
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[8].full_name,
    client_phone: SEED_PATIENTS[8].phone,
    provider_id: providerOutpatient.id,
    provider_name: providerOutpatient.display_name,
    service_name: "בדיקות דם שגרתיות",
    date: isoDateDaysFromNow(1),
    time: "07:30",
    duration_minutes: 10,
    status: "מאושר",
    funding_layer: "H",
    price: 150,
    deposit_amount: 30,
    deposit_paid_at: isoTimestampHoursFromNow(-26),
    balance_amount: 120,
    balance_collector: "unit",
    kupah: SEED_PATIENTS[8].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[8].id,
  },

  // ד"ר אבי לוי (the provider@ demo login) — an arthroscopy referral waiting on
  // HIS decision, so the requests queue is not empty on the main provider demo.
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[7].full_name,
    client_phone: SEED_PATIENTS[7].phone,
    provider_id: provider1.id,
    provider_name: provider1.display_name,
    service_name: "ארתרוסקופיה של הברך",
    clinic_id: provider1ClinicId,
    practitioner_id: provider1.id,
    owner_context_id: provider1.id,
    date: "",
    time: "",
    duration_minutes: 90,
    status: "ממתין לאישור הפניה",
    funding_layer: "B",
    price: 2450,
    referral_document: {
      file_name: "הפניה_ארתרוסקופיה.pdf",
      uploaded_at: isoTimestampHoursFromNow(-11),
      data_url: "data:application/pdf;base64,",
    },
    kupah: SEED_PATIENTS[7].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[7].id,
  },

  // The state the referral gate exists to produce, on the demo patient's own
  // account (SEED_PATIENTS[0]) so "קבע מועד" is visible in "התורים שלי" without
  // having to walk the whole booking flow first: ד"ר לוי approved the injection
  // referral, and the diary is now open to her. She saw him for the knee
  // consultation above, so the item follows from her own history.
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[0].full_name,
    client_phone: SEED_PATIENTS[0].phone,
    provider_id: provider1.id,
    provider_name: provider1.display_name,
    service_name: "הזרקה תוך-מפרקית מונחית אולטרסאונד",
    clinic_id: provider1ClinicId,
    practitioner_id: provider1.id,
    owner_context_id: provider1.id,
    date: "",
    time: "",
    duration_minutes: 20,
    status: "ממתין לקביעת מועד",
    funding_layer: "K",
    price: 180,
    deposit_amount: 36,
    balance_amount: 144,
    balance_collector: "healson",
    referral_document: {
      file_name: "הפניה_הזרקה_ברך.pdf",
      uploaded_at: isoTimestampHoursFromNow(-30),
      data_url: "data:application/pdf;base64,",
    },
    referral_decision: "approved",
    referral_decided_at: isoTimestampHoursFromNow(-4),
    kupah: SEED_PATIENTS[0].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[0].id,
  },
  // ד"ר יערה — a follow-up already settled in full, so her diary shows the
  // whole arc: waiting for a deposit, waiting for a balance, and closed.
  {
    id: generateId("appt"),
    client_name: SEED_PATIENTS[3].full_name,
    client_phone: SEED_PATIENTS[3].phone,
    provider_id: provider7.id,
    provider_name: provider7.display_name,
    service_name: "ייעוץ חוזר — נוירולוגיית ילדים",
    clinic_id: provider7ClinicId,
    practitioner_id: provider7.id,
    owner_context_id: provider7.id,
    date: isoDateDaysFromNow(2),
    time: "14:00",
    duration_minutes: 25,
    status: "שולם במלואו",
    funding_layer: "H",
    price: 1200,
    deposit_amount: 200,
    deposit_paid_at: isoTimestampHoursFromNow(-120),
    balance_amount: 1000,
    balance_due_at: balanceDueAt(isoDateDaysFromNow(2)),
    balance_paid_at: isoTimestampHoursFromNow(-4),
    balance_collector: "healson",
    kupah: SEED_PATIENTS[3].kupah,
    notes: "",
    created_by_id: SEED_PATIENTS[3].id,
  },
]);

// ---------------------------------------------------------------------------
// Orders — final price resolved from the reference catalog price by the
// booking patient's SKBH layer, with Healson's commission split out.
// ---------------------------------------------------------------------------
export const SEED_ORDERS: Order[] = SEED_APPOINTMENTS.slice(0, 16).map(
  (appt, i) => {
    const patient = SEED_PATIENTS.find((p) => p.id === appt.created_by_id);
    const provider = SEED_PROVIDERS.find((p) => p.id === appt.provider_id);
    // The order is the money side of THIS appointment, so its price is the
    // appointment's own resolved price — not a price borrowed from an unrelated
    // reference-catalog row, which is how an orthopaedic visit ended up billed
    // at a cardiology item's tariff.
    const service = provider?.consultation_types.find((s) => s.name === appt.service_name);
    const price =
      appt.price ??
      (service
        ? resolvePriceBreakdown(service.prices, provider?.agreements, patient, service.price_full)?.price
        : undefined) ??
      0;
    const commissionRate = provider?.commission_rate ?? DEFAULT_COMMISSION_RATE;
    // The order's money must be the SAME money the appointment collected
    // (payments meeting §8): the deposit is the commission, so both are read
    // off the booking rather than recomputed here at a second percentage.
    const deposit = appt.deposit_amount ?? Math.round((price * commissionRate) / 100);
    const balance = appt.balance_amount ?? Math.max(0, price - deposit);
    const commissionAmount = deposit;
    const statusPool: Order["status"][] = [
      "ממתין",
      "מאושר",
      "בביצוע",
      "הושלם",
      "בוטל",
    ];
    const status = statusPool[i % statusPool.length];
    return {
      id: generateId("ord"),
      item_id: service?.id,
      item_name: appt.service_name,
      provider_id: appt.provider_id,
      provider_name: appt.provider_name,
      created_by_id: appt.created_by_id,
      patient_name: appt.client_name,
      final_price: price,
      status,
      created_date: isoDateDaysFromNow(-i * 3),
      payment_status: status === "הושלם" ? "שולם במלואו" : status === "בוטל" ? "הוחזר" : "מקדמה שולמה",
      deposit_amount: deposit,
      balance_amount: balance,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      provider_payout_amount: price - commissionAmount,
    };
  }
);

// ---------------------------------------------------------------------------
// Lab referrals
// ---------------------------------------------------------------------------
// A referral carries the panel the referring doctor actually orders and the
// clinical question behind it — an orthopaedist orders pre-op bloods, a
// cardiologist orders lipids and thyroid. Codes come from the MoH lab codes
// (src/lib/moh-codes.ts) so a referral and a catalog item speak the same language.
const REFERRAL_PANELS: Record<string, { tests: string[]; code: string; question: string }[]> = {
  [provider1.id]: [
    {
      tests: ["ספירת דם מלאה", "תפקודי קרישה (PT/INR)"],
      code: "20010",
      question: "בדיקות כשירות לקראת ארתרוסקופיה של הברך.",
    },
    {
      tests: ["ספירת דם מלאה", "CRP ושקיעת דם"],
      code: "20010",
      question: "מפרק נפוח וחם — לשלול תהליך דלקתי/זיהומי.",
    },
  ],
  [provider2.id]: [
    {
      tests: ["פאנל שומנים בדם", "גלוקוז בצום והמוגלובין מסוכרר"],
      code: "20020",
      question: "הערכת סיכון קרדיווסקולרי לפני התחלת טיפול.",
    },
    {
      tests: ["תפקודי בלוטת התריס (TSH, T4)"],
      code: "20030",
      question: "דפיקות לב ותחושת עייפות — לשלול פעילות יתר של בלוטת התריס.",
    },
  ],
};

export const SEED_LAB_REFERRALS: LabReferral[] = Array.from({ length: 10 }).map(
  (_, i) => {
    const provider = i % 2 === 0 ? provider1 : provider2;
    const patient = SEED_PATIENTS[i % SEED_PATIENTS.length];
    const statusPool: LabReferral["status"][] = [
      "ממתין לעיבוד",
      "בעיבוד",
      "הושלם",
      "שגיאה",
    ];
    const status = statusPool[i % statusPool.length];
    const panels = REFERRAL_PANELS[provider.id];
    const panel = panels[Math.floor(i / 2) % panels.length];
    return {
      id: generateId("lab"),
      provider_id: provider.id,
      provider_name: provider.display_name,
      patient_id: patient.id,
      patient_name: patient.full_name,
      test_types: panel.tests,
      lab_code: panel.code,
      status,
      created_date: isoDateDaysFromNow(-i * 5),
      completed_date: status === "הושלם" ? isoDateDaysFromNow(-i * 5 + 2) : undefined,
      notes: panel.question,
      results: status === "הושלם" ? "כל הערכים בטווח התקין, ללא ממצאים חריגים." : undefined,
    };
  }
).concat([
  // The generated batch above only lands the demo patient (SEED_PATIENTS[0])
  // on a single referral (i=0, status "ממתין לעיבוד") — not enough to demo
  // all 4 ReferralStatus tones on /client/documents for the account you're
  // actually logged in as.
  {
    id: generateId("lab"),
    provider_id: provider1.id,
    provider_name: provider1.display_name,
    patient_id: SEED_PATIENTS[0].id,
    patient_name: SEED_PATIENTS[0].full_name,
    test_types: ["ספירת דם מלאה", "תפקודי קרישה (PT/INR)"],
    lab_code: "20010",
    status: "בעיבוד",
    created_date: isoDateDaysFromNow(-4),
    completed_date: undefined,
    notes: "בדיקות כשירות לקראת ניתוח ארתרוסקופי.",
    results: undefined,
  },
  {
    id: generateId("lab"),
    provider_id: provider2.id,
    provider_name: provider2.display_name,
    patient_id: SEED_PATIENTS[0].id,
    patient_name: SEED_PATIENTS[0].full_name,
    test_types: ["פאנל שומנים בדם"],
    lab_code: "20020",
    status: "הושלם",
    created_date: isoDateDaysFromNow(-9),
    completed_date: isoDateDaysFromNow(-7),
    notes: "מעקב שנתי אחר רמות כולסטרול.",
    results: "LDL 118 מ״ג/ד״ל, HDL 54, טריגליצרידים 130 — מעט מעל היעד, מומלץ שינוי תזונתי ובדיקה חוזרת בעוד חצי שנה.",
  },
  {
    id: generateId("lab"),
    provider_id: provider1.id,
    provider_name: provider1.display_name,
    patient_id: SEED_PATIENTS[0].id,
    patient_name: SEED_PATIENTS[0].full_name,
    test_types: ["בדיקת שתן כללית ותרבית"],
    lab_code: "20050",
    status: "שגיאה",
    created_date: isoDateDaysFromNow(-2),
    completed_date: undefined,
    notes: "הדגימה נפסלה במעבדה — נדרשת דגימה חוזרת",
    results: undefined,
  },
]);

// ---------------------------------------------------------------------------
// Visit records — a provider's own clinical notes on a patient. Deliberately
// includes one record from provider2 against the same patient (SEED_PATIENTS[0],
// the demo patient) as provider1's records, so the provider-scoped patient
// chart (/provider/patients/[id]) has something real to hide: logging in as
// provider1 must never surface provider2's note on that same patient.
// ---------------------------------------------------------------------------
export const SEED_VISIT_RECORDS: VisitRecord[] = [
  {
    id: generateId("visit"),
    provider_id: provider1.id,
    provider_name: provider1.display_name,
    patient_id: SEED_PATIENTS[0].id,
    visit_date: isoDateDaysFromNow(-5).slice(0, 10),
    summary: "ביקור מעקב לאחר טיפול שמרני בברך ימין. נפיחות ירדה משמעותית, טווח תנועה משתפר. ממשיכים בפיזיותרפיה.",
    instructions: "להימנע ממאמץ פיזי משמעותי (ריצה, קפיצות) למשך 10 ימים נוספים. להמשיך תרגילי חיזוק פעמיים ביום.",
    provider_documents: [
      { file_name: "סיכום-ביקור-14.03.pdf", uploaded_at: isoDateDaysFromNow(-5), data_url: "data:application/pdf;base64," },
    ],
    created_date: isoDateDaysFromNow(-5),
  },
  {
    id: generateId("visit"),
    provider_id: provider1.id,
    provider_name: provider1.display_name,
    patient_id: SEED_PATIENTS[3 % SEED_PATIENTS.length].id,
    visit_date: isoDateDaysFromNow(-20).slice(0, 10),
    summary: "בדיקת ברך ראשונית — חשד לקרע במיניסקוס. הופנה לבדיקת MRI לצורך אבחון מדויק.",
    instructions: "להימנע מעליה/ירידה במדרגות ככל האפשר עד לקבלת תוצאות ה-MRI.",
    created_date: isoDateDaysFromNow(-20),
  },
  {
    id: generateId("visit"),
    provider_id: provider1.id,
    provider_name: provider1.display_name,
    patient_id: SEED_PATIENTS[6 % SEED_PATIENTS.length].id,
    visit_date: isoDateDaysFromNow(-2).slice(0, 10),
    summary: "חוות דעת שנייה בעניין המלצה לניתוח ארתרוסקופי — ההמלצה הקודמת אושרה, המטופל הופנה לתיאום ניתוח.",
    created_date: isoDateDaysFromNow(-2),
  },
  // Provider2's own note on the same patient as provider1's first record
  // above — proves the chart's "only your own history" restriction is real.
  {
    id: generateId("visit"),
    provider_id: provider2.id,
    provider_name: provider2.display_name,
    patient_id: SEED_PATIENTS[0].id,
    visit_date: isoDateDaysFromNow(-12).slice(0, 10),
    summary: "בדיקה קרדיולוגית שגרתית — א.ק.ג תקין, לחץ דם תקין. אין ממצאים חריגים.",
    instructions: "מעקב שגרתי בעוד שנה, אלא אם כן יופיעו תסמינים.",
    created_date: isoDateDaysFromNow(-12),
  },
];

// ---------------------------------------------------------------------------
// Documents — the patient-facing "מסמכים" tab.
// ---------------------------------------------------------------------------
const demoPatient = SEED_PATIENTS[0];
const demoDocAppointments = SEED_APPOINTMENTS.filter((a) => a.created_by_id === demoPatient.id);

export const SEED_DOCUMENTS: PatientDocument[] = [
  {
    id: generateId("doc"),
    patient_id: demoPatient.id,
    category: "referral_personal",
    title: "הפניה לבדיקת MRI לברך",
    uploaded_by: "patient",
    appointment_id: demoDocAppointments[0]?.id,
    created_date: isoDateDaysFromNow(-6),
    file: { file_name: "הפניה_MRI.pdf", uploaded_at: isoDateDaysFromNow(-6), data_url: "data:application/pdf;base64," },
  },
  {
    id: generateId("doc"),
    patient_id: demoPatient.id,
    category: "referral_personal",
    title: "צילום תעודת זהות",
    uploaded_by: "patient",
    created_date: isoDateDaysFromNow(-30),
    file: { file_name: "תז.jpg", uploaded_at: isoDateDaysFromNow(-30), data_url: "data:image/jpeg;base64," },
  },
  // Every fully-paid appointment (deposit + balance both cleared, i.e.
  // status "שולם במלואו"/"בוצע") gets its own two receipts — one per
  // payment — matching what PayDepositDialog/PayBalanceDialog now create
  // for real when a patient pays live in the demo.
  {
    id: generateId("doc"),
    patient_id: demoPatient.id,
    category: "receipt",
    title: `קבלה על מקדמה - ${demoDocAppointments[1]?.service_name ?? "ייעוץ"}`,
    uploaded_by: "system",
    appointment_id: demoDocAppointments[1]?.id,
    created_date: isoDateDaysFromNow(-16),
    file: { file_name: "קבלה_מקדמה_1042.pdf", uploaded_at: isoDateDaysFromNow(-16), data_url: "data:application/pdf;base64," },
  },
  {
    id: generateId("doc"),
    patient_id: demoPatient.id,
    category: "receipt",
    title: `קבלה על יתרה - ${demoDocAppointments[1]?.service_name ?? "ייעוץ"}`,
    uploaded_by: "system",
    appointment_id: demoDocAppointments[1]?.id,
    created_date: isoDateDaysFromNow(-12),
    file: { file_name: "קבלה_יתרה_1043.pdf", uploaded_at: isoDateDaysFromNow(-12), data_url: "data:application/pdf;base64," },
  },
  {
    id: generateId("doc"),
    patient_id: demoPatient.id,
    category: "receipt",
    title: `קבלה על מקדמה - ${demoDocAppointments[2]?.service_name ?? "ייעוץ"}`,
    uploaded_by: "system",
    appointment_id: demoDocAppointments[2]?.id,
    created_date: isoDateDaysFromNow(-11),
    file: { file_name: "קבלה_מקדמה_2231.pdf", uploaded_at: isoDateDaysFromNow(-11), data_url: "data:application/pdf;base64," },
  },
  {
    id: generateId("doc"),
    patient_id: demoPatient.id,
    category: "receipt",
    title: `קבלה על יתרה - ${demoDocAppointments[2]?.service_name ?? "ייעוץ"}`,
    uploaded_by: "system",
    appointment_id: demoDocAppointments[2]?.id,
    created_date: isoDateDaysFromNow(-10),
    file: { file_name: "קבלה_יתרה_2232.pdf", uploaded_at: isoDateDaysFromNow(-10), data_url: "data:application/pdf;base64," },
  },
  {
    id: generateId("doc"),
    patient_id: demoPatient.id,
    category: "visit_summary",
    title: "סיכום ביקור - ייעוץ קרדיולוגי",
    uploaded_by: "provider",
    appointment_id: demoDocAppointments[1]?.id,
    created_date: isoDateDaysFromNow(-10),
    file: { file_name: "סיכום_ביקור.pdf", uploaded_at: isoDateDaysFromNow(-10), data_url: "data:application/pdf;base64," },
  },
  {
    id: generateId("doc"),
    patient_id: demoPatient.id,
    category: "questionnaire",
    title: "שאלון בריאות לפני בדיקת מאמץ",
    uploaded_by: "system",
    appointment_id: demoDocAppointments[0]?.id,
    status: "ממתין למילוי",
    created_date: isoDateDaysFromNow(-1),
  },
  // Demo of the "required documents" checklist (see ConsultationType.
  // required_documents) — pending items tied to an upcoming appointment so
  // the checklist shows up on /client/appointments without needing to book
  // a fresh appointment first.
  {
    id: generateId("doc"),
    patient_id: demoPatient.id,
    category: "referral_personal",
    title: "הפניה מרופא מטפל",
    uploaded_by: "system",
    appointment_id: demoDocAppointments[1]?.id,
    status: "ממתין למילוי",
    created_date: isoDateDaysFromNow(-1),
  },
  {
    id: generateId("doc"),
    patient_id: demoPatient.id,
    category: "referral_personal",
    title: "צילומי רנטגן קודמים (אם קיימים)",
    uploaded_by: "system",
    appointment_id: demoDocAppointments[1]?.id,
    status: "ממתין למילוי",
    created_date: isoDateDaysFromNow(-1),
  },
  {
    id: generateId("doc"),
    patient_id: demoPatient.id,
    category: "questionnaire",
    title: "שאלון טרום הרדמה",
    uploaded_by: "system",
    status: "זמין",
    created_date: isoDateDaysFromNow(-20),
    file: { file_name: "שאלון_הרדמה.pdf", uploaded_at: isoDateDaysFromNow(-19), data_url: "data:application/pdf;base64," },
  },
  // Demonstrates the new multi-appointment linking (DocumentUploadDialog /
  // appointment_ids) — a patient-uploaded doc relevant to two separate
  // visits, rendered as "קשור ל-2 תורים" instead of a single appointment.
  {
    id: generateId("doc"),
    patient_id: demoPatient.id,
    category: "other",
    title: "סיכום מצב רפואי כללי",
    uploaded_by: "patient",
    appointment_ids: [demoDocAppointments[2]?.id, demoDocAppointments[3]?.id].filter((id): id is string => !!id),
    created_date: isoDateDaysFromNow(-8),
    file: {
      file_name: "סיכום_מצב_רפואי.pdf",
      uploaded_at: isoDateDaysFromNow(-8),
      data_url: "data:application/pdf;base64,",
    },
  },
  // Spread a few documents across other patients too, so the tab isn't
  // demo-patient-only.
  ...SEED_PATIENTS.slice(1, 4).map((patient, i) => {
    const category = (["referral_personal", "receipt", "visit_summary"] as DocumentCategory[])[i];
    const title = ["הפניה לבדיקת דם", "חשבונית - בדיקת מאמץ", "סיכום ביקור - ייעוץ אורתופדי"][i];
    const uploadedBy = (["patient", "system", "provider"] as PatientDocument["uploaded_by"][])[i];
    const createdDate = isoDateDaysFromNow(-(i + 1) * 8);
    return {
      id: generateId("doc"),
      patient_id: patient.id,
      category,
      title,
      uploaded_by: uploadedBy,
      created_date: createdDate,
      file: { file_name: `מסמך_${i + 1}.pdf`, uploaded_at: createdDate, data_url: "data:application/pdf;base64," },
    };
  }),
];

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------
export const SEED_BRANCHES: Branch[] = [
  { id: generateId("branch"), name: "סניף תל אביב", city: "תל אביב", address: "איבן גבירול 50" },
  { id: generateId("branch"), name: "סניף רמת גן", city: "רמת גן", address: "ביאליק 12" },
  { id: generateId("branch"), name: "סניף חיפה", city: "חיפה", address: "הרצל 8" },
];
