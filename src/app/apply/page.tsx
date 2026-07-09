"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Mail,
  User as UserIcon,
  Phone,
  Stethoscope,
  HeartPulse,
  Store,
  Scissors,
  Building2,
  Network,
  BadgeCheck,
  Upload,
  CheckCircle2,
  ChevronRight,
  MapPin,
} from "lucide-react";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";
import { fileToDataUrl } from "@/lib/file";
import {
  DOCTOR_SUBTYPES,
  DOCTOR_SUBTYPE_LABELS,
  DoctorSubtype,
  KLevel,
  K_LEVELS_BY_KUPAH,
  Kupah,
  KupahArrangement,
  KUPOT,
  ORGANIZATION_MEMBER_TYPES,
  ProviderType,
  PROVIDER_TYPE_LABELS,
  UploadedFile,
} from "@/types";

type Phase = "type" | "form" | "otp" | "success";

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

const PRIVATE_INSURERS = ["הראל", "כלל", "מגדל", "הפניקס", "מנורה מבטחים", "איילון", "AIG", "שירביט"];

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

const STORE_TYPES = ["ציוד רפואי", "אופטיקה", "מוצרי טיפוח ובריאות", "תזונה ותוספים", "אחר"];
const SURGERY_TYPES = ["כירורגיה קטנה", "כירורגיה בינונית", "כירורגיה גדולה/מורכבת — רק בבית חולים"];
const INSTITUTE_TYPES = ["טיפולים", "אבחונים", "בדיקות הדמיות", "מרפאות"];
const ORG_TYPES = [
  "רשת מרפאות",
  "קבוצת רפואה פרטית",
  "רשת בתי מרקחת",
  "בית חולים / מרכז רפואי",
  "ארגון רב-תחומי",
  "אחר",
];

interface TypeFieldConfig {
  icon: React.ReactNode;
  label: string;
  description: string;
  nameLabel: string;
  showTitle?: boolean;
  showContactName?: boolean;
  contactNameLabel?: string;
  contactNameRequired?: boolean;
  showContactPhone?: boolean;
  showContactEmail?: boolean;
  specialtyLabel: string;
  specialtyOptions: string[];
  multiSpecialty?: boolean;
  showBusinessRegNumber?: boolean;
  businessRegRequired?: boolean;
  showLicenseNumber?: boolean;
  licenseNumberLabel: string;
  licenseFileLabel: string;
  showDescription?: boolean;
  showMedicalResume?: boolean;
  showKupot?: boolean;
  showPrivateInsurance?: boolean;
  showSubSpecialties?: boolean;
  showLocationCount?: boolean;
  showMemberProviderTypes?: boolean;
  excludeOnlineServiceArea?: boolean;
}

// "pharmacy" stays in the ProviderType union/model for backward compatibility
// (seed data, organization member lists) but is intentionally omitted here —
// it will resurface later as a sub-category under "store".
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
  complementary: {
    icon: <HeartPulse className="h-5 w-5" />,
    label: "נותן שירות משלים",
    description: "רפואה משלימה, טיפולים ופרא-רפואה",
    nameLabel: "שם מלא",
    specialtyLabel: "סוג שירות",
    specialtyOptions: COMPLEMENTARY_TYPES,
    showLicenseNumber: false,
    licenseNumberLabel: "מספר תעודת הסמכה",
    licenseFileLabel: "תעודת הסמכה (PDF / JPG / PNG)",
    showDescription: true,
  },
  store: {
    icon: <Store className="h-5 w-5" />,
    label: "חנות לממכר מוצרי בריאות",
    description: "חנות מוצרי בריאות, ציוד רפואי או אופטיקה",
    nameLabel: "שם העסק",
    showContactName: true,
    contactNameLabel: "שם איש קשר",
    specialtyLabel: "סוג החנות",
    specialtyOptions: STORE_TYPES,
    showBusinessRegNumber: true,
    licenseNumberLabel: "מספר רישיון עסק",
    licenseFileLabel: "רישיון עסק (PDF / JPG / PNG)",
  },
  surgery_center: {
    icon: <Scissors className="h-5 w-5" />,
    label: " מרכז רפואי המפעיל חדרי ניתוח",
    description: "מתקן חדרי ניתוח / מרכז כירורגי",
    nameLabel: "שם המרכז",
    showContactName: true,
    contactNameLabel: "שם איש קשר",
    specialtyLabel: "סוג רישיון ניתוחי",
    specialtyOptions: SURGERY_TYPES,
    multiSpecialty: true,
    showBusinessRegNumber: true,
    licenseNumberLabel: "מספר רישיון עסק (משרד הבריאות)",
    licenseFileLabel: "רישיון משרד הבריאות (PDF / JPG / PNG)",
    showKupot: true,
    showPrivateInsurance: true,
    showLocationCount: true,
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
  organization: {
    icon: <Network className="h-5 w-5" />,
    label: "ארגון / רשת",
    description: "ארגון המפעיל כמה סוגי ספקים תחת קורת גג אחת",
    nameLabel: "שם הארגון",
    showContactName: true,
    contactNameLabel: "שם איש קשר בארגון",
    specialtyLabel: "סוג הארגון",
    specialtyOptions: ORG_TYPES,
    showBusinessRegNumber: true,
    showLicenseNumber: false,
    licenseNumberLabel: "",
    licenseFileLabel: "תעודת התאגדות / רישיון ארגון (PDF / JPG / PNG)",
    showDescription: true,
    showLocationCount: true,
    showMemberProviderTypes: true,
  },
};

