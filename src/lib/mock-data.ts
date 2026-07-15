import {
  Appointment,
  Branch,
  CatalogItem,
  ConsentRecord,
  CONSENT_DOCUMENT_VERSION,
  DocumentCategory,
  DsrRequest,
  Kupah,
  K_LEVELS_BY_KUPAH,
  Lead,
  LabReferral,
  Order,
  Patient,
  PatientDocument,
  ProviderProfile,
  User,
  VisitRecord,
} from "@/types";
import { generateId, isoDateDaysFromNow, isoTimestampHoursFromNow } from "./utils";
import { SEED_SKILL_DOMAINS, SEED_SKILL_SUBDOMAINS } from "./medical-tree";
import { resolveCatalogPrice } from "./pricing";

// ---------------------------------------------------------------------------
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
  DEMO_ADMIN_USER,
  DEMO_ADMIN_USER_2,
];

const provider2ClinicId = generateId("clinic");

const provider2: ProviderProfile = {
  id: "prov_2",
  user_id: undefined,
  display_name: "ד\"ר מיכל ברק",
  title: "ד\"ר",
  specialty: "קרדיולוגיה",
  bio: "מומחית ברפואת לב עם ניסיון של מעל 15 שנה, בעלת תואר נוסף בקרדיולוגיה התערבותית. מתמחה באבחון מוקדם ומעקב מטופלי לב כרוניים.",
  languages: ["עברית", "אנגלית", "רוסית"],
  rating: 4.9,
  review_count: 212,
  license_number: "MD-44521",
  license_issuer: "משרד הבריאות",
  license_issue_date: isoDateDaysFromNow(-1500),
  license_expiry_date: isoDateDaysFromNow(900),
  is_published: true,
  status: "approved",
  commission_rate: 12,
  created_date: isoDateDaysFromNow(-400),
  agreements: [
    { id: generateId("agr"), provider_id: "prov_2", layer: "K" },
    { id: generateId("agr"), provider_id: "prov_2", layer: "B" },
    { id: generateId("agr"), provider_id: "prov_2", layer: "H" },
  ],
  kupah_arrangements: [
    { kupah: "כללית", level: "כללית פלטינום" },
    { kupah: "מכבי", level: "מכבי כסף" },
    { kupah: "לאומית", level: "לאומית זהב" },
  ],
  private_insurance_companies: ["כלל", "הראל"],
  consultation_types: [
    {
      id: generateId("ct"),
      name: "ייעוץ קרדיולוגי כללי",
      duration_minutes: 30,
      prices: [
        { layer: "K", price: 130 },
        { layer: "B", price: 60 },
        { layer: "H", price: 420 },
      ],
      service_type: "consultation",
      linked_clinic_ids: [provider2ClinicId],
      requires_questionnaire: true,
      questionnaire_title: "שאלון בריאות כללי",
    },
    {
      id: generateId("ct"),
      name: "בדיקת מאמץ",
      duration_minutes: 45,
      prices: [
        { layer: "K", price: 200 },
        { layer: "B", price: 90 },
        { layer: "H", price: 650 },
      ],
      service_type: "test",
      linked_clinic_ids: [provider2ClinicId],
    },
    // Unified into the single services list (no more separate "בדיקות"
    // tab/section) — see B2/B3 in the services-merge fix.
    {
      id: generateId("ct"),
      name: "אקו לב",
      duration_minutes: 30,
      prices: [
        { layer: "K", price: 260 },
        { layer: "B", price: 120 },
        { layer: "H", price: 800 },
      ],
      service_type: "imaging",
      linked_clinic_ids: [provider2ClinicId],
    },
  ],
  exam_types: [],
  clinic_locations: [
    {
      id: provider2ClinicId,
      name: "מרפאת הלב תל אביב",
      address: "רחוב איבן גבירול 50",
      city: "תל אביב",
      phone: "03-5551234",
      is_primary: true,
      hours: {
        sunday: ["08:00", "16:00"],
        monday: ["08:00", "16:00"],
        tuesday: ["08:00", "16:00"],
        wednesday: ["08:00", "16:00"],
        thursday: ["08:00", "14:00"],
        friday: null,
        saturday: null,
      },
    },
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

const provider1: ProviderProfile = {
  id: "prov_1",
  user_id: DEMO_PROVIDER_USER.id,
  display_name: "ד\"ר אבי לוי",
  title: "ד\"ר",
  specialty: "אורתופדיה",
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
    { id: generateId("agr"), provider_id: "prov_1", layer: "K" },
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
      id: generateId("ct"),
      name: "ייעוץ אורתופדי - ברך",
      duration_minutes: 30,
      prices: [
        { layer: "K", price: 120 },
        { layer: "H", price: 450 },
      ],
      service_type: "consultation",
      linked_clinic_ids: [provider1ClinicId],
    },
    {
      id: generateId("ct"),
      name: "חוות דעת שנייה",
      duration_minutes: 20,
      prices: [
        { layer: "S", price: 35 },
        { layer: "K", price: 100 },
        { layer: "H", price: 390 },
      ],
      service_type: "consultation",
      linked_clinic_ids: [provider1ClinicId],
    },
    // Unified into the single services list (no more separate "בדיקות"
    // tab/section) — see B2/B3 in the services-merge fix.
    {
      id: generateId("ct"),
      name: "בדיקת MRI לברך",
      duration_minutes: 45,
      prices: [
        { layer: "K", price: 350 },
        { layer: "H", price: 1200 },
      ],
      service_type: "imaging",
      linked_clinic_ids: [provider1ClinicId],
    },
  ],
  exam_types: [],
  clinic_locations: [
    {
      id: provider1ClinicId,
      name: "מרפאת אורתופדיה רמת גן",
      address: "ביאליק 12",
      city: "רמת גן",
      phone: "03-6661234",
      is_primary: true,
      hours: {
        sunday: ["09:00", "17:00"],
        monday: ["09:00", "17:00"],
        tuesday: ["09:00", "17:00"],
        wednesday: ["09:00", "17:00"],
        thursday: ["09:00", "17:00"],
        friday: ["09:00", "13:00"],
        saturday: null,
      },
    },
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
      prices: [{ layer: "H", price: 350 }],
      service_type: "consultation",
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

const provider5: ProviderProfile = {
  id: "prov_5",
  display_name: "ד\"ר עדי רון",
  title: "ד\"ר",
  specialty: "גסטרואנטרולוגיה",
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
    { id: generateId("agr"), provider_id: "prov_5", layer: "B", insurance_companies: ["כלל", "הראל"] },
    { id: generateId("agr"), provider_id: "prov_5", layer: "H" },
  ],
  private_insurance_companies: ["כלל", "הראל"],
  consultation_types: [
    {
      id: generateId("ct"),
      name: "ייעוץ גסטרואנטרולוגי",
      duration_minutes: 30,
      prices: [
        { layer: "K", price: 150 },
        { layer: "B", price: 70 },
        { layer: "H", price: 480 },
      ],
      service_type: "consultation",
      linked_clinic_ids: [provider5ClinicId],
    },
  ],
  exam_types: [],
  clinic_locations: [
    {
      id: provider5ClinicId,
      name: "מרפאת עיכול חיפה",
      address: "הנמל 22",
      city: "חיפה",
      phone: "04-8551234",
      is_primary: true,
      hours: {
        sunday: ["09:00", "17:00"],
        monday: ["09:00", "17:00"],
        tuesday: ["09:00", "17:00"],
        wednesday: ["09:00", "17:00"],
        thursday: ["09:00", "15:00"],
        friday: null,
        saturday: null,
      },
    },
  ],
  referral_forms: [],
};

// Published private-pay-only provider (§7.1) — no S/K/B agreement declared
// at all, so no patient sees an arrangement or a reimbursement note here,
// regardless of what insurance they hold.
const provider6ClinicId = generateId("clinic");

const provider6: ProviderProfile = {
  id: "prov_6",
  display_name: "ד\"ר יובל שרון",
  title: "ד\"ר",
  specialty: "רפואת עיניים",
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
      id: generateId("ct"),
      name: "ייעוץ רפואת עיניים",
      duration_minutes: 20,
      prices: [{ layer: "H", price: 390 }],
      service_type: "consultation",
      linked_clinic_ids: [provider6ClinicId],
    },
  ],
  exam_types: [],
  clinic_locations: [
    {
      id: provider6ClinicId,
      name: "מרפאת עיניים הרצליה",
      address: "סוקולוב 10",
      city: "הרצליה",
      phone: "09-9551234",
      is_primary: true,
      hours: {
        sunday: ["08:30", "16:30"],
        monday: ["08:30", "16:30"],
        tuesday: ["08:30", "16:30"],
        wednesday: ["08:30", "16:30"],
        thursday: ["08:30", "16:30"],
        friday: null,
        saturday: null,
      },
    },
  ],
  referral_forms: [],
};

