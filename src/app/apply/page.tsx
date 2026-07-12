"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";
import { fileToDataUrl } from "@/lib/file";
import {
  DOCTOR_SUBTYPES,
  DOCTOR_SUBTYPE_LABELS,
  DoctorSubtype,
  KupahArrangement,
  ORGANIZATION_MEMBER_TYPES,
  PRIVATE_INSURANCE_COMPANIES,
  ProviderType,
  PROVIDER_TYPE_LABELS,
  UploadedFile,
} from "@/types";
import { KupahArrangementPicker, MultiSelectPills } from "@/components/provider/KupahArrangementPicker";

type Phase = "category" | "type" | "form" | "otp" | "success";

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
  "אחר",
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

const SERVICE_AREAS = [
  "תל אביב והמרכז",
  "ירושלים והסביבה",
  "חיפה והצפון",
  "באר שבע והדרום",
  "השרון",
  "השפלה",
  "יהודה ושומרון",
  "אונליין ",
];

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
const INSTITUTE_TYPES = ["טיפולים", "אבחונים", "בדיקות הדמיות", "מרפאות"];

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
  // showMedicalResume / showContactName / showContactPhone /
  // showContactEmail / showBusinessRegNumber only apply once the applicant
  // has picked this specific value as their `specialty` — used by
  // "caregiver" so the richer (ex-nurse) form only appears once "סיעוד" is
  // selected, while other care types keep the leaner (ex-complementary) form.
  licenseOnlyForSpecialty?: string;
  showDescription?: boolean;
  showMedicalResume?: boolean;
  showKupot?: boolean;
  showPrivateInsurance?: boolean;
  showSubSpecialties?: boolean;
  showLocationCount?: boolean;
  showMemberProviderTypes?: boolean;
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
    showDescription: true,
    showMedicalResume: true,
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
    showDescription: true,
    showMedicalResume: true,
    showBusinessRegNumber: true,
    businessRegRequired: false,
    showKupot: true,
    showPrivateInsurance: true,
    showLocationCount: true,
    extraServiceAreas: ["עד הבית"],
  },
  other_medical: {
    icon: <ClipboardPlus className="h-5 w-5" />,
    label: "נותן שירות רפואי אחר",
    description: "נותן שירות רפואי שאינו נכלל בקטגוריות הקיימות",
    nameLabel: "שם מלא",
    showContactName: true,
    contactNameLabel: "שם איש קשר (לא חובה)",
    contactNameRequired: false,
    showContactPhone: true,
    showContactEmail: true,
    specialtyLabel: "תיאור סוג השירות",
    specialtyOptions: [],
    freeTextSpecialty: true,
    showLicenseNumber: false,
    licenseNumberLabel: "מספר רישיון / תעודת הסמכה",
    licenseFileLabel: "רישיון / תעודת הסמכה מקצועית, אם קיימת (לא חובה, PDF / JPG / PNG)",
    licenseFileRequired: false,
    showDescription: true,
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
    showDescription: true,
    showKupot: true,
    showPrivateInsurance: true,
    showLocationCount: true,
    showMemberProviderTypes: true,
    excludeOnlineServiceArea: true,
  },
  outpatient_clinic: {
    icon: <Network className="h-5 w-5" />,
    label: "מרפאות חוץ",
    description: "רשת מרפאות חוץ / מרפאות קהילתיות המפעילה מספר סניפים ושירותים",
    nameLabel: "שם הרשת / המרפאה",
    showContactName: true,
    contactNameLabel: "שם איש קשר",
    specialtyLabel: "סוג השירותים במרפאה",
    specialtyOptions: INSTITUTE_TYPES,
    multiSpecialty: true,
    showBusinessRegNumber: true,
    licenseNumberLabel: "מספר רישיון מרפאה (משרד הבריאות)",
    licenseFileLabel: "רישיון משרד הבריאות (PDF / JPG / PNG)",
    showDescription: true,
    showKupot: true,
    showPrivateInsurance: true,
    showLocationCount: true,
    showMemberProviderTypes: true,
    excludeOnlineServiceArea: true,
  },
  medical_institute: {
    icon: <Building2 className="h-5 w-5" />,
    label: "מכון רפואי",
    description: "מכון רפואי / מכון אבחוני",
    nameLabel: "שם המכון",
    showContactName: true,
    contactNameLabel: " שם איש קשר ",
    specialtyLabel: "סוג המכון",
    specialtyOptions: INSTITUTE_TYPES,
    multiSpecialty: true,
    showBusinessRegNumber: true,
    licenseNumberLabel: "מספר רישיון מכון (משרד הבריאות)",
    licenseFileLabel: " תעודת התאגדות  (PDF / JPG / PNG)",
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
    specialtyLabel: "סוג השירותים במוקד",
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

type ProviderCategory = "individual" | "organization";

const CATEGORY_CONFIG: Record<ProviderCategory, { label: string; description: string; icon: React.ReactNode }> = {
  individual: {
    label: "ספק יחיד",
    description: "איש/אשת מקצוע עצמאי/ת או עסק בודד",
    icon: <UserIcon className="h-5 w-5" />,
  },
  organization: {
    label: "ארגון בריאות",
    description: "גוף המפעיל מספר מחלקות, סניפים או שירותים",
    icon: <Network className="h-5 w-5" />,
  },
};

const CATEGORY_TYPES: Record<ProviderCategory, ProviderType[]> = {
  individual: ["doctor", "caregiver", "other_medical", "store"],
  organization: ["hospital", "outpatient_clinic", "medical_institute", "lab", "medical_call_center", "insurance_agency"],
};

const APPLY_STEPS: { key: string; label: string; icon: ReactNode }[] = [
  { key: "type", label: "סוג ספק", icon: <Layers className="h-4 w-4" /> },
  { key: "form", label: "פרטי הבקשה", icon: <ClipboardPlus className="h-4 w-4" /> },
  { key: "otp", label: "אימות טלפון", icon: <ShieldCheck className="h-4 w-4" /> },
  { key: "success", label: "סיום", icon: <PartyPopper className="h-4 w-4" /> },
];

function phaseToStepIndex(phase: Phase): number {
  if (phase === "category" || phase === "type") return 0;
  if (phase === "form") return 1;
  if (phase === "otp") return 2;
  return 3;
}

function ApplyStepper({ phase }: { phase: Phase }) {
  const activeIndex = phaseToStepIndex(phase);
  return (
    <div className="mb-6 flex items-start">
      {APPLY_STEPS.map((step, i) => {
        const isDone = i < activeIndex;
        const isActive = i === activeIndex;
        return (
          <div key={step.key} className={`flex items-center ${i < APPLY_STEPS.length - 1 ? "flex-1" : ""}`}>
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                animate={{
                  backgroundColor: isDone || isActive ? "var(--color-primary)" : "#f1f5f9",
                  color: isDone || isActive ? "#ffffff" : "#94a3b8",
                  scale: isActive ? 1.12 : 1,
                }}
                transition={{ duration: 0.25 }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm"
              >
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : step.icon}
              </motion.div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${isDone || isActive ? "text-slate-700" : "text-slate-400"}`}>
                {step.label}
              </span>
            </div>
            {i < APPLY_STEPS.length - 1 && (
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

function ApplyShell({ phase, wide, children }: { phase: Phase; wide?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-slate-50 to-amber-50 p-4">
      <div className="mb-6">
        <Logo size={40} className="text-xl" />
      </div>
      <div
        className={`w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-lg transition-[max-width] duration-300 sm:p-8 ${
          wide ? "max-w-2xl" : "max-w-sm"
        }`}
      >
        <ApplyStepper phase={phase} />
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
      <p className="mt-6 text-xs text-slate-400">פלטפורמת ניהול שירותי בריאות בישראל © 2026</p>
    </div>
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
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export default function ProviderApplyPage() {
  const router = useRouter();
  const applyAsProvider = useStore((s) => s.applyAsProvider);
  const verifyProviderApplicationOtp = useStore((s) => s.verifyProviderApplicationOtp);
  const resendProviderApplicationOtp = useStore((s) => s.resendProviderApplicationOtp);
  const demoApproveProvider = useStore((s) => s.demoApproveProvider);
  const demoRejectProvider = useStore((s) => s.demoRejectProvider);
  const showToast = useStore((s) => s.showToast);

  const [phase, setPhase] = useState<Phase>("category");
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
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [doctorSubtype, setDoctorSubtype] = useState<DoctorSubtype>("physician");
  const [surgicalPrivilegesHospital, setSurgicalPrivilegesHospital] = useState("");
  const [description, setDescription] = useState("");
  const [medicalResumeFile, setMedicalResumeFile] = useState<File | null>(null);
  const [kupahArrangements, setKupahArrangements] = useState<KupahArrangement[]>([]);
  const [privateInsurers, setPrivateInsurers] = useState<string[]>([]);
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [subSpecialties, setSubSpecialties] = useState<string[]>([]);
  const [otherSubSpecialty, setOtherSubSpecialty] = useState("");
  const [locationCount, setLocationCount] = useState("");
  const [memberProviderTypes, setMemberProviderTypes] = useState<ProviderType[]>([]);
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const config = providerType ? TYPE_CONFIG[providerType] : null;
  const isDoctor = providerType === "doctor";
  const isSurgeon = isDoctor && doctorSubtype === "surgeon";
  // See TypeFieldConfig.licenseOnlyForSpecialty — for "caregiver", the
  // richer (ex-nurse) fields only apply once "סיעוד" is picked as the
  // specialty; every other type has no gate and is always true.
  const extraFieldsGate = config?.licenseOnlyForSpecialty ? specialty === config.licenseOnlyForSpecialty : true;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!providerType || !config) return;
    setError("");
    if (config.licenseFileRequired !== false && !licenseFile) {
      setError(`נא לצרף ${config.licenseFileLabel.replace(/\s*\(.*\)$/, "")}`);
      return;
    }
    if (isSurgeon && !surgicalPrivilegesHospital) {
      setError("רופא/ה מנתח/ת נדרש/ת לציין את בית החולים בו יש הרשאת ניתוח");
      return;
    }
    if (config.showMemberProviderTypes && memberProviderTypes.length === 0) {
      setError("נא לבחור לפחות סוג ספק אחד הפועל בארגון");
      return;
    }
    if (config.multiSpecialty && specialtyMulti.length === 0) {
      setError(`נא לבחור לפחות אפשרות אחת עבור ${config.specialtyLabel}`);
      return;
    }
    setLoading(true);
    const licenseFileRecord: UploadedFile | undefined = licenseFile
      ? {
          file_name: licenseFile.name,
          uploaded_at: new Date().toISOString(),
          data_url: await fileToDataUrl(licenseFile),
        }
      : undefined;
    const medicalResumeFileRecord: UploadedFile | undefined = medicalResumeFile
      ? {
          file_name: medicalResumeFile.name,
          uploaded_at: new Date().toISOString(),
          data_url: await fileToDataUrl(medicalResumeFile),
        }
      : undefined;
    const result = applyAsProvider({
      provider_type: providerType,
      full_name: fullName,
      contact_name: config.showContactName && extraFieldsGate ? contactName : undefined,
      contact_phone: config.showContactPhone && extraFieldsGate && contactPhone ? contactPhone : undefined,
      contact_email: config.showContactEmail && extraFieldsGate && contactEmail ? contactEmail : undefined,
      title: config.showTitle ? title : undefined,
      specialty: config.multiSpecialty ? specialtyMulti.join(", ") : specialty,
      license_number: config.showLicenseNumber === false || !extraFieldsGate ? undefined : licenseNumber,
      business_reg_number:
        config.showBusinessRegNumber && extraFieldsGate && businessRegNumber ? businessRegNumber : undefined,
      phone,
      email,
      license_file: licenseFileRecord,
      doctor_subtype: isDoctor ? doctorSubtype : undefined,
      surgical_privileges_hospital: isSurgeon ? surgicalPrivilegesHospital : undefined,
      description: config.showDescription ? description : undefined,
      medical_resume_file: config.showMedicalResume && extraFieldsGate ? medicalResumeFileRecord : undefined,
      kupah_arrangements: config.showKupot && extraFieldsGate ? kupahArrangements : undefined,
      private_insurance_companies: config.showPrivateInsurance && extraFieldsGate ? privateInsurers : undefined,
      service_areas: serviceAreas,
      sub_specialties: config.showSubSpecialties
        ? subSpecialties.map((s) => (s === "אחר" && otherSubSpecialty.trim() ? otherSubSpecialty.trim() : s))
        : undefined,
      location_count: config.showLocationCount && locationCount ? Number(locationCount) : undefined,
      member_provider_types: config.showMemberProviderTypes ? memberProviderTypes : undefined,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "שגיאה בשליחת הבקשה");
      return;
    }
    setPhase("otp");
    showToast("קוד אימות נשלח", { description: `קוד הדגמה: ${result.otpHint}`, variant: "success" });
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = verifyProviderApplicationOtp(otpCode);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה באימות");
        return;
      }
      setApplicationProviderId(result.providerId ?? null);
      setPhase("success");
    }, 300);
  }

  function handleResend() {
    const otp = resendProviderApplicationOtp();
    if (otp) showToast("קוד חדש נשלח לטלפון", { description: `קוד הדגמה: ${otp}` });
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

  function selectCategory(c: ProviderCategory) {
    setCategory(c);
    setProviderType(null);
    setPhase("type");
  }

  function selectType(t: ProviderType) {
    setProviderType(t);
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setSpecialty("");
    setSpecialtyMulti([]);
    setDoctorSubtype("physician");
    setSurgicalPrivilegesHospital("");
    setBusinessRegNumber("");
    setDescription("");
    setMedicalResumeFile(null);
    setKupahArrangements([]);
    setPrivateInsurers([]);
    setServiceAreas([]);
    setSubSpecialties([]);
    setOtherSubSpecialty("");
    setLocationCount("");
    setMemberProviderTypes([]);
    setPhase("form");
  }

  if (phase === "category") {
    return (
      <ApplyShell phase={phase}>
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-slate-900">הצטרף כנותן שירות ל-Healson</h1>
          <p className="text-xs text-slate-500 mt-1">בחר/י את סוג הספק כדי להמשיך — לכל סוג יש פרטים שונים שנדרשים לאישור ראשוני</p>
        </div>
        <div className="flex flex-col gap-2">
          {(Object.entries(CATEGORY_CONFIG) as [ProviderCategory, (typeof CATEGORY_CONFIG)[ProviderCategory]][]).map(
            ([value, cfg], i) => (
              <motion.button
                key={value}
                type="button"
                onClick={() => selectCategory(value)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                className="group flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-right hover:border-primary hover:bg-primary/5 hover:shadow-sm transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700">
                  {cfg.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{cfg.label}</p>
                  <p className="text-xs text-slate-500 truncate">{cfg.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 rtl:rotate-180 transition-transform group-hover:-translate-x-0.5" />
              </motion.button>
            )
          )}
        </div>
        <p className="mt-5 text-center text-sm text-slate-500">
          כבר יש לך חשבון?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            התחבר
          </Link>
        </p>
      </ApplyShell>
    );
  }

  if (phase === "type" && category) {
    return (
      <ApplyShell phase={phase}>
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCategory(null);
              setPhase("category");
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
            aria-label="חזרה לבחירת קטגוריה"
          >
            {CATEGORY_CONFIG[category].icon}
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-slate-900">{CATEGORY_CONFIG[category].label}</h1>
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
        <div className="flex flex-col gap-2">
          {CATEGORY_TYPES[category].map((value, i) => {
            const cfg = TYPE_CONFIG[value]!;
            return (
              <motion.button
                key={value}
                type="button"
                onClick={() => selectType(value)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                className="group flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-right hover:border-primary hover:bg-primary/5 hover:shadow-sm transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700">
                  {cfg.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{cfg.label}</p>
                  <p className="text-xs text-slate-500 truncate">{cfg.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 rtl:rotate-180 transition-transform group-hover:-translate-x-0.5" />
              </motion.button>
            );
          })}
        </div>
        <p className="mt-5 text-center text-sm text-slate-500">
          כבר יש לך חשבון?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            התחבר
          </Link>
        </p>
      </ApplyShell>
    );
  }

  if (phase === "otp") {
    return (
      <ApplyShell phase={phase}>
        <div className="flex flex-col items-center text-center mb-5">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">אימות מספר טלפון</h1>
          <p className="text-sm text-slate-500 mt-1">
            שלחנו קוד אימות בן 6 ספרות למספר <bdi className="font-medium text-slate-700">{phone}</bdi>
          </p>
        </div>
        {error && (
          <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
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
      </ApplyShell>
    );
  }

  if (phase === "success") {
    const roadmap = [
      { icon: <FileText className="h-4 w-4" />, label: "הבקשה נשלחה", done: true },
      { icon: <ShieldCheck className="h-4 w-4" />, label: "בדיקת רישיון ואישור ע\"י צוות Healson", done: false },
      { icon: <Sparkles className="h-4 w-4" />, label: "השלמת קטלוג שירותים והסכם התקשרות", done: false },
      { icon: <Rocket className="h-4 w-4" />, label: "עלייה לאוויר בפלטפורמה", done: false },
    ];
    return (
      <ApplyShell phase={phase}>
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success-text"
          >
            <CheckCircle2 className="h-7 w-7" />
          </motion.div>
          <h1 className="text-lg font-semibold text-slate-900">בקשתך נשלחה בהצלחה</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            צוות Healson יבדוק את הפרטים והרישיון שצירפת. נעדכן אותך במייל ובהודעת טקסט כשהבדיקה תושלם ותוכל/י להמשיך
            להשלמת פרטי ההצטרפות + קישור, שם משתמש וסיסמא למערכת (הסדרי ביטוח, קטלוג שירותים, מיקומים והסכם).
          </p>

          <div className="mt-2 w-full rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-right">
            <p className="mb-3 text-xs font-semibold text-slate-500">מה קורה עכשיו</p>
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
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      step.done ? "bg-success text-white" : "bg-white border border-slate-200 text-slate-400"
                    }`}
                  >
                    {step.done ? <CheckCircle2 className="h-4 w-4" /> : step.icon}
                  </div>
                  <span className={`text-sm ${step.done ? "text-slate-900 font-medium" : "text-slate-500"}`}>
                    {step.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {applicationProviderId && demoOutcome === null && (
            <div className="mt-2 w-full rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-4 text-right">
              <p className="mb-1 text-xs font-semibold text-amber-700">מצב הדגמה</p>
              <p className="mb-3 text-xs text-amber-700/80">
                לצורך הדגמת המוצר בלבד — דלג/י על בדיקת הרישיון האמיתית וסמלץ את תשובת צוות Healson:
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={handleDemoApprove} className="flex-1">
                  <CheckCircle2 className="h-4 w-4" /> אשר את הספק (דמו)
                </Button>
                <Button onClick={handleDemoReject} variant="outline" className="flex-1">
                  <XCircle className="h-4 w-4" /> דחה את הספק (דמו)
                </Button>
              </div>
            </div>
          )}

          {demoOutcome === "rejected" && (
            <div className="mt-2 w-full rounded-xl border border-danger-border bg-danger-bg p-4 text-right text-danger-text">
              <p className="mb-1 text-sm font-semibold">הבקשה נדחתה (הדגמה)</p>
              <p className="text-xs leading-relaxed">
                לצורך ההדגמה, צוות Healson דחה את הבקשה — נמצאו פערים במסמכים שצורפו. במערכת אמיתית לא ניתן יהיה
                להתחבר עם חשבון זה.
              </p>
            </div>
          )}

          <Link href="/login" className="mt-2 text-sm font-medium text-primary hover:underline">
            חזרה למסך הכניסה
          </Link>
        </div>
      </ApplyShell>
    );
  }

  if (!config || !providerType) return null;

  const showInsuranceSection = (config.showKupot || config.showPrivateInsurance) && extraFieldsGate;

  return (
    <ApplyShell phase={phase} wide>
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPhase("type")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
          aria-label="חזרה לבחירת סוג ספק"
        >
          {config.icon}
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-slate-900">הצטרפות כ{config.label}</h1>
          <p className="text-xs text-slate-500">הפרטים הבאים נדרשים לאישור ראשוני מול הצוות</p>
        </div>
        <button
          type="button"
          onClick={() => setPhase("type")}
          className="shrink-0 text-xs font-medium text-primary hover:underline"
        >
          שינוי סוג
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              label="מספר טלפון"
              icon={<Phone className="h-4 w-4" />}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <Input
              type="email"
              placeholder="you@example.com"
              label="אימייל"
              icon={<Mail className="h-4 w-4" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

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
            <MultiSelectPills
              label={config.specialtyLabel}
              options={config.specialtyOptions}
              value={specialtyMulti}
              onChange={setSpecialtyMulti}
            />
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
                  label={isDoctor ? "תתי התמחות (ניתן לבחור יותר מאחת)" : "תתי קטגוריה (ניתן לבחור יותר מאחת)"}
                  options={[
                    ...(SUBSPECIALTIES_BY_SPECIALTY[specialty] ?? STORE_SUBTYPES_BY_CATEGORY[specialty] ?? []),
                    "אחר",
                  ]}
                  value={subSpecialties}
                  onChange={setSubSpecialties}
                />
                {subSpecialties.includes("אחר") && (
                  <Input
                    label={isDoctor ? 'פירוט תת התמחות "אחר"' : 'פירוט קטגוריה "אחר"'}
                    value={otherSubSpecialty}
                    onChange={(e) => setOtherSubSpecialty(e.target.value)}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {config.showMemberProviderTypes && (
            <MultiSelectPills
              label="אילו סוגי ספקים פועלים בארגון (ניתן לבחור יותר מאחד)"
              options={ORGANIZATION_MEMBER_TYPES}
              value={memberProviderTypes}
              onChange={(v) => setMemberProviderTypes(v as ProviderType[])}
              getLabel={(t) => PROVIDER_TYPE_LABELS[t as ProviderType]}
            />
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

          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            {config.licenseFileLabel}
            <span className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-600 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
              <Upload className="h-4 w-4 shrink-0" />
              <span className="truncate">{licenseFile ? licenseFile.name : "בחר קובץ"}</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setLicenseFile(e.target.files?.[0] ?? null)}
              />
            </span>
          </label>

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
                  onChange={(e) => setSurgicalPrivilegesHospital(e.target.value)}
                  required
                />
              </motion.div>
            )}
          </AnimatePresence>
        </FormSection>

        <div className="rounded-lg bg-info-bg border border-info-border px-3 py-2 text-xs text-info-text">
          את הפרטים הבאים ניתן להשלים ולערוך גם מאוחר יותר, דרך הפורטל האישי, לאחר אישור הבקשה
        </div>

        {(config.showDescription || (config.showMedicalResume && extraFieldsGate)) && (
          <FormSection icon={<FileText className="h-4 w-4" />} title="תיאור ומסמכים נוספים">
            {config.showDescription && (
              <Textarea
                label={isDoctor ? "תיאור / אודות הרופא/ה" : "תיאור"}
                placeholder={isDoctor ? "ספר/י בקצרה על עצמך כרופא/ה — ניסיון, גישה טיפולית וכו׳" : undefined}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}

            {config.showMedicalResume && extraFieldsGate && (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                רזומה רפואי (לא חובה)
                <span className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-600 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                  <Upload className="h-4 w-4 shrink-0" />
                  <span className="truncate">{medicalResumeFile ? medicalResumeFile.name : "בחר קובץ"}</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => setMedicalResumeFile(e.target.files?.[0] ?? null)}
                  />
                </span>
              </label>
            )}
          </FormSection>
        )}

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

        <FormSection icon={<MapPin className="h-4 w-4" />} title="אזור שירות ופריסה">
          <MultiSelectPills
            label="אזורי שירות (ניתן לבחור יותר מאחד)"
            options={[
              ...(config.excludeOnlineServiceArea ? SERVICE_AREAS.filter((a) => a.trim() !== "אונליין") : SERVICE_AREAS),
              ...(config.extraServiceAreas ?? []),
            ]}
            value={serviceAreas}
            onChange={setServiceAreas}
          />

          {config.showLocationCount && (
            <Input
              type="number"
              min={1}
              label="כמה מוקדי קבלה / מרפאות יש לך?"
              icon={<MapPin className="h-4 w-4" />}
              value={locationCount}
              onChange={(e) => setLocationCount(e.target.value)}
            />
          )}
        </FormSection>

        <Button type="submit" loading={loading} className="w-full mt-1">
          שליחת בקשה
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        כבר יש לך חשבון?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          התחבר
        </Link>
      </p>
    </ApplyShell>
  );
}
