"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Mail,
  User as UserIcon,
  Phone,
  PhoneCall,
  Stethoscope,
  HeartPulse,
  ClipboardPlus,
  Store,
  Hospital,
  Building2,
  Network,
  FlaskConical,
  Shield,
  ShieldCheck,
  BadgeCheck,
  Upload,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Layers,
  PartyPopper,
  FileText,
  Sparkles,
  Rocket,
  XCircle,
  Clock,
  Save,
  Lock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { ProviderLayout } from "@/components/layouts/ProviderLayout";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { DemoPanel } from "@/components/provider/DemoPanel";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { useStore } from "@/lib/store";
import { useRequireRole } from "@/lib/useRequireRole";
import { useCurrentProvider } from "@/lib/useCurrentPatient";
import { fileToDataUrl } from "@/lib/file";
import {
  PROVIDER_CATEGORIES,
  PROVIDER_TYPE_ICONS,
  ProviderCategory,
  categoryForType,
  getCategory,
} from "@/lib/provider-categories";
import {
  DOCTOR_SUBTYPES,
  DOCTOR_SUBTYPE_LABELS,
  DoctorSubtype,
  KupahArrangement,
  PRIVATE_INSURANCE_COMPANIES,
  ProviderType,
  PROVIDER_TYPE_SERVICE_CATEGORIES,
  UploadedFile,
} from "@/types";
import { KupahArrangementPicker, MultiSelectPills } from "@/components/provider/KupahArrangementPicker";

type Phase = "category" | "type" | "form" | "otp" | "email" | "success";

const TITLES = ['ד"ר', "פרופ'"];

const SPECIALTIES = [
  "אונקולוגיה",
  "אורולוגיה",
  "אורתופדיה",
  "אלרגולוגיה ואימונולוגיה קלינית",
  "אנדוקרינולוגיה",
  "אף אוזן וגרון",
  "גינקולוגיה ומיילדות",
  "גסטרואנטרולוגיה",
  "גריאטריה",
  "דרמטולוגיה (רפואת עור)",
  "הרדמה וטיפול נמרץ",
  "כירורגיה כללית",
  "כירורגיה פלסטית",
  "כירורגיית לב-חזה",
  "מחלות זיהומיות",
  "נוירוכירורגיה",
  "נוירולוגיה",
  "נפרולוגיה",
  "פנימית",
  "פסיכיאטריה",
  "פתולוגיה",
  "קרדיולוגיה",
  "ראומטולוגיה",
  "רדיולוגיה",
  "רפואה דחופה",
  "רפואת ילדים",
  "רפואת משפחה",
  "רפואת עיניים",
  "רפואת ריאות",
  "שיקום",
];

const SUBSPECIALTIES_BY_SPECIALTY: Record<string, string[]> = {
  "אונקולוגיה": ["אונקולוגיה כללית", "אונקולוגיה של השד", "אונקולוגיה גינקולוגית", "אונקולוגיה של מערכת העיכול", "המטו-אונקולוגיה", "אונקולוגיית ריאה"],
  "אורולוגיה": ["אורולוגיה כללית", "אורו-אונקולוגיה", "אנדרולוגיה", "אבנים בדרכי השתן", "אורולוגיה של האישה", "אורולוגיית ילדים"],
  "אורתופדיה": ["כתף", "ברך", "ירך", "כף רגל וקרסול", "עמוד שדרה", "יד וכף יד", "אורתופדיית ילדים", "רפואת ספורט"],
  "אלרגולוגיה ואימונולוגיה קלינית": ["אלרגיות מזון", "אסתמה ונשימה", "אימונולוגיה קלינית", "אלרגיה בילדים"],
  "אנדוקרינולוגיה": ["סוכרת", "בלוטת התריס", "אוסטאופורוזיס", "השמנה ומטבוליזם", "אנדוקרינולוגיית רבייה"],
  "אף אוזן וגרון": ["אף וסינוסים", "אוזניים ושמיעה", "גרון וקול", "שינה ונחירות", "אף אוזן גרון ילדים"],
  "גינקולוגיה ומיילדות": ["מיילדות", "פוריות", "אונקוגינקולוגיה", "אורוגינקולוגיה", "גיל המעבר"],
  "גסטרואנטרולוגיה": ["קולונוסקופיה ואנדוסקופיה", "מחלות כבד", "מעי רגיז ומעי דלקתי", "גסטרואנטרולוגיית ילדים"],
  "גריאטריה": ["גריאטריה כללית", "דמנציה וזיכרון", "שיקום גריאטרי"],
  "דרמטולוגיה (רפואת עור)": ["דרמטולוגיה כללית", "דרמטולוגיה אסתטית", "דרמטו-אונקולוגיה", "פסוריאזיס ומחלות עור כרוניות", "דרמטולוגיית ילדים"],
  "הרדמה וטיפול נמרץ": ["הרדמה כללית", "טיפול נמרץ", "טיפול בכאב", "הרדמה לילדים"],
  "כירורגיה כללית": ["כירורגיה בריאטרית", "כירורגיית בטן", "כירורגיית שד", "כירורגיה זעיר פולשנית"],
  "כירורגיה פלסטית": ["כירורגיה אסתטית", "שחזור לאחר סרטן שד", "כירורגיית כוויות", "כירורגיית יד"],
  "כירורגיית לב-חזה": ["ניתוחי לב פתוח", "ניתוחי ריאה", "צנתורים טיפוליים"],
  "מחלות זיהומיות": ["מחלות זיהומיות כלליות", "HIV ואיידס", "זיהומים לאחר ניתוח", "רפואת נסיעות וחיסונים"],
  "נוירוכירורגיה": ["ניתוחי עמוד שדרה", "ניתוחי מוח", "נוירוכירורגיה תפקודית"],
  "נוירולוגיה": ["כאבי ראש ומיגרנה", "אפילפסיה", "שבץ מוחי", "פרקינסון ותנועה", "טרשת נפוצה", "נוירולוגיית ילדים"],
  "נפרולוגיה": ["אי ספיקת כליות", "דיאליזה", "השתלת כליה", "יתר לחץ דם"],
  "פנימית": ["רפואה פנימית כללית", "אבחון מורכב", "ניהול מחלות כרוניות"],
  "פסיכיאטריה": ["פסיכיאטריית מבוגרים", "פסיכיאטריית ילדים ונוער", "פסיכוגריאטריה", "התמכרויות", "פסיכיאטריה משפטית"],
  "פתולוגיה": ["פתולוגיה כירורגית", "ציטולוגיה", "פתולוגיה מולקולרית"],
  "קרדיולוגיה": ["קרדיולוגיה התערבותית", "הפרעות קצב", "אי ספיקת לב", "מחלות לב מולדות במבוגרים", "קרדיולוגיית ילדים"],
  "ראומטולוגיה": ["דלקת מפרקים שגרונית", "זאבת", "אוסטאופורוזיס", "פיברומיאלגיה"],
  "רדיולוגיה": ["רדיולוגיה כללית", "CT ו-MRI", "רדיולוגיה התערבותית", "אולטרסאונד", "מיפויים גרעיניים"],
  "רפואה דחופה": ["טראומה", "רפואה דחופה לילדים", "טוקסיקולוגיה"],
  "רפואת ילדים": ["ילדים כללי", "נאונטולוגיה (פגים)", "גסטרואנטרולוגיית ילדים", "אלרגיה בילדים", "התפתחות הילד"],
  "רפואת משפחה": ["רפואת משפחה כללית", "רפואה מונעת", "רפואת נשים במשפחה", "גריאטריה קהילתית"],
  "רפואת עיניים": ["קטרקט", "רשתית", "גלאוקומה", "קרנית", "ניתוחי לייזר", "עיניים ילדים"],
  "רפואת ריאות": ["אסתמה ו-COPD", "שינה ודום נשימה", "סרטן ריאה", "שחפת וזיהומים"],
  "שיקום": ["שיקום אורתופדי", "שיקום נוירולוגי", "שיקום לב", "שיקום ילדים"],
};

const NURSE_SPECIALTIES = [
  "סיעוד כללי",
  "סיעוד פרטי / טיפול בית",
  "סיעוד גריאטרי",
  "סיעוד ילדים",
  "סיעוד אונקולוגי",
  "סיעוד פצע וסטומה",
  "סיעוד טיפול נמרץ",
  "סיעוד בריאות הנפש",
  "סיעוד קהילתי",
  "סיעוד תעסוקתי",
  "סיעוד מחלקתי / בית חולים",
];

const COMPLEMENTARY_TYPES = [
  "פיזיותרפיה",
  "דיאטנות קלינית",
  "רפלקסולוגיה",
  "שיאצו",
  "נטורופתיה",
  "דיקור סיני",
  "כירופרקטיקה",
  "ריפוי בעיסוק",
  "קלינאות תקשורת",
  "הידרותרפיה",
  "אחר",
];

// "מטפל/ת" covers both nurses and complementary/alternative-medicine
// therapists — "סיעוד" is the umbrella option that reveals NURSE_SPECIALTIES
// as a second-level pick (see SUBSPECIALTIES_BY_SPECIALTY below).
const CAREGIVER_TYPES = ["סיעוד", ...COMPLEMENTARY_TYPES];