export const SEED_PROVIDERS: ProviderProfile[] = [provider1, provider2, provider3, provider4, provider5, provider6];

// ---------------------------------------------------------------------------
// Catalog items — derived from the skill taxonomy, 3 items per sub-domain.
// `provider_id` is left undefined (global reference catalog, per §5.3 —
// any provider whose specialty matches the domain can pick these items) —
// only a handful of items below are pinned to a specific demo provider, to
// keep demonstrating that a custom/provider-only catalog item is possible.
// ---------------------------------------------------------------------------
function buildCatalog(): CatalogItem[] {
  const items: CatalogItem[] = [];
  let tavarCode = 100000;
  for (const domain of SEED_SKILL_DOMAINS) {
    const subdomains = SEED_SKILL_SUBDOMAINS.filter((s) => s.domain_id === domain.id);

    for (const sub of subdomains) {
      items.push({
        id: generateId("cat"),
        tavar_code: String(tavarCode++),
        name_he: `ייעוץ ${domain.name_he} - ${sub.name_he}`,
        skill_domain_id: domain.id,
        skill_subdomain_id: sub.id,
        service_type: "consultation",
        base_price: 350 + Math.round(Math.random() * 150),
        typical_duration_min: 30,
        requires_referral: false,
        is_active: true,
      });

      items.push({
        id: generateId("cat"),
        tavar_code: String(tavarCode++),
        name_he: `בדיקת דימות - ${sub.name_he}`,
        skill_domain_id: domain.id,
        skill_subdomain_id: sub.id,
        service_type: "diagnostics",
        base_price: 900 + Math.round(Math.random() * 400),
        typical_duration_min: 45,
        requires_referral: true,
        is_active: true,
      });

      items.push({
        id: generateId("cat"),
        tavar_code: String(tavarCode++),
        name_he: `שירות נלווה - ${sub.name_he}`,
        skill_domain_id: domain.id,
        skill_subdomain_id: sub.id,
        service_type: "extra",
        base_price: 100 + Math.round(Math.random() * 150),
        typical_duration_min: 20,
        requires_referral: false,
        is_active: true,
      });
    }
  }

  // A few provider-pinned custom items (orthopedics/cardiology), demonstrating
  // the admin catalog's optional "ספק (אופציונלי)" field for a one-off item
  // that only that specific provider offers, on top of the global reference
  // catalog above.
  items.push({
    id: generateId("cat"),
    tavar_code: String(tavarCode++),
    name_he: "ייעוץ אורתופדי VIP - " + provider1.display_name,
    skill_domain_id: "dom_ortho",
    skill_subdomain_id: "sub_ortho_knee",
    service_type: "consultation",
    base_price: 600,
    typical_duration_min: 45,
    requires_referral: false,
    provider_id: provider1.id,
    is_active: true,
  });
  items.push({
    id: generateId("cat"),
    tavar_code: String(tavarCode++),
    name_he: "בדיקת מאמץ מתקדמת - " + provider2.display_name,
    skill_domain_id: "dom_cardio",
    skill_subdomain_id: "sub_cardio_general",
    service_type: "diagnostics",
    base_price: 1200,
    typical_duration_min: 60,
    requires_referral: true,
    provider_id: provider2.id,
    is_active: true,
  });

  return items;
}

