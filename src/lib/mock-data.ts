import {
  Appointment,
  Branch,
  CatalogItem,
  Lead,
  LabReferral,
  Order,
  Patient,
  ProviderProfile,
  User,
} from "@/types";
import { generateId, isoDateDaysFromNow } from "./utils";
import { MEDICAL_TREE } from "./medical-tree";

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
  created_date: isoDateDaysFromNow(-500),
};

export const SEED_USERS: User[] = [
  DEMO_PATIENT_USER,
  DEMO_PROVIDER_USER,
  DEMO_ADMIN_USER,
];

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
  is_active: true,
  created_date: isoDateDaysFromNow(-400),
  consultation_types: [
    {
      id: generateId("ct"),
      name: "ייעוץ קרדיולוגי כללי",
      duration_minutes: 30,
      prices: [
        { kupah: "כללית", price: 420 },
        { kupah: "מכבי", price: 400 },
        { kupah: "מאוחדת", price: 410 },
        { kupah: "לאומית", price: 430 },
      ],
    },
    {
      id: generateId("ct"),
      name: "בדיקת מאמץ",
      duration_minutes: 45,
      prices: [
        { kupah: "כללית", price: 650 },
        { kupah: "מכבי", price: 620 },
        { kupah: "מאוחדת", price: 640 },
        { kupah: "לאומית", price: 660 },
      ],
    },
  ],
  exam_types: [
    {
      id: generateId("et"),
      name: "אקו לב",
      lab_code: "ECHO-01",
      prices: [
        { kupah: "כללית", price: 800 },
        { kupah: "מכבי", price: 780 },
        { kupah: "מאוחדת", price: 790 },
        { kupah: "לאומית", price: 810 },
      ],
    },
  ],
  clinic_locations: [
    {
      id: generateId("clinic"),
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
  is_active: true,
  created_date: isoDateDaysFromNow(-600),
  consultation_types: [
    {
      id: generateId("ct"),
      name: "ייעוץ אורתופדי - ברך",
      duration_minutes: 30,
      prices: [
        { kupah: "כללית", price: 450 },
        { kupah: "מכבי", price: 430 },
        { kupah: "מאוחדת", price: 440 },
        { kupah: "לאומית", price: 460 },
      ],
    },
    {
      id: generateId("ct"),
      name: "חוות דעת שנייה",
      duration_minutes: 20,
      prices: [
        { kupah: "כללית", price: 380, discount: 10 },
        { kupah: "מכבי", price: 360 },
        { kupah: "מאוחדת", price: 370 },
        { kupah: "לאומית", price: 390 },
      ],
    },
  ],
  exam_types: [
    {
      id: generateId("et"),
      name: "בדיקת MRI לברך",
      lab_code: "MRI-KNEE",
      prices: [
        { kupah: "כללית", price: 1200 },
        { kupah: "מכבי", price: 1150 },
        { kupah: "מאוחדת", price: 1180 },
        { kupah: "לאומית", price: 1220 },
      ],
    },
  ],
  clinic_locations: [
    {
      id: generateId("clinic"),
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
  is_published: false,
  is_active: true,
  created_date: isoDateDaysFromNow(-40),
  consultation_types: [],
  exam_types: [],
  clinic_locations: [],
  referral_forms: [],
};

export const SEED_PROVIDERS: ProviderProfile[] = [provider1, provider2, provider3];

// ---------------------------------------------------------------------------
// Catalog items — derived from the medical tree, 1-3 items per sub-domain.
// ---------------------------------------------------------------------------
function buildCatalog(): CatalogItem[] {
  const items: CatalogItem[] = [];
  let code = 1000;
  for (const domain of MEDICAL_TREE) {
    for (const sub of domain.subDomains) {
      const staff =
        domain.key === "orthopedics"
          ? provider1.display_name
          : domain.key === "cardiology"
          ? provider2.display_name
          : provider3.display_name;

      items.push({
        id: generateId("cat"),
        item_name: `ייעוץ ${domain.label} - ${sub.label}`,
        item_code: `CAT-${code++}`,
        domain: domain.label,
        sub_domain: sub.label,
        service_type: "ייעוץ",
        staff_name: staff,
        is_active: true,
        price_K: [
          { kupah: "כללית", price: 350 + Math.round(Math.random() * 150) },
          { kupah: "מכבי", price: 330 + Math.round(Math.random() * 150) },
          { kupah: "מאוחדת", price: 340 + Math.round(Math.random() * 150) },
          { kupah: "לאומית", price: 360 + Math.round(Math.random() * 150) },
        ],
      });

      items.push({
        id: generateId("cat"),
        item_name: `בדיקת דימות - ${sub.label}`,
        item_code: `CAT-${code++}`,
        domain: domain.label,
        sub_domain: sub.label,
        service_type: "דימות",
        staff_name: staff,
        is_active: true,
        price_K: [
          { kupah: "כללית", price: 900 + Math.round(Math.random() * 400) },
          { kupah: "מכבי", price: 870 + Math.round(Math.random() * 400) },
          { kupah: "מאוחדת", price: 880 + Math.round(Math.random() * 400), discount: 5 },
          { kupah: "לאומית", price: 910 + Math.round(Math.random() * 400) },
        ],
      });
    }
  }
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

export const SEED_PATIENTS: Patient[] = PATIENT_NAMES.map((name, i) => ({
  id: generateId("pat"),
  full_name: name,
  email: `${name.split(" ")[0]}${i}@example.co.il`,
  phone: `05${i % 2 === 0 ? "2" : "4"}-${1000000 + i * 1234}`,
  id_number: `${200000000 + i * 37}`,
  kupah: (["כללית", "מכבי", "מאוחדת", "לאומית"] as const)[i % 4],
  status: i % 5 === 0 ? "לא פעיל" : i % 7 === 0 ? "ממתין" : "פעיל",
  assigned_provider: i % 3 === 0 ? provider1.id : i % 3 === 1 ? provider2.id : undefined,
  created_date: isoDateDaysFromNow(-i * 17),
  user_id: i === 0 ? DEMO_PATIENT_USER.id : undefined,
}));

// Make sure demo patient user has a matching Patient record.
SEED_PATIENTS[0].full_name = DEMO_PATIENT_USER.full_name;
SEED_PATIENTS[0].email = DEMO_PATIENT_USER.email;
SEED_PATIENTS[0].status = "פעיל";

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
      "ממתין לאישור",
      "מאושר",
      "מאושר",
      "הושלם",
      "בוטל",
    ];
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
      status: statusPool[i % statusPool.length],
      kupah: patient.kupah,
      notes: "",
      created_by_id: patient.id,
    };
  }
);

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export const SEED_ORDERS: Order[] = SEED_APPOINTMENTS.slice(0, 16).map(
  (appt, i) => {
    const item = SEED_CATALOG[i % SEED_CATALOG.length];
    const statusPool: Order["status"][] = [
      "ממתין",
      "מאושר",
      "בביצוע",
      "הושלם",
      "בוטל",
    ];
    return {
      id: generateId("ord"),
      item_id: item.id,
      item_name: appt.service_name,
      provider_id: appt.provider_id,
      provider_name: appt.provider_name,
      created_by_id: appt.created_by_id,
      patient_name: appt.client_name,
      final_price: item.price_K.find((p) => p.kupah === appt.kupah)?.price ?? 400,
      status: statusPool[i % statusPool.length],
      created_date: isoDateDaysFromNow(-i * 3),
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
// Branches
// ---------------------------------------------------------------------------
export const SEED_BRANCHES: Branch[] = [
  { id: generateId("branch"), name: "סניף תל אביב", city: "תל אביב", address: "איבן גבירול 50" },
  { id: generateId("branch"), name: "סניף רמת גן", city: "רמת גן", address: "ביאליק 12" },
  { id: generateId("branch"), name: "סניף חיפה", city: "חיפה", address: "הרצל 8" },
];