const LAB_TEST_TYPES = ["בדיקות דם", "בדיקות שתן", "בדיקות גנטיות", "בדיקות פתולוגיה", "בדיקות מיקרוביולוגיה", "אחר"];

const CALL_CENTER_SERVICES = [
  "טריאז' טלפוני",
  "ייעוץ רפואי מרחוק",
  "מוקד חירום",
  "תמיכה בניהול מחלות כרוניות",
  "אחר",
];

const INSURANCE_AGENCY_SERVICES = [
  "ביטוחי בריאות פרטיים",
  "ביטוחי שיניים",
  "ביטוחי סיעוד",
  "ביטוחי נסיעות ומחלות קשות",
  "אחר",
];

SUBSPECIALTIES_BY_SPECIALTY["סיעוד"] = NURSE_SPECIALTIES;

const STORE_CATEGORIES = [
  "ציוד רפואי ביתי ושיקומי",
  "ניידות ונגישות",
  "אורתופדיה",
  "אופטיקה",
  "שמיעה",
  "דחיסה רפואית",
  "סטומה, אורולוגיה ומוצרי ספיגה",
  "בריאות האישה",
  "בריאות הפה ודנטל",
  "רפואת שינה",
  "סוכרת",
  "נשימה וחמצן",
  "פצעים וחבישות",
  "ציוד לתינוק ולאם",
  "טלרפואה וניטור מרחוק",
  "רפואת עור ומוצרי טיפוח רפואי",
  "תזונה, ויטמינים ותוספים",
  "עזרה ראשונה והיגיינה רפואית",
  "אחר",
];

const STORE_SUBTYPES_BY_CATEGORY: Record<string, string[]> = {
  "ציוד רפואי ביתי ושיקומי": [
    "ציוד לטיפול ביתי (מיטות חשמליות, מזרנים למניעת פצעי לחץ, עגלות טיפול)",
    "ציוד שיקום נוירולוגי (שיווי משקל, גירוי מוטורי, עזרי תפקוד)",
    "ציוד פיזיותרפיה (גומיות, כדורים, מכשירי אימון, שולחנות טיפול)",
    "ציוד ספורט רפואי (קינזיו טייפ, סדים, מגנים, ציוד התאוששות)",
  ],
  "ניידות ונגישות": ["הליכונים וכיסאות גלגלים", "קביים ומקלות הליכה", "מאחזים ומעקות", "רמפות", "כיסאות רחצה ומעלונים"],
  "אורתופדיה": ["מדרסים ונעליים רפואיות", "סדים ותומכים אורתופדיים", "מגנים ואביזרי הגנה"],
  "דחיסה רפואית": ["גרבי לחץ", "שרוולי לחץ", "מחוכים רפואיים"],
  "סטומה, אורולוגיה ומוצרי ספיגה": ["שקיות סטומה ואביזרי הדבקה", "קטטרים ושקיות שתן", "חיתולים למבוגרים ומשטחי ספיגה"],
  "בריאות האישה": ["פסריים", "משאבות חלב", "אביזרי שיקום רצפת האגן"],
  "בריאות הפה ודנטל": ["מברשות שיניים חשמליות", "סילוניות", "מגני לילה"],
  "רפואת שינה": ["מכשירי CPAP ומסכות", "כריות ומזרנים ארגונומיים"],
  "סוכרת": ["מדי סוכר ומקלוני בדיקה", "משאבות אינסולין וחיישני סוכר"],
  "נשימה וחמצן": ["מרכזי חמצן ניידים", "משאפים ומכשירי אינהלציה"],
  "פצעים וחבישות": ["פלסטרים וחומרי חיטוי", "תחבושות וג'לים לכוויות", "מוצרים לצלקות"],
  "ציוד לתינוק ולאם": ["ציוד הנקה", "מוניטורים לתינוק", "ציוד בטיחות לתינוק"],
  "טלרפואה וניטור מרחוק": ['אק"ג ביתי', "מאזניים חכמים", "מדי לחץ דם ומדי חמצן מחוברי אפליקציה"],
  "רפואת עור ומוצרי טיפוח רפואי": [
    "קרמים רפואיים ומוצרים לעור רגיש",
    "מוצרים לאחר טיפולי לייזר / כוויות",
    "הגנה מהשמש (קרמים, ספריי, שפתוני SPF)",
  ],
  "תזונה, ויטמינים ותוספים": ["ויטמינים ומינרלים", "פרוביוטיקה ואומגה 3", "תוספי תזונה נוספים"],
  "עזרה ראשונה והיגיינה רפואית": ["ערכות עזרה ראשונה", "תכשירי חיטוי ושטיפות רפואיות"],
};

const SURGERY_TYPES = ["כירורגיה קטנה", "כירורגיה בינונית", "כירורגיה גדולה/מורכבת — רק בבית חולים"];

// Outpatient clinics and medical institutes each have their own service
// vocabulary — defined once in @/types (PROVIDER_TYPE_SERVICE_CATEGORIES) and
// reused by the provider's own catalog editor, so what's picked here is
// exactly what shows up later in the portal.
const OUTPATIENT_SERVICE_TYPES = PROVIDER_TYPE_SERVICE_CATEGORIES.outpatient_clinic ?? [];
const INSTITUTE_SERVICE_TYPES = PROVIDER_TYPE_SERVICE_CATEGORIES.medical_institute ?? [];

interface TypeFieldConfig {
  icon: React.ReactNode;
  label: string;
  description: string;
  nameLabel: string;
  showTitle?: boolean;
  showContactName?: boolean;
  contactNameLabel?: string;
  contactNameRequired?: boolean;
  contactNameFirst?: boolean;
  showContactPhone?: boolean;
  showContactEmail?: boolean;
  specialtyLabel: string;
  specialtyOptions: string[];
  multiSpecialty?: boolean;
  freeTextSpecialty?: boolean;
  showBusinessRegNumber?: boolean;
  businessRegRequired?: boolean;
  showLicenseNumber?: boolean;
  licenseNumberLabel: string;
  licenseFileLabel: string;
  licenseFileRequired?: boolean;
  // When set, showLicenseNumber / showKupot / showPrivateInsurance /
  // showContactName / showContactPhone / showContactEmail /
  // showBusinessRegNumber only apply once the applicant has picked this
  // specific value as their `specialty` — used by "caregiver" so the richer
  // (ex-nurse) form only appears once "סיעוד" is selected, while other care
  // types keep the leaner (ex-complementary) form.
  licenseOnlyForSpecialty?: string;
  showKupot?: boolean;
  showPrivateInsurance?: boolean;
  showSubSpecialties?: boolean;
  showLocationCount?: boolean;
  // Hospitals are composed of other provider types, but the applicant doesn't
  // declare them: Healson's ops team maps and links them after onboarding.
  // This renders that as a read-only explanation, never as a picker.
  showOrganizationCompositionNote?: boolean;
  // Explains, in the application itself, that this provider type operates
  // under a parent medical organization Healson links it to.
  parentOrganizationNote?: string;
  excludeOnlineServiceArea?: boolean;
  extraServiceAreas?: string[];
}