export const SEED_CATALOG: CatalogItem[] = buildCatalog();

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

const B_INSURANCE_COMPANIES = ["כלל", "הראל", "מגדל"];

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
    kupah,
    k_level: hasK ? kLevels[i % kLevels.length] : undefined,
    has_b_insurance: hasB,
    b_insurance_company: hasB ? B_INSURANCE_COMPANIES[i % B_INSURANCE_COMPANIES.length] : undefined,
    b_policy_number: hasB ? `POL-${100000 + i * 91}` : undefined,
    status: i % 5 === 0 ? "לא פעיל" : i % 7 === 0 ? "ממתין" : "פעיל",
    assigned_provider: i % 3 === 0 ? provider1.id : i % 3 === 1 ? provider2.id : undefined,
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
SEED_PATIENTS[0].has_b_insurance = true;
SEED_PATIENTS[0].b_insurance_company = "מגדל";
SEED_PATIENTS[0].b_policy_number = "POL-100000";

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
const SERVICE_NAMES = [
  "ייעוץ אורתופדי - ברך",
  "בדיקת מאמץ",
  "ייעוץ קרדיולוגי כללי",
  "אקו לב",
  "חוות דעת שנייה",
  "בדיקת MRI לברך",
];

export const SEED_APPOINTMENTS: Appointment[] = Array.from({ length: 24 }).map(
  (_, i) => {
    const dayOffset = Math.floor(i / 3) - 4; // spread -4..+3 days
    const provider = i % 2 === 0 ? provider1 : provider2;
    const patient = SEED_PATIENTS[i % SEED_PATIENTS.length];
    const hour = 8 + (i % 9);
    const statusPool: Appointment["status"][] = [
      "ממתין לתשלום מקדמה",
      "מאושר",
      "שולם במלואו",
      "בוצע",
      "בוטל",
    ];
    const status = statusPool[i % statusPool.length];
    const item = SEED_CATALOG[i % SEED_CATALOG.length];
    const resolved = resolveCatalogPrice(item.base_price, patient);
    const depositPaid = status === "מאושר" || status === "שולם במלואו" || status === "בוצע";
    return {
      id: generateId("appt"),
      client_name: patient.full_name,
      client_phone: patient.phone,
      provider_id: provider.id,
      provider_name: provider.display_name,
      service_name: SERVICE_NAMES[i % SERVICE_NAMES.length],
      date: isoDateDaysFromNow(dayOffset),
      time: `${String(hour).padStart(2, "0")}:00`,
      duration_minutes: 30,
      status,
      price: resolved.price,
      deposit_amount: Math.round(resolved.price * 0.3),
      // Alternate between "still inside the 48h refund window" and "long past
      // it" so the demo data shows both cancellation-policy states.
      deposit_paid_at: depositPaid ? isoTimestampHoursFromNow(i % 2 === 0 ? -10 : -96) : undefined,
      kupah: patient.kupah,
      notes: "",
      created_by_id: patient.id,
    };
  }
);