function MultiSelectPills({
  label,
  options,
  value,
  onChange,
  getLabel = (option: string) => option,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  getLabel?: (option: string) => string;
}) {
  function toggle(option: string) {
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              value.includes(option) ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {getLabel(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

function KupahArrangementPicker({
  value,
  onChange,
}: {
  value: KupahArrangement[];
  onChange: (value: KupahArrangement[]) => void;
}) {
  function toggle(kupah: Kupah) {
    const exists = value.some((a) => a.kupah === kupah);
    onChange(exists ? value.filter((a) => a.kupah !== kupah) : [...value, { kupah, level: K_LEVELS_BY_KUPAH[kupah][0] }]);
  }
  function setLevel(kupah: Kupah, level: KLevel) {
    onChange(value.map((a) => (a.kupah === kupah ? { ...a, level } : a)));
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700">עם אילו קופות חולים יש הסדר (K)</span>
      <div className="flex flex-col gap-2">
        {KUPOT.map((kupah) => {
          const entry = value.find((a) => a.kupah === kupah);
          return (
            <div key={kupah} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggle(kupah)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  entry ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {kupah}
              </button>
              {entry && (
                <Select
                  value={entry.level}
                  onChange={(e) => setLevel(kupah, e.target.value as KLevel)}
                  className="max-w-[140px] h-8 text-xs"
                >
                  {K_LEVELS_BY_KUPAH[kupah].map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ProviderApplyPage() {
  const applyAsProvider = useStore((s) => s.applyAsProvider);
  const verifyProviderApplicationOtp = useStore((s) => s.verifyProviderApplicationOtp);
  const resendProviderApplicationOtp = useStore((s) => s.resendProviderApplicationOtp);
  const showToast = useStore((s) => s.showToast);

  const [phase, setPhase] = useState<Phase>("type");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!providerType || !config) return;
    setError("");
    if (!licenseFile) {
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
    const licenseFileRecord: UploadedFile = {
      file_name: licenseFile.name,
      uploaded_at: new Date().toISOString(),
      data_url: await fileToDataUrl(licenseFile),
    };
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
      contact_name: config.showContactName ? contactName : undefined,
      contact_phone: config.showContactPhone && contactPhone ? contactPhone : undefined,
      contact_email: config.showContactEmail && contactEmail ? contactEmail : undefined,
      title: config.showTitle ? title : undefined,
      specialty: config.multiSpecialty ? specialtyMulti.join(", ") : specialty,
      license_number: config.showLicenseNumber === false ? undefined : licenseNumber,
      business_reg_number: config.showBusinessRegNumber && businessRegNumber ? businessRegNumber : undefined,
      phone,
      email,
      license_file: licenseFileRecord,
      doctor_subtype: isDoctor ? doctorSubtype : undefined,
      surgical_privileges_hospital: isSurgeon ? surgicalPrivilegesHospital : undefined,
      description: config.showDescription ? description : undefined,
      medical_resume_file: config.showMedicalResume ? medicalResumeFileRecord : undefined,
      kupah_arrangements: config.showKupot ? kupahArrangements : undefined,
      private_insurance_companies: config.showPrivateInsurance ? privateInsurers : undefined,
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
      setPhase("success");
    }, 300);
  }

  function handleResend() {
    const otp = resendProviderApplicationOtp();
    if (otp) showToast("קוד חדש נשלח לטלפון", { description: `קוד הדגמה: ${otp}` });
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

  if (phase === "type") {
    return (
      <AuthLayout>
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-slate-900">הצטרף כנותן שירות ל-Healson</h1>
          <p className="text-xs text-slate-500 mt-1">בחר/י את סוג הספק כדי להמשיך — לכל סוג יש פרטים שונים שנדרשים לאישור ראשוני</p>
        </div>
        <div className="flex flex-col gap-2">
          {(Object.entries(TYPE_CONFIG) as [ProviderType, TypeFieldConfig][]).map(([value, cfg]) => (
            <button
              key={value}
              type="button"
              onClick={() => selectType(value)}
              className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-right hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                {cfg.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{cfg.label}</p>
                <p className="text-xs text-slate-500 truncate">{cfg.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 rtl:rotate-180" />
            </button>
          ))}
        </div>
        <p className="mt-5 text-center text-sm text-slate-500">
          כבר יש לך חשבון?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            התחבר
          </Link>
        </p>
      </AuthLayout>
    );
  }

  if (phase === "otp") {
    return (
      <AuthLayout>
        <h1 className="text-lg font-semibold text-slate-900 mb-1">אימות מספר טלפון</h1>
        <p className="text-sm text-slate-500 mb-5">שלחנו קוד אימות בן 6 ספרות למספר {phone}</p>
        {error && (
          <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
            {error}
          </div>
        )}
        <form onSubmit={handleVerify} className="flex flex-col gap-3">
          <Input
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            label="קוד אימות"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            className="text-center tracking-[0.4em] text-lg"
            required
          />
          <Button type="submit" loading={loading} className="w-full">
            אמת קוד
          </Button>
          <button type="button" onClick={handleResend} className="text-sm text-primary hover:underline">
            שלח קוד מחדש
          </button>
        </form>
      </AuthLayout>
    );
  }

  if (phase === "success") {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success-text">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">בקשתך נשלחה בהצלחה</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            צוות Healson יבדוק את הפרטים והרישיון שצירפת. נעדכן אותך במייל ובהודעת טקסט כשהבדיקה תושלם ותוכל/י להמשיך
            להשלמת פרטי ההצטרפות + קישור, שם משתמש וסיסמא למערכת (הסדרי ביטוח, קטלוג שירותים, מיקומים והסכם).
          </p>
          <Link href="/login" className="mt-2 text-sm font-medium text-primary hover:underline">
            חזרה למסך הכניסה
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (!config || !providerType) return null;

  return (
    <AuthLayout>
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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

{config.showContactName && (
          <Input
            label={config.contactNameLabel}
            icon={<UserIcon className="h-4 w-4" />}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            required={config.contactNameRequired !== false}
          />
        )}
        
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

        
        {config.multiSpecialty ? (
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

        {config.showSubSpecialties && specialty && (
          <>
            <MultiSelectPills
              label="תתי התמחות (ניתן לבחור יותר מאחת)"
              options={[...(SUBSPECIALTIES_BY_SPECIALTY[specialty] ?? []), "אחר"]}
              value={subSpecialties}
              onChange={setSubSpecialties}
            />
            {subSpecialties.includes("אחר") && (
              <Input
                label='פירוט תת התמחות "אחר"'
                value={otherSubSpecialty}
                onChange={(e) => setOtherSubSpecialty(e.target.value)}
              />
            )}
          </>
        )}

        {config.showMemberProviderTypes && (
          <MultiSelectPills
            label="אילו סוגי ספקים פועלים בארגון (ניתן לבחור יותר מאחד)"
            options={ORGANIZATION_MEMBER_TYPES}
            value={memberProviderTypes}
            onChange={(v) => setMemberProviderTypes(v as ProviderType[])}
            getLabel={(t) => PROVIDER_TYPE_LABELS[t as ProviderType]}
          />
        )}

        {config.showBusinessRegNumber && (
          <Input
            label={`מספר עוסק מורשה / ח"פ${config.businessRegRequired === false ? " (לא חובה)" : ""}`}
            icon={<BadgeCheck className="h-4 w-4" />}
            value={businessRegNumber}
            onChange={(e) => setBusinessRegNumber(e.target.value)}
            required={config.businessRegRequired !== false}
          />
        )}

        {config.showLicenseNumber !== false && (
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
          <span className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-600 cursor-pointer hover:border-primary">
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

        {isSurgeon && (
          <Input
            label="בית חולים / מוסד בו קיימת הרשאת ניתוח"
            icon={<Building2 className="h-4 w-4" />}
            value={surgicalPrivilegesHospital}
            onChange={(e) => setSurgicalPrivilegesHospital(e.target.value)}
            required
          />
        )}

        <div className="rounded-lg bg-info-bg border border-info-border px-3 py-2 text-xs text-info-text">
          את הפרטים הבאים ניתן להשלים ולערוך גם מאוחר יותר, דרך הפורטל האישי, לאחר אישור הבקשה
        </div>

        {config.showDescription && (
          <Textarea
            label={isDoctor ? "תיאור / אודות הרופא/ה" : "תיאור"}
            placeholder={isDoctor ? "ספר/י בקצרה על עצמך כרופא/ה — ניסיון, גישה טיפולית וכו׳" : undefined}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        )}

        {config.showMedicalResume && (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            רזומה רפואי (לא חובה)
            <span className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-600 cursor-pointer hover:border-primary">
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

        {config.showKupot && <KupahArrangementPicker value={kupahArrangements} onChange={setKupahArrangements} />}

        {config.showPrivateInsurance && (
          <MultiSelectPills
            label="עם אילו חברות ביטוח פרטיות יש הסדר (B)"
            options={PRIVATE_INSURERS}
            value={privateInsurers}
            onChange={setPrivateInsurers}
          />
        )}

        <MultiSelectPills
          label="אזורי שירות (ניתן לבחור יותר מאחד)"
          options={
            config.excludeOnlineServiceArea ? SERVICE_AREAS.filter((a) => a.trim() !== "אונליין") : SERVICE_AREAS
          }
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
    </AuthLayout>
  );
}