// "pharmacy" stays in the ProviderType union/model for backward compatibility
// but is intentionally omitted here — it will resurface later as a
// sub-category under "store".
const TYPE_CONFIG: Partial<Record<ProviderType, TypeFieldConfig>> = {
  doctor: {
    icon: <Stethoscope className="h-5 w-5" />,
    label: "רופא/ה",
    description: "רופא/ה עצמאי/ת עם רישיון עיסוק ממשרד הבריאות",
    nameLabel: "שם מלא",
    showTitle: true,
    showContactName: true,
    contactNameLabel: "שם איש קשר (לא חובה)",
    contactNameRequired: false,
    showContactPhone: true,
    showContactEmail: true,
    specialtyLabel: "תחום התמחות",
    specialtyOptions: SPECIALTIES,
    licenseNumberLabel: "מספר רישיון רפואי",
    licenseFileLabel: "קובץ רישיון רפואי (PDF / JPG / PNG)",
    showBusinessRegNumber: true,
    businessRegRequired: false,
    showKupot: true,
    showPrivateInsurance: true,
    showSubSpecialties: true,
    showLocationCount: true,
  },
  caregiver: {
    icon: <HeartPulse className="h-5 w-5" />,
    label: "מטפל/ת",
    description: "אח/ות, מטפל/ת משלים/ה או נותן/ת טיפול תומך אחר",
    nameLabel: "שם מלא",
    showContactName: true,
    contactNameLabel: "שם איש קשר (לא חובה)",
    contactNameRequired: false,
    showContactPhone: true,
    showContactEmail: true,
    specialtyLabel: "סוג טיפול",
    specialtyOptions: CAREGIVER_TYPES,
    showSubSpecialties: true,
    licenseOnlyForSpecialty: "סיעוד",
    licenseNumberLabel: "מספר רישיון סיעוד (משרד הבריאות)",
    licenseFileLabel: "רישיון סיעוד / תעודת הסמכה (PDF / JPG / PNG)",
    showBusinessRegNumber: true,
    businessRegRequired: false,
    showKupot: true,
    showPrivateInsurance: true,
    showLocationCount: true,
    extraServiceAreas: ["עד הבית"],
  },
  store: {
    icon: <Store className="h-5 w-5" />,
    label: "חנות לממכר מוצרי בריאות",
    description: "חנות מוצרי בריאות, ציוד רפואי, אופטיקה ומוצרי טיפוח רפואי",
    nameLabel: "שם העסק",
    showContactName: true,
    contactNameLabel: "שם איש קשר",
    showContactPhone: true,
    showContactEmail: true,
    specialtyLabel: "קטגוריית החנות",
    specialtyOptions: STORE_CATEGORIES,
    showSubSpecialties: true,
    showBusinessRegNumber: true,
    licenseNumberLabel: "מספר רישיון עסק",
    licenseFileLabel: "רישיון עסק (PDF / JPG / PNG)",
    showLocationCount: true,
  },
  hospital: {
    icon: <Hospital className="h-5 w-5" />,
    label: "בית חולים",
    description: "בית חולים / מרכז רפואי המפעיל מחלקות אשפוז, מרפאות חוץ וחדרי ניתוח",
    nameLabel: "שם בית החולים",
    showContactName: true,
    contactNameLabel: "שם איש קשר",
    contactNameFirst: true,
    specialtyLabel: "סוג רישיון ניתוחי",
    specialtyOptions: SURGERY_TYPES,
    multiSpecialty: true,
    showBusinessRegNumber: true,
    licenseNumberLabel: "מספר רישיון עסק (משרד הבריאות)",
    licenseFileLabel: "רישיון משרד הבריאות (PDF / JPG / PNG)",
    showKupot: true,
    showPrivateInsurance: true,
    showLocationCount: true,
    showOrganizationCompositionNote: true,
    excludeOnlineServiceArea: true,
  },
  outpatient_clinic: {
    icon: <Network className="h-5 w-5" />,
    label: "מרפאות חוץ",
    description: "רשת מרפאות חוץ / מרפאות קהילתיות המפעילה מספר סניפים ושירותים",
    nameLabel: "שם הרשת / המרפאה",
    showContactName: true,
    contactNameLabel: "שם איש קשר",
    specialtyLabel: "סוג הפריטים במרפאה",
    specialtyOptions: OUTPATIENT_SERVICE_TYPES,
    multiSpecialty: true,
    showBusinessRegNumber: true,
    licenseNumberLabel: "מספר רישיון מרפאה (משרד הבריאות)",
    licenseFileLabel: "רישיון משרד הבריאות (PDF / JPG / PNG)",
    showKupot: true,
    showPrivateInsurance: true,
    showLocationCount: true,
    parentOrganizationNote:
      "מרפאות חוץ משויכות לארגון רפואי. לאחר השלמת ההצטרפות, צוות Healson יקשר את המרפאה לארגון הרלוונטי במערכת.",
    excludeOnlineServiceArea: true,
  },
  medical_institute: {
    icon: <Building2 className="h-5 w-5" />,
    label: "מכון רפואי",
    description: "מכון רפואי / מכון אבחוני",
    nameLabel: "שם המכון",
    showContactName: true,
    contactNameLabel: "שם איש קשר",
    specialtyLabel: "סוגי הפריטים במכון",
    specialtyOptions: INSTITUTE_SERVICE_TYPES,
    multiSpecialty: true,
    showBusinessRegNumber: true,
    licenseNumberLabel: "מספר רישיון מכון (משרד הבריאות)",
    licenseFileLabel: "תעודת התאגדות (PDF / JPG / PNG)",
    showKupot: true,
    showPrivateInsurance: true,
    showLocationCount: true,
    excludeOnlineServiceArea: true,
  },
  lab: {
    icon: <FlaskConical className="h-5 w-5" />,
    label: "מעבדה",
    description: "מעבדה רפואית לבדיקות דם, גנטיקה ואבחון",
    nameLabel: "שם המעבדה",
    showContactName: true,
    contactNameLabel: "שם איש קשר",
    specialtyLabel: "סוג הבדיקות",
    specialtyOptions: LAB_TEST_TYPES,
    multiSpecialty: true,
    showBusinessRegNumber: true,
    licenseNumberLabel: "מספר רישיון מעבדה (משרד הבריאות)",
    licenseFileLabel: "רישיון מעבדה ממשרד הבריאות (PDF / JPG / PNG)",
    showKupot: true,
    showPrivateInsurance: true,
    showLocationCount: true,
    excludeOnlineServiceArea: true,
  },
  medical_call_center: {
    icon: <PhoneCall className="h-5 w-5" />,
    label: "מוקד רפואי",
    description: "מוקד טלפוני למתן ייעוץ, טריאז' ותמיכה רפואית מרחוק",
    nameLabel: "שם המוקד",
    showContactName: true,
    contactNameLabel: "שם איש קשר",
    specialtyLabel: "סוג הפריטים במוקד",
    specialtyOptions: CALL_CENTER_SERVICES,
    multiSpecialty: true,
    showBusinessRegNumber: true,
    licenseNumberLabel: "מספר רישיון עסק / אישור הפעלה",
    licenseFileLabel: "רישיון עסק / אישור הפעלה (PDF / JPG / PNG)",
    showKupot: true,
    showPrivateInsurance: true,
    showLocationCount: true,
  },
  insurance_agency: {
    icon: <Shield className="h-5 w-5" />,
    label: "סוכנות ביטוח",
    description: "סוכנות המתווכת פוליסות ביטוח בריאות ושירותים משלימים",
    nameLabel: "שם הסוכנות",
    showContactName: true,
    contactNameLabel: "שם איש קשר",
    specialtyLabel: "סוג הפוליסות המתווכות",
    specialtyOptions: INSURANCE_AGENCY_SERVICES,
    multiSpecialty: true,
    showBusinessRegNumber: true,
    licenseNumberLabel: "מספר רישיון סוכן ביטוח (רשות שוק ההון)",
    licenseFileLabel: "רישיון סוכן ביטוח (PDF / JPG / PNG)",
    showPrivateInsurance: true,
    showLocationCount: true,
  },
};

const REGISTER_STEPS: { key: string; label: string; icon: ReactNode }[] = [
  { key: "type", label: "סוג ספק", icon: <Layers className="h-4 w-4" /> },
  { key: "otp", label: "אימות טלפון", icon: <ShieldCheck className="h-4 w-4" /> },
  { key: "email", label: "אימות אימייל", icon: <Mail className="h-4 w-4" /> },
  { key: "form", label: "פרטי הבקשה", icon: <ClipboardPlus className="h-4 w-4" /> },
  { key: "success", label: "סיום", icon: <PartyPopper className="h-4 w-4" /> },
];

function phaseToStepIndex(phase: Phase): number {
  if (phase === "category" || phase === "type") return 0;
  if (phase === "otp") return 1;
  if (phase === "email") return 2;
  if (phase === "form") return 3;
  return 4;
}