// ---------------------------------------------------------------------------
// Orders — final price resolved from the reference catalog price by the
// booking patient's SKBH layer, with Healson's commission split out.
// ---------------------------------------------------------------------------
export const SEED_ORDERS: Order[] = SEED_APPOINTMENTS.slice(0, 16).map(
  (appt, i) => {
    const item = SEED_CATALOG[i % SEED_CATALOG.length];
    const patient = SEED_PATIENTS.find((p) => p.id === appt.created_by_id);
    const resolved = resolveCatalogPrice(item.base_price, patient);
    const provider = SEED_PROVIDERS.find((p) => p.id === appt.provider_id);
    const commissionRate = provider?.commission_rate ?? 15;
    const commissionAmount = Math.round((resolved.price * commissionRate) / 100);
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
      item_id: item.id,
      item_name: appt.service_name,
      provider_id: appt.provider_id,
      provider_name: appt.provider_name,
      created_by_id: appt.created_by_id,
      patient_name: appt.client_name,
      final_price: resolved.price,
      status,
      created_date: isoDateDaysFromNow(-i * 3),
      payment_status: status === "הושלם" ? "שולם במלואו" : status === "בוטל" ? "הוחזר" : "מקדמה שולמה",
      deposit_amount: Math.round(resolved.price * 0.3),
      balance_amount: Math.round(resolved.price * 0.7),
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      provider_payout_amount: resolved.price - commissionAmount,
    };
  }
);

// ---------------------------------------------------------------------------
// Lab referrals
// ---------------------------------------------------------------------------
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
    return {
      id: generateId("lab"),
      provider_id: provider.id,
      provider_name: provider.display_name,
      patient_id: patient.id,
      patient_name: patient.full_name,
      test_types: provider.exam_types.length
        ? [provider.exam_types[0].name]
        : ["בדיקת דם כללית"],
      lab_code: provider.exam_types[0]?.lab_code ?? "GEN-01",
      status,
      created_date: isoDateDaysFromNow(-i * 5),
      completed_date: status === "הושלם" ? isoDateDaysFromNow(-i * 5 + 2) : undefined,
      notes: "",
      results: status === "הושלם" ? "תקין, ללא ממצאים חריגים" : undefined,
    };
  }
);

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
  {
    id: generateId("doc"),
    patient_id: demoPatient.id,
    category: "receipt",
    title: "חשבונית - ייעוץ אורתופדי",
    uploaded_by: "system",
    appointment_id: demoDocAppointments[1]?.id,
    created_date: isoDateDaysFromNow(-14),
    file: { file_name: "חשבונית_1042.pdf", uploaded_at: isoDateDaysFromNow(-14), data_url: "data:application/pdf;base64," },
  },
  {
    id: generateId("doc"),
    patient_id: demoPatient.id,
    category: "receipt",
    title: "קבלה - מקדמה על תור",
    uploaded_by: "system",
    created_date: isoDateDaysFromNow(-3),
    file: { file_name: "קבלה_2231.pdf", uploaded_at: isoDateDaysFromNow(-3), data_url: "data:application/pdf;base64," },
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