function RegisterStepper({ phase }: { phase: Phase }) {
  const activeIndex = phaseToStepIndex(phase);
  return (
    <div className="mb-6 flex items-start">
      {REGISTER_STEPS.map((step, i) => {
        const isDone = i < activeIndex;
        const isActive = i === activeIndex;
        return (
          <div key={step.key} className={`flex items-center ${i < REGISTER_STEPS.length - 1 ? "flex-1" : ""}`}>
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                animate={{
                  backgroundColor: isDone || isActive ? "var(--color-primary)" : "#f1f5f9",
                  color: isDone || isActive ? "#ffffff" : "#64748b",
                  scale: isActive ? 1.12 : 1,
                }}
                transition={{ duration: 0.25 }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm"
              >
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : step.icon}
              </motion.div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${isDone || isActive ? "text-slate-700" : "text-slate-500"}`}>
                {step.label}
              </span>
            </div>
            {i < REGISTER_STEPS.length - 1 && (
              <div className="relative mx-1 -mt-5 h-0.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  className="absolute inset-y-0 right-0 bg-primary"
                  initial={false}
                  animate={{ width: i < activeIndex ? "100%" : "0%" }}
                  transition={{ duration: 0.35 }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// The application (category → type → form → otp → submitted) renders INSIDE the
// provider portal shell — the provider already has a real account/session, so
// this stage is presented as a pending request within the portal, not as a
// standalone signup wizard. ProviderLayout supplies the header + stage badge
// ("בקשה בבדיקה") and keeps the operational nav locked until approval.
function RegisterShell({
  phase,
  wide,
  side,
  children,
}: {
  phase: Phase;
  wide?: boolean;
  /** Optional context rail (form phase) — turns the card into a real page. */
  side?: ReactNode;
  children: ReactNode;
}) {
  const card = (
    <div
      className={`w-full rounded-2xl border border-slate-200 p-6 shadow-lg transition-[max-width] duration-300 sm:p-8 ${
        // The form phase nests white section cards, so its shell goes soft-grey
        // for contrast; the standalone phases stay a plain white card.
        side ? "bg-slate-50/80" : wide ? "max-w-3xl bg-white" : "max-w-md bg-white"
      }`}
    >
      <RegisterStepper phase={phase} />
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -14 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
  return (
    <ProviderLayout>
      {/* Rebrand the whole application flow in one move: remap the primary/accent
          design tokens to the HEALSON navy + gold for this subtree, so every
          Button, stepper, tile and focus ring picks up the brand colours without
          touching each class individually. */}
      <div
        className="mx-auto flex w-full max-w-5xl flex-col items-center"
        style={
          {
            "--color-primary": "var(--brand-navy)",
            "--color-primary-dark": "var(--brand-navy-900)",
            "--color-accent": "var(--brand-gold)",
          } as React.CSSProperties
        }
      >
        {phase !== "otp" && phase !== "email" && phase !== "success" && (
          <div className="mb-5 w-full rounded-xl border border-[var(--brand-gold)]/30 bg-[var(--brand-gold)]/[0.07] px-4 py-3 text-sm text-[var(--brand-ink)]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-medium">שלב 2 בהצטרפות · פרטי הבקשה</p>
              <Link
                href="/provider/dashboard"
                className="flex items-center gap-1 text-xs font-medium text-[var(--brand-gold-deep)] hover:underline"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                חזרה ללוח ההצטרפות
              </Link>
            </div>
            <p className="mt-0.5 text-xs text-[var(--brand-ink-soft)]">
              החשבון שלך כבר נוצר ואת/ה בתוך הפורטל. אין צורך למלא הכול עכשיו — מה שתמלא/י נשמר, ואפשר לחזור
              ולהמשיך מתי שנוח. רק בסיום נשלחת הבקשה לבדיקת הרישיון של צוות Healson.
            </p>
          </div>
        )}
        {side ? (
          <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1fr)_290px] lg:items-start">
            {card}
            <aside className="lg:sticky lg:top-20">{side}</aside>
          </div>
        ) : (
          card
        )}
      </div>
    </ProviderLayout>
  );
}

function OtpInput({
  value,
  onChange,
  length = 6,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function setDigit(i: number, raw: string) {
    const clean = raw.replace(/\D/g, "").slice(-1);
    const next = digits.slice();
    next[i] = clean;
    onChange(next.join("").replace(/\s+$/, ""));
    if (clean && i < length - 1) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  }

  return (
    <div dir="ltr" className="flex justify-center gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="h-12 w-10 rounded-lg border border-slate-300 bg-white text-center text-lg font-semibold outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      ))}
    </div>
  );
}

function FormSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent-bg text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-3.5">{children}</div>
    </div>
  );
}

export default function ProviderRegisterPage() {
  const router = useRouter();
  const { ready, user } = useRequireRole("provider");
  const provider = useCurrentProvider();
  const upsertProviderProfile = useStore((s) => s.upsertProviderProfile);
  const beginProviderVerification = useStore((s) => s.beginProviderVerification);
  const verifyProviderPhoneOtp = useStore((s) => s.verifyProviderPhoneOtp);
  const resendProviderPhoneOtp = useStore((s) => s.resendProviderPhoneOtp);
  const sendProviderActivationEmail = useStore((s) => s.sendProviderActivationEmail);
  const verifyProviderActivationEmail = useStore((s) => s.verifyProviderActivationEmail);
  const resendProviderActivationEmail = useStore((s) => s.resendProviderActivationEmail);
  const finalizeProviderApplication = useStore((s) => s.finalizeProviderApplication);
  const updateCurrentUserDetails = useStore((s) => s.updateCurrentUserDetails);
  const demoApproveProvider = useStore((s) => s.demoApproveProvider);
  const demoRejectProvider = useStore((s) => s.demoRejectProvider);
  const verifyProviderLicense = useStore((s) => s.verifyProviderLicense);
  const showToast = useStore((s) => s.showToast);

  // Once Ops verifies the license, status moves to "onboarding" — send the
  // provider on to the dashboard, where onboarding now lives inline.
  const movedToOnboarding = ready && provider?.status === "onboarding";
  useEffect(() => {
    if (movedToOnboarding) router.replace("/provider/dashboard");
  }, [movedToOnboarding, router]);

  const [synced, setSynced] = useState(false);
  const [phase, setPhase] = useState<Phase>("category");
  // The application form is long — it's split into sub-steps (details →
  // extras → service area), each fitting roughly one viewport, with
  // per-step validation. formStep indexes into the formSteps array below.
  const [formStep, setFormStep] = useState(0);
  const [applicationProviderId, setApplicationProviderId] = useState<string | null>(null);
  const [demoOutcome, setDemoOutcome] = useState<"approved" | "rejected" | null>(null);
  const [category, setCategory] = useState<ProviderCategory | null>(null);
  const [providerType, setProviderType] = useState<ProviderType | null>(null);
  const [fullName, setFullName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [title, setTitle] = useState("ד\"ר");
  const [specialty, setSpecialty] = useState("");
  const [specialtyMulti, setSpecialtyMulti] = useState<string[]>([]);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [businessRegNumber, setBusinessRegNumber] = useState("");
  // Name + phone are pulled from the account created in step 1, but stay
  // editable here: an applicant who mistyped either — or whose account was
  // opened by someone else on their behalf — must be able to correct them
  // once they've picked their provider type, before the application is sent.
  // (Email stays read-only: it's the login identifier.)
  const [accountPhone, setAccountPhone] = useState(user?.phone ?? "");
  const email = user?.email ?? "";
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [doctorSubtype, setDoctorSubtype] = useState<DoctorSubtype>("physician");
  const [surgicalPrivilegesHospital, setSurgicalPrivilegesHospital] = useState("");
  const [kupahArrangements, setKupahArrangements] = useState<KupahArrangement[]>([]);
  const [privateInsurers, setPrivateInsurers] = useState<string[]>([]);
  const [subSpecialties, setSubSpecialties] = useState<string[]>([]);
  const [otherSubSpecialty, setOtherSubSpecialty] = useState("");
  const [locationCount, setLocationCount] = useState("");
  const [storeStructure, setStoreStructure] = useState<"single" | "chain">("single");
  const [otpCode, setOtpCode] = useState("");
  const [error, setErrorMessage] = useState("");
  const [errorField, setErrorField] = useState<"license" | "hospital" | "specialty" | null>(null);
  const [errorNonce, setErrorNonce] = useState(0);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);

  // The form is long — on validation failure the user is at the submit button
  // at the bottom while the error banner renders at the top. Scroll it into
  // view AND focus it (so screen readers announce it) every time an error is
  // raised (nonce bumps even when the same message repeats, so a second
  // failed submit still scrolls). `field` additionally highlights the exact
  // control the message is about, inline.
  function setError(message: string, field?: "license" | "hospital" | "specialty") {
    setErrorMessage(message);
    setErrorField(field ?? null);
    if (message) setErrorNonce((n) => n + 1);
  }

  useEffect(() => {
    if (errorNonce > 0) {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      errorRef.current?.focus({ preventScroll: true });
    }
  }, [errorNonce]);

  // (Re-)send the phone OTP whenever the "otp" phase is entered — right after
  // account creation on /apply, and when resuming a session that was left
  // mid-verification (see the resume-sync block above).
  useEffect(() => {
    if (phase === "otp" && applicationProviderId) {
      const result = beginProviderVerification(applicationProviderId);
      if (result.ok) {
        showToast("קוד אימות נשלח", { description: `קוד הדגמה: ${result.otpHint}`, variant: "success" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, applicationProviderId]);

  // (Re-)send the activation email whenever the "email" phase is entered —
  // both right after phone-OTP verification and when resuming a session that
  // was left mid-verification (see the resume-sync block above).
  useEffect(() => {
    if (phase === "email" && applicationProviderId) {
      sendProviderActivationEmail(applicationProviderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, applicationProviderId]);

  // Moving between sub-steps replaces the whole form content — without moving
  // focus, keyboard/screen-reader users are left on the now-gone submit
  // button. Focus the form (labeled with the current step) on each change;
  // the ref guard keeps initial mount from stealing focus.
  const formRef = useRef<HTMLFormElement | null>(null);
  const prevFormStepRef = useRef(formStep);
  useEffect(() => {
    if (prevFormStepRef.current === formStep) return;
    prevFormStepRef.current = formStep;
    formRef.current?.focus({ preventScroll: true });
  }, [formStep]);

  // One-time resume sync, run during render (not an effect) the first time
  // `ready`/`provider` become available — covers both a same-session
  // redirect straight from /apply (no hydration gap, fires on first render)
  // and a cold page load/refresh mid-registration (fires once hydration
  // completes on a later render). Adjusting state during render like this,
  // guarded so it only runs once, is React's sanctioned pattern for syncing
  // local state from an external source without the cascading-render issues
  // a useEffect-based version would have.
  if (ready && !synced) {
    setSynced(true);
    if (provider) setApplicationProviderId(provider.id);
    if (provider?.application_submitted_at) {
      setPhase("success");
    } else if (provider?.provider_type) {
      const type = provider.provider_type;
      const typeConfig = TYPE_CONFIG[type];
      setCategory(categoryForType(type));
      setProviderType(type);
      setFullName(provider.display_name ?? user?.full_name ?? "");
      setContactName(provider.contact_name ?? "");
      setContactPhone(provider.contact_phone ?? "");
      setContactEmail(provider.contact_email ?? "");
      setTitle(provider.title ?? "ד\"ר");
      if (typeConfig?.multiSpecialty) setSpecialtyMulti(provider.specialty ? provider.specialty.split(", ") : []);
      else setSpecialty(provider.specialty ?? "");
      setLicenseNumber(provider.license_number ?? "");
      setBusinessRegNumber(provider.business_reg_number ?? "");
      setDoctorSubtype(provider.doctor_subtype ?? "physician");
      setSurgicalPrivilegesHospital(provider.surgical_privileges_hospital ?? "");
      setKupahArrangements(provider.kupah_arrangements ?? []);
      setPrivateInsurers(provider.private_insurance_companies ?? []);
      setSubSpecialties(provider.sub_specialties ?? []);
      setLocationCount(provider.location_count != null ? String(provider.location_count) : "");
      setStoreStructure(type === "store" && (provider.location_count ?? 1) > 1 ? "chain" : "single");
      // Phone + email verification now happen right after the account is
      // created (before the rest of the application form, see /apply) —
      // resume wherever this applicant left off. The OTP/email are
      // (re-)sent from effects below, not here, since this branch runs
      // during render and shouldn't reach into the external store.
      if (!provider.phone_verified_at) setPhase("otp");
      else if (!provider.email_verified_at) setPhase("email");
      else setPhase("form");
    } else if (provider) {
      // No provider type yet — e.g. the Google demo shortcut, which lands
      // here without one (see loginWithGoogle). Every normal /apply signup
      // already carries a type, landing straight in the branch above.
      setFullName(provider.display_name ?? user?.full_name ?? "");
      setContactName(provider.contact_name ?? "");
      setContactPhone(provider.contact_phone ?? "");
      setContactEmail(provider.contact_email ?? "");
    }
  }

  if (!ready || !user || movedToOnboarding) {
    return <DashboardSkeleton />;
  }

  const config = providerType ? TYPE_CONFIG[providerType] : null;
  const isDoctor = providerType === "doctor";
  const isSurgeon = isDoctor && doctorSubtype === "surgeon";
  // For individual provider types the "name" field IS the person's name (and
  // therefore the account holder's); organizations name the business instead.
  const nameIsPerson = providerType === "doctor" || providerType === "caregiver";
  // See TypeFieldConfig.licenseOnlyForSpecialty — for "caregiver", the
  // richer (ex-nurse) fields only apply once "סיעוד" is picked as the
  // specialty; every other type has no gate and is always true.
  const extraFieldsGate = config?.licenseOnlyForSpecialty ? specialty === config.licenseOnlyForSpecialty : true;
  // Store subtypes are product groupings within a medical category; doctor/
  // caregiver subtypes are clinical sub-specialties — "תתי קטגוריה" fit neither.
  const subSpecialtyLabel = providerType === "store" ? "קטגוריה רפואית" : "תת-התמחות";
  // "רישיון סיעוד" only applies to nursing — every other caregiver specialty
  // (physio, dietetics, etc.) just needs a professional certification.
  const licenseFileLabel =
    providerType === "caregiver" && !extraFieldsGate
      ? "תעודת הסמכה (PDF / JPG / PNG)"
      : config?.licenseFileLabel ?? "";

  const showInsuranceSection = !!config && (config.showKupot || config.showPrivateInsurance) && extraFieldsGate;
  const hasExtrasStep = showInsuranceSection;
  // The "coverage" sub-step only exists when there's actually a coverage field
  // to fill (store branch structure, or a location count) — service areas were
  // removed from the application (real address→map linkage happens later, when
  // adding clinics), so a type with neither skips this step entirely.
  const hasAreaStep = !!config && (providerType === "store" || config.showLocationCount === true);
  const formSteps: { key: "details" | "extras" | "area"; label: string }[] = [
    { key: "details", label: "פרטים ורישוי" },
    ...(hasExtrasStep ? ([{ key: "extras", label: "כיסוי ביטוחי" }] as const) : []),
    ...(hasAreaStep ? ([{ key: "area", label: "פריסה" }] as const) : []),
  ];
  const safeFormStep = Math.min(formStep, formSteps.length - 1);
  const currentFormStepKey = formSteps[safeFormStep].key;
  const isLastFormStep = safeFormStep === formSteps.length - 1;

  // Custom validations for fields native `required` can't cover (file
  // uploads, pill multi-selects) — all belong to the "details" sub-step, and
  // re-checked on final submit as a safety net.
  function detailsStepError(): { field: "license" | "hospital" | "specialty"; message: string } | null {
    if (!config) return null;
    if (config.licenseFileRequired !== false && !licenseFile && !provider?.license_file) {
      return { field: "license", message: `נא לצרף ${licenseFileLabel.replace(/\s*\(.*\)$/, "")}` };
    }
    if (isSurgeon && !surgicalPrivilegesHospital) {
      return { field: "hospital", message: "רופא/ה מנתח/ת נדרש/ת לציין את בית החולים בו יש הרשאת ניתוח" };
    }
    if (config.multiSpecialty && specialtyMulti.length === 0) {
      return { field: "specialty", message: `נא לבחור לפחות אפשרות אחת עבור ${config.specialtyLabel}` };
    }
    return null;
  }

  // Everything typed so far is written to the profile as a DRAFT — on every
  // sub-step advance, and on "שמירה והמשך מאוחר יותר". Nothing here submits
  // the application (that's finalizeProviderApplication, from the last step
  // only), so the applicant can stop at any point and come back without
  // losing work — which is what the portal promises them.
  async function persistDraft(): Promise<boolean> {
    if (!providerType || !config || !provider) return false;
    let licenseFileRecord: UploadedFile | undefined;
    try {
      licenseFileRecord = licenseFile
        ? {
            file_name: licenseFile.name,
            uploaded_at: new Date().toISOString(),
            data_url: await fileToDataUrl(licenseFile),
          }
        : provider.license_file;
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהעלאת הקובץ");
      return false;
    }
    upsertProviderProfile(provider.user_id, {
      provider_type: providerType,
      display_name: fullName,
      contact_name: config.showContactName && extraFieldsGate ? contactName : undefined,
      contact_phone: config.showContactPhone && extraFieldsGate && contactPhone ? contactPhone : undefined,
      contact_email: config.showContactEmail && extraFieldsGate && contactEmail ? contactEmail : undefined,
      title: config.showTitle ? title : undefined,
      specialty: config.multiSpecialty ? specialtyMulti.join(", ") : specialty,
      license_number: config.showLicenseNumber === false || !extraFieldsGate ? undefined : licenseNumber,
      business_reg_number:
        config.showBusinessRegNumber && extraFieldsGate && businessRegNumber ? businessRegNumber : undefined,
      license_file: licenseFileRecord,
      doctor_subtype: isDoctor ? doctorSubtype : undefined,
      surgical_privileges_hospital: isSurgeon ? surgicalPrivilegesHospital : undefined,
      kupah_arrangements: config.showKupot && extraFieldsGate ? kupahArrangements : undefined,
      private_insurance_companies: config.showPrivateInsurance && extraFieldsGate ? privateInsurers : undefined,
      sub_specialties: config.showSubSpecialties
        ? subSpecialties.map((s) => (s === "אחר" && otherSubSpecialty.trim() ? otherSubSpecialty.trim() : s))
        : undefined,
      location_count: config.showLocationCount && locationCount ? Number(locationCount) : undefined,
    });
    // Mirror the (editable) identity details back onto the login account, so
    // the name/phone the applicant corrected here are the ones the platform
    // uses everywhere. For an organization the account holder is the contact
    // person, not the organization's own name.
    updateCurrentUserDetails({
      full_name: nameIsPerson ? fullName : contactName || user?.full_name,
      phone: accountPhone,
    });
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!providerType || !config || !provider) return;
    setError("");
    if (currentFormStepKey === "details" || isLastFormStep) {
      const stepError = detailsStepError();
      if (stepError) {
        setError(stepError.message, stepError.field);
        return;
      }
    }
    setLoading(true);
    const saved = await persistDraft();
    if (!saved) {
      setLoading(false);
      return;
    }
    // Not on the last sub-step yet — advance instead of submitting (native
    // `required` validation already ran on the visible fields).
    if (!isLastFormStep) {
      setLoading(false);
      setFormStep(safeFormStep + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // Phone + email were already verified right after the account was
    // created (see the "otp"/"email" phases below) — nothing left to check
    // here except the license number, one last time.
    const result = finalizeProviderApplication(provider.id);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "שגיאה בשליחת הבקשה");
      return;
    }
    setPhase("success");
  }

  async function handleSaveAndExit() {
    setError("");
    setLoading(true);
    const saved = await persistDraft();
    setLoading(false);
    if (!saved) return;
    showToast("הפרטים נשמרו", {
      description: "אפשר להמשיך מהמקום שבו עצרת בכל זמן — הבקשה עדיין לא נשלחה ל-Healson.",
      variant: "success",
    });
    router.push("/provider/dashboard");
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = verifyProviderPhoneOtp(otpCode);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה באימות");
        return;
      }
      setApplicationProviderId(result.providerId ?? null);
      setPhase("email");
      showToast("מייל הפעלת חשבון נשלח", { description: `נשלח לכתובת ${email}`, variant: "success" });
    }, 300);
  }

  function handleResend() {
    const otp = resendProviderPhoneOtp();
    if (otp) showToast("קוד חדש נשלח לטלפון", { description: `קוד הדגמה: ${otp}` });
  }

  function handleConfirmEmailLink() {
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = verifyProviderActivationEmail();
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה באימות");
        return;
      }
      // Phone + email are both verified now — the account is fully active
      // (a confirmation email was just sent, see the "email" phase copy).
      // Continue straight into the rest of the application instead of
      // stopping here.
      setPhase("form");
      showToast("החשבון הופעל בהצלחה", { description: "אפשר להמשיך למילוי פרטי הבקשה", variant: "success" });
    }, 300);
  }

  function handleResendActivationEmail() {
    const sent = resendProviderActivationEmail();
    if (sent) showToast("מייל הפעלת חשבון נשלח שוב", { description: `נשלח לכתובת ${email}` });
  }

  function handleDemoApprove() {
    if (!applicationProviderId) return;
    demoApproveProvider(applicationProviderId);
    setDemoOutcome("approved");
    router.push("/provider/dashboard");
  }

  function handleDemoReject() {
    if (!applicationProviderId) return;
    demoRejectProvider(applicationProviderId);
    setDemoOutcome("rejected");
  }

  // Demo shortcut that mirrors the real Ops "verify license" action instead
  // of demoApproveProvider's full skip-to-approved — lets the provider
  // actually walk through the onboarding wizard (agreements/pricing) rather
  // than landing fully published with nothing left to do.
  function handleDemoMoveToOnboarding() {
    if (!applicationProviderId) return;
    verifyProviderLicense(applicationProviderId);
  }

  function selectCategory(c: ProviderCategory) {
    setCategory(c);
    const types = getCategory(c).types;
    if (types.length === 1) {
      // "store" maps to exactly one ProviderType — skip the
      // redundant "type" sub-step and go straight to the form.
      selectType(types[0]);
    } else {
      setProviderType(null);
      setPhase("type");
    }
  }

  function selectType(t: ProviderType) {
    setProviderType(t);
    setFormStep(0);
    // For an individual the name field IS the account holder's name, so it
    // stays seeded from step 1. For an organization that field names the
    // business instead — move the person's name to the contact field and
    // clear the business name so it isn't pre-filled with a person.
    const isPerson = t === "doctor" || t === "caregiver";
    const newFullName = !isPerson && fullName === user?.full_name ? "" : fullName;
    setFullName(newFullName);
    setContactName(isPerson ? "" : user?.full_name ?? "");
    setContactPhone("");
    setContactEmail("");
    setSpecialty("");
    setSpecialtyMulti([]);
    setDoctorSubtype("physician");
    setSurgicalPrivilegesHospital("");
    setBusinessRegNumber("");
    setKupahArrangements([]);
    setPrivateInsurers([]);
    setSubSpecialties([]);
    setOtherSubSpecialty("");
    setLocationCount("");
    setStoreStructure("single");
    // Persist the type immediately — not just on the form's first "המשך" —
    // since phone/email verification (below) now happens BEFORE the rest of
    // the application form and needs a provider_type to resume against.
    // This fallback path (picking a type here rather than on /apply, e.g.
    // the Google demo shortcut) hasn't verified either yet.
    if (provider) {
      upsertProviderProfile(provider.user_id, {
        provider_type: t,
        display_name: isPerson ? newFullName : "",
        contact_name: isPerson ? undefined : user?.full_name,
      });
    }
    if (provider?.phone_verified_at && provider?.email_verified_at) setPhase("form");
    else if (provider?.phone_verified_at) setPhase("email");
    else setPhase("otp");
  }

  if (phase === "category") {
    return (
      <RegisterShell phase={phase} wide>
        <div className="mb-4">
          <h1 className="font-display text-xl font-bold text-[var(--brand-navy)]">ברוך/ה הבא/ה, {fullName || user.full_name}</h1>
          <p className="text-xs text-slate-500 mt-1">בחר/י את סוג הספק כדי להמשיך — לכל סוג יש פרטים שונים שנדרשים לאישור ראשוני</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {PROVIDER_CATEGORIES.map((cfg, i) => (
            <motion.button
              key={cfg.key}
              type="button"
              onClick={() => selectCategory(cfg.key)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.25 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.985 }}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-sm transition-all hover:border-primary hover:shadow-md"
            >
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent-bg text-primary shadow-inner">
                <cfg.icon className="h-6 w-6" />
              </span>
              <span className="text-sm font-bold text-slate-900">{cfg.label}</span>
              <span className="mt-1 text-xs leading-relaxed text-slate-500">{cfg.description}</span>
              <span className="mt-3 border-t border-dashed border-slate-200 pt-2.5 text-[11px] leading-relaxed text-slate-400">
                {cfg.examples}
              </span>
              <span className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary">
                בחירה
                <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180 transition-transform group-hover:-translate-x-0.5" />
              </span>
            </motion.button>
          ))}
        </div>
      </RegisterShell>
    );
  }

  if (phase === "type" && category) {
    const CategoryIcon = getCategory(category).icon;
    return (
      <RegisterShell phase={phase} wide>
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCategory(null);
              setPhase("category");
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent-bg text-primary"
            aria-label="חזרה לבחירת קטגוריה"
          >
            <CategoryIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-bold text-[var(--brand-navy)]">{getCategory(category).label}</h1>
            <p className="text-xs text-slate-500">בחר/י את סוג הספק המדויק כדי להמשיך</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCategory(null);
              setPhase("category");
            }}
            className="shrink-0 text-xs font-medium text-primary hover:underline"
          >
            שינוי קטגוריה
          </button>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {getCategory(category).types.map((value, i) => {
            const cfg = TYPE_CONFIG[value]!;
            const Icon = PROVIDER_TYPE_ICONS[value];
            return (
              <motion.button
                key={value}
                type="button"
                onClick={() => selectType(value)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                className="group flex items-start gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm transition-all hover:border-primary hover:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent-bg text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{cfg.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{cfg.description}</span>
                </span>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 rtl:rotate-180 transition-transform group-hover:-translate-x-0.5 group-hover:text-primary" />
              </motion.button>
            );
          })}
        </div>
      </RegisterShell>
    );
  }

  if (phase === "otp") {
    return (
      <RegisterShell phase={phase}>
        <div className="flex flex-col items-center text-center mb-5">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="font-display text-xl font-bold text-[var(--brand-navy)]">אימות מספר טלפון</h1>
          <p className="text-sm text-slate-500 mt-1">
            שלחנו קוד אימות בן 6 ספרות למספר <bdi className="font-medium text-slate-700">{accountPhone}</bdi>
          </p>
        </div>
        {error && (
          <div role="alert" className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
            {error}
          </div>
        )}
        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <OtpInput value={otpCode} onChange={setOtpCode} />
          <Button type="submit" loading={loading} className="w-full">
            אמת קוד
          </Button>
          <button type="button" onClick={handleResend} className="text-sm text-primary hover:underline text-center">
            שלח קוד מחדש
          </button>
        </form>
      </RegisterShell>
    );
  }

  if (phase === "email") {
    return (
      <RegisterShell phase={phase}>
        <div className="flex flex-col items-center text-center mb-5">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="font-display text-xl font-bold text-[var(--brand-navy)]">אימות כתובת אימייל</h1>
          <p className="text-sm text-slate-500 mt-1">
            שלחנו מייל הפעלת חשבון לכתובת <bdi className="font-medium text-slate-700">{email}</bdi>
          </p>
        </div>
        {error && (
          <div role="alert" className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
            {error}
          </div>
        )}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 mb-2 text-slate-500">
              <Mail className="h-4 w-4" />
              <span className="text-xs font-medium">מייל הדגמה מ-HEALSON</span>
            </div>
            <p className="text-sm text-slate-700 mb-3">
              לחצו על הקישור הבא כדי לאמת את כתובת האימייל ולהפעיל את החשבון.
            </p>
            <Button type="button" onClick={handleConfirmEmailLink} loading={loading} className="w-full">
              אשרו את החשבון שלי
            </Button>
          </div>
          <button
            type="button"
            onClick={handleResendActivationEmail}
            className="text-sm text-primary hover:underline text-center"
          >
            שלח מייל מחדש
          </button>
        </div>
      </RegisterShell>
    );
  }

  if (phase === "success") {
    const rejected = demoOutcome === "rejected" || provider?.status === "rejected";
    const approved = demoOutcome === "approved" || provider?.status === "onboarding";
    const roadmap = [
      { icon: <FileText className="h-4 w-4" />, label: "הבקשה נשלחה", done: true },
      { icon: <ShieldCheck className="h-4 w-4" />, label: "בדיקת רישיון ואישור ע\"י צוות Healson", done: approved || rejected },
      { icon: <Sparkles className="h-4 w-4" />, label: "השלמת קטלוג, הסכם ותמחור", done: false },
      { icon: <Rocket className="h-4 w-4" />, label: "עלייה לאוויר בפלטפורמה", done: false },
    ];
    
    return (
      <RegisterShell phase={phase}>
        <div className="flex flex-col items-center text-center gap-4 py-4">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className={`flex h-14 w-14 items-center justify-center rounded-full ${
              rejected
                ? "bg-danger-bg text-danger-text"
                : approved
                ? "bg-success-bg text-success-text"
                : "bg-info-bg text-info-text"
            }`}
          >
            {rejected ? <XCircle className="h-7 w-7" /> : approved ? <CheckCircle2 className="h-7 w-7" /> : <Clock className="h-7 w-7" />}
          </motion.div>

          {rejected ? (
            <>
              <h1 className="font-display text-xl font-bold text-[var(--brand-navy)]">הבקשה נדחתה</h1>
              <p className="text-sm text-slate-600 leading-relaxed max-w-md">
                {provider?.rejection_reason ??
                  "נמצאו פערים במסמכים שצורפו. אנא בדקו את ההודעה שנשלחה לאימייל שלכם להתעדכנות וניתן לנסות שוב."}
              </p>
              <Button variant="outline" onClick={() => router.push("/apply")} className="mt-4">
                חזרה לדף ההצטרפות
              </Button>
            </>
          ) : approved ? (
            <>
              <h1 className="font-display text-xl font-bold text-[var(--brand-navy)]">הרישיון אומת — ברוכים הבאים!</h1>
              <p className="text-sm text-slate-600 leading-relaxed max-w-md">
                הרישיון שלך אומת בהצלחה. כעת תוכל/י להשלים את חתימת ההסכם, הגדרת הקטלוג והמחירים שלך.
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-xl font-bold text-[var(--brand-navy)]">הבקשה נשלחה בהצלחה</h1>
              <p className="text-sm text-slate-600 leading-relaxed max-w-md">
                צוות Healson בודק כעת את הרישיון והמסמכים שצירפת — בדרך כלל תוך 24 שעות. נעדכן אותך ברגע
                שהבדיקה תסתיים, ואז ניתן יהיה להמשיך לחתימת ההסכם ולהגדרת הקטלוג.
              </p>
              <p className="text-xs text-slate-500 leading-relaxed max-w-md">
                שלחנו אליך גם מייל אישור לכתובת <bdi className="font-medium">{email}</bdi> — ניתן לעקוב משם אחר
                סטטוס הבקשה בכל שלב.
              </p>
            </>
          )}

          <div className="mt-4 w-full rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-right">
            <p className="mb-3 text-xs font-semibold text-slate-500 text-center">מהלך ההצטרפות</p>
            <div className="flex flex-col gap-3">
              {roadmap.map((step, i) => (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.1, duration: 0.25 }}
                  className="flex items-center gap-3"
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      step.done
                        ? "bg-success text-white"
                        : "bg-white border border-slate-300 text-slate-400"
                    }`}
                  >
                    {step.done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={`text-sm text-right ${step.done ? "text-slate-900 font-medium" : "text-slate-500"}`}>
                    {step.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Deliberately NOT a to-do list: none of these are actionable until
              Ops verifies the license, so they're presented as locked. */}
          {!rejected && !approved && (
            <div className="mt-4 w-full rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4 text-right">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Lock className="h-3.5 w-3.5" /> מה ייפתח אחרי אישור הרישיון
              </p>
              <ul className="space-y-1.5 text-right text-xs text-slate-500">
                <li>· חתימה על הסכם השירותים מול Healson</li>
                <li>· הסדרי ביטוח (קופות, ביטוח פרטי)</li>
                <li>· הפריטים או המוצרים שלכם</li>
                <li>· מיקומים (מרפאה, סניף וכו&apos;)</li>
                <li>· זמינות ושעות פעילות</li>
                <li>· בקשת פרסום סופית</li>
              </ul>
              <p className="mt-2.5 text-[11px] text-slate-400">
                אין צורך להתעסק בהם עכשיו — הם ייפתחו אוטומטית בלוח ההצטרפות ברגע שהבדיקה תסתיים.
              </p>
            </div>
          )}

          {applicationProviderId && demoOutcome === null && provider?.status === "pending_review" && (
            <DemoPanel className="mt-4 w-full" description="לצורך הדגמת המוצר בלבד — סמלץ את תשובת צוות Healson לבדיקת הרישיון:">
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={handleDemoMoveToOnboarding} variant="outline" className="flex-1 text-primary border-primary/40">
                  <Rocket className="h-4 w-4" /> העבר ל-Onboarding (דמו)
                </Button>
                <Button onClick={handleDemoApprove} className="flex-1 bg-success hover:bg-success-text">
                  <CheckCircle2 className="h-4 w-4" /> אשר את הספק (דמו)
                </Button>
                <Button onClick={handleDemoReject} variant="outline" className="flex-1 text-danger">
                  <XCircle className="h-4 w-4" /> דחה את הספק (דמו)
                </Button>
              </div>
            </DemoPanel>
          )}

          {!rejected && !approved && (
            <>
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                <Clock className="h-4 w-4 animate-pulse" /> ממתינים לבדיקת הרישיון מול צוות Healson…
              </div>
              <Button variant="outline" onClick={() => router.push("/provider/dashboard")}>
                <ArrowRight className="h-4 w-4" /> חזרה ללוח ההצטרפות
              </Button>
            </>
          )}

          {approved && (
            <Button onClick={() => router.push("/provider/dashboard")} className="mt-4">
              <Rocket className="h-4 w-4" /> המשך לשלב הבא
            </Button>
          )}
        </div>
      </RegisterShell>
    );
  }

  if (!config || !providerType) return null;

  const TypeIcon = PROVIDER_TYPE_ICONS[providerType];
  // The context rail: where you are in the form, what to have ready, and the
  // standing promise that nothing is sent until you say so.
  const formSide = (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold text-slate-500">שלבי הטופס</p>
        <ol className="flex flex-col gap-2.5">
          {formSteps.map((step, i) => (
            <li key={step.key} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  i < safeFormStep
                    ? "bg-success-bg text-success-text"
                    : i === safeFormStep
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {i < safeFormStep ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={`text-xs ${
                  i === safeFormStep ? "font-semibold text-slate-900" : "text-slate-500"
                }`}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Save className="h-3.5 w-3.5 text-primary" /> נשמר אוטומטית
        </p>
        <p className="text-[11px] leading-relaxed text-slate-600">
          כל מה שמילאת נשמר בכל מעבר בין שלבים, ואפשר לצאת ולחזור מתי שנוח. הבקשה נשלחת לצוות Healson רק
          בלחיצה על ״שליחת בקשה״.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Upload className="h-3.5 w-3.5 text-slate-400" /> מה כדאי להכין
        </p>
        <ul className="flex flex-col gap-1.5 text-[11px] leading-relaxed text-slate-500">
          {config.licenseFileRequired !== false && <li>· {licenseFileLabel.replace(/\s*\(.*\)$/, "")}</li>}
          {config.showLicenseNumber !== false && <li>· מספר רישיון בתוקף</li>}
          {config.showBusinessRegNumber && <li>· ח״פ / ע״מ של העסק</li>}
          {isSurgeon && <li>· בית החולים שבו יש הרשאת ניתוח</li>}
        </ul>
      </div>
    </div>
  );

  return (
    <RegisterShell phase={phase} side={formSide}>
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPhase("type")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent-bg text-primary transition-transform hover:scale-105"
          aria-label="חזרה לבחירת סוג ספק"
        >
          <TypeIcon className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold text-[var(--brand-navy)]">הצטרפות כ{config.label}</h1>
          <p className="text-xs text-slate-500">אלה הפרטים שצוות Healson צריך כדי לאמת את הרישיון שלך</p>
        </div>
        <button
          type="button"
          onClick={() => setPhase("type")}
          className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-primary hover:text-primary"
        >
          שינוי סוג
        </button>
      </div>

      {/* Mobile echo of the side rail's step list (the rail stacks below). */}
      {formSteps.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 lg:hidden">
          {formSteps.map((step, i) => (
            <span
              key={step.key}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                i === safeFormStep
                  ? "bg-primary/10 text-primary"
                  : i < safeFormStep
                  ? "bg-success-bg text-success-text"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {i < safeFormStep ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>{i + 1}.</span>}
              {step.label}
            </span>
          ))}
        </div>
      )}

      {error && (
        <div
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text outline-none"
        >
          {error}
        </div>
      )}

      {config.parentOrganizationNote && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-info-border bg-info-bg px-3.5 py-3 text-sm text-info-text">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="leading-relaxed">{config.parentOrganizationNote}</p>
        </div>
      )}

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        tabIndex={-1}
        aria-label={`שלב ${safeFormStep + 1} מתוך ${formSteps.length}: ${formSteps[safeFormStep].label}`}
        className="flex flex-col gap-4 outline-none"
      >
        {currentFormStepKey === "details" && (
        <>
        <FormSection icon={<UserIcon className="h-4 w-4" />} title="פרטים אישיים ויצירת קשר">
          {config.showTitle ? (
            <div className="grid grid-cols-3 gap-2">
              <Select
                label="תואר"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="col-span-1"
                required
              >
                {TITLES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <Input
                label={config.nameLabel}
                icon={<UserIcon className="h-4 w-4" />}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="col-span-2"
                required
              />
            </div>
          ) : (
            <Input
              label={config.nameLabel}
              icon={<UserIcon className="h-4 w-4" />}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          )}

          {isDoctor && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">סוג רופא/ה</span>
              <div className="flex gap-2">
                {DOCTOR_SUBTYPES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setDoctorSubtype(st)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      doctorSubtype === st
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {DOCTOR_SUBTYPE_LABELS[st]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {config.showContactName && config.contactNameFirst && extraFieldsGate && (
            <Input
              label={config.contactNameLabel}
              icon={<UserIcon className="h-4 w-4" />}
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              required={config.contactNameRequired !== false}
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="tel"
              label="טלפון (חשבון הכניסה שלך)"
              icon={<Phone className="h-4 w-4" />}
              value={accountPhone}
              onChange={(e) => setAccountPhone(e.target.value)}
              hint="קוד האימות יישלח למספר זה"
              required
            />
            <Input
              type="email"
              placeholder="you@example.com"
              label="אימייל (חשבון הכניסה שלך)"
              icon={<Mail className="h-4 w-4" />}
              value={email}
              hint="כתובת הכניסה לחשבון — לא ניתנת לשינוי כאן"
              disabled
            />
          </div>
          <p className="-mt-1 text-xs text-slate-500">
            {nameIsPerson
              ? "השם המלא והטלפון נמשכו מהחשבון שיצרת — ניתן לעדכן אותם כאן, והם יישמרו גם בפרטי החשבון."
              : "הטלפון ושם איש הקשר נמשכו מהחשבון שיצרת — ניתן לעדכן אותם כאן, והם יישמרו גם בפרטי החשבון."}
          </p>

          {config.showContactName && !config.contactNameFirst && extraFieldsGate && (
            <Input
              label={config.contactNameLabel}
              icon={<UserIcon className="h-4 w-4" />}
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              required={config.contactNameRequired !== false}
            />
          )}

          {(config.showContactPhone || config.showContactEmail) && extraFieldsGate && (
            <div className="grid gap-3 sm:grid-cols-2">
              {config.showContactPhone && (
                <Input
                  type="tel"
                  label="טלפון איש קשר (לא חובה)"
                  icon={<Phone className="h-4 w-4" />}
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              )}

              {config.showContactEmail && (
                <Input
                  type="email"
                  placeholder="you@example.com"
                  label="אימייל איש קשר (לא חובה)"
                  icon={<Mail className="h-4 w-4" />}
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              )}
            </div>
          )}
        </FormSection>

        <FormSection icon={<Stethoscope className="h-4 w-4" />} title="פרטי המקצוע והרישוי">
          {config.freeTextSpecialty ? (
            <Input
              label={config.specialtyLabel}
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              required
            />
          ) : config.multiSpecialty ? (
            <div className="flex flex-col gap-1.5">
              <MultiSelectPills
                label={config.specialtyLabel}
                options={config.specialtyOptions}
                value={specialtyMulti}
                onChange={(v) => {
                  setSpecialtyMulti(v);
                  if (errorField === "specialty") setError("");
                }}
              />
              {errorField === "specialty" && error && (
                <span className="text-xs text-danger-text">{error}</span>
              )}
            </div>
          ) : (
            <Select
              label={config.specialtyLabel}
              value={specialty}
              onChange={(e) => {
                setSpecialty(e.target.value);
                setSubSpecialties([]);
              }}
              required
            >
              <option value="">בחר/י {config.specialtyLabel}</option>
              {config.specialtyOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          )}

          <AnimatePresence initial={false}>
            {config.showSubSpecialties && specialty && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-3 overflow-hidden"
              >
                <MultiSelectPills
                  label={`${subSpecialtyLabel} (ניתן לבחור יותר מאחת)`}
                  options={[
                    ...(SUBSPECIALTIES_BY_SPECIALTY[specialty] ?? STORE_SUBTYPES_BY_CATEGORY[specialty] ?? []),
                    "אחר",
                  ]}
                  value={subSpecialties}
                  onChange={setSubSpecialties}
                />
                {subSpecialties.includes("אחר") && (
                  <Input
                    label={`פירוט ${subSpecialtyLabel} "אחר"`}
                    value={otherSubSpecialty}
                    onChange={(e) => setOtherSubSpecialty(e.target.value)}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {config.showOrganizationCompositionNote && (
            <div className="flex items-start gap-2 rounded-lg border border-info-border bg-info-bg px-3 py-2.5 text-xs text-info-text">
              <Network className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong className="font-semibold">סוגי הספקים הפועלים בארגון —</strong> אין צורך להזין אותם כאן.
                צוות Healson מזין ומקשר את הספקים הפועלים בארגון (מחלקות, מרפאות חוץ, מכונים ונותני שירות) לאחר
                השלמת ההצטרפות.
              </span>
            </div>
          )}

          {config.showBusinessRegNumber && extraFieldsGate && (
            <Input
              label={`מספר עוסק מורשה / ח"פ${config.businessRegRequired === false ? " (לא חובה)" : ""}`}
              icon={<BadgeCheck className="h-4 w-4" />}
              value={businessRegNumber}
              onChange={(e) => setBusinessRegNumber(e.target.value)}
              required={config.businessRegRequired !== false}
            />
          )}

          {config.showLicenseNumber !== false && extraFieldsGate && (
            <Input
              label={config.licenseNumberLabel}
              icon={<BadgeCheck className="h-4 w-4" />}
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              required
            />
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">{licenseFileLabel}</span>
            <FileDropzone
              file={licenseFile}
              onFileChange={(f) => {
                setLicenseFile(f);
                if (errorField === "license") setError("");
              }}
              existingFileName={provider?.license_file?.file_name}
              ariaLabel={licenseFileLabel.trim()}
            />
            {errorField === "license" && error && (
              <span className="text-xs text-danger-text">{error}</span>
            )}
          </div>

          <AnimatePresence initial={false}>
            {isSurgeon && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <Input
                  label="בית חולים / מוסד בו קיימת הרשאת ניתוח"
                  icon={<Building2 className="h-4 w-4" />}
                  value={surgicalPrivilegesHospital}
                  onChange={(e) => {
                    setSurgicalPrivilegesHospital(e.target.value);
                    if (errorField === "hospital") setError("");
                  }}
                  error={errorField === "hospital" ? error : undefined}
                  required
                />
              </motion.div>
            )}
          </AnimatePresence>
        </FormSection>
        </>
        )}

        {currentFormStepKey === "extras" && (
        <>
        <div className="rounded-lg bg-info-bg border border-info-border px-3 py-2 text-xs text-info-text">
          את הפרטים הבאים ניתן להשלים ולערוך גם מאוחר יותר, דרך הפורטל האישי, לאחר אישור הבקשה
        </div>

        {showInsuranceSection && (
          <FormSection icon={<Shield className="h-4 w-4" />} title="כיסוי ביטוחי">
            {config.showKupot && (
              <KupahArrangementPicker value={kupahArrangements} onChange={setKupahArrangements} />
            )}

            {config.showPrivateInsurance && (
              <MultiSelectPills
                label="עם אילו חברות ביטוח פרטיות יש הסדר (B)"
                options={PRIVATE_INSURANCE_COMPANIES}
                value={privateInsurers}
                onChange={setPrivateInsurers}
              />
            )}
          </FormSection>
        )}
        </>
        )}

        {currentFormStepKey === "area" && (
        <FormSection icon={<MapPin className="h-4 w-4" />} title="פריסה">
          {providerType === "store" ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">מבנה העסק</span>
              <div className="flex gap-2">
                {(
                  [
                    ["single", "סניף יחיד"],
                    ["chain", "רשת סניפים"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setStoreStructure(value);
                      if (value === "single") setLocationCount("1");
                      else if (locationCount === "1" || !locationCount) setLocationCount("");
                    }}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      storeStructure === value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {storeStructure === "chain" && (
                <Input
                  type="number"
                  min={2}
                  label="כמה סניפים יש ברשת?"
                  icon={<MapPin className="h-4 w-4" />}
                  value={locationCount}
                  onChange={(e) => setLocationCount(e.target.value)}
                />
              )}
            </div>
          ) : (
            config.showLocationCount && (
              <Input
                type="number"
                min={1}
                label="כמה מוקדי קבלה / מרפאות יש לך?"
                icon={<MapPin className="h-4 w-4" />}
                value={locationCount}
                onChange={(e) => setLocationCount(e.target.value)}
              />
            )
          )}
        </FormSection>
        )}

        <div className="mt-1 flex gap-2">
          {safeFormStep > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setError("");
                setFormStep(safeFormStep - 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              חזרה
            </Button>
          )}
          <Button type="submit" loading={loading} className="flex-1">
            {isLastFormStep ? "שליחת בקשה" : "המשך"}
          </Button>
        </div>

        {/* The escape hatch that makes "you don't have to finish now" real. */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Save className="h-3.5 w-3.5" />
            הפרטים נשמרים אוטומטית בכל שלב — הבקשה נשלחת ל-Healson רק בלחיצה על ״שליחת בקשה״.
          </p>
          <button
            type="button"
            onClick={handleSaveAndExit}
            disabled={loading}
            className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
          >
            שמירה והמשך מאוחר יותר
          </button>
        </div>
      </form>
    </RegisterShell>
  );
}
