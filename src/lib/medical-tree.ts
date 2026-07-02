// Reconstructed medical taxonomy used by the catalog/search wizard and the
// /medical reference screen. Names are realistic Hebrew medical terms.

export interface SubDomain {
  key: string;
  label: string;
}

export interface MedicalDomain {
  key: string;
  label: string;
  emoji: string;
  subDomains: SubDomain[];
}

export const SERVICE_TYPES = [
  { key: "consultation", label: "ייעוץ" },
  { key: "tests", label: "בדיקות" },
  { key: "imaging", label: "דימות" },
  { key: "surgery", label: "ניתוח" },
  { key: "extra", label: "שירותים נוספים" },
];

export const MEDICAL_TREE: MedicalDomain[] = [
  {
    key: "orthopedics",
    label: "אורתופדיה",
    emoji: "🦴",
    subDomains: [
      { key: "knee", label: "ברך" },
      { key: "spine", label: "עמוד שדרה" },
      { key: "shoulder", label: "כתף" },
    ],
  },
  {
    key: "cardiology",
    label: "קרדיולוגיה",
    emoji: "❤️",
    subDomains: [
      { key: "general-cardiac", label: "לב כללי" },
      { key: "arrhythmia", label: "הפרעות קצב" },
    ],
  },
  {
    key: "neurology",
    label: "נוירולוגיה",
    emoji: "🧠",
    subDomains: [
      { key: "headache", label: "כאב ראש ומיגרנה" },
      { key: "stroke", label: "שבץ ואירועים נוירולוגיים" },
    ],
  },
  {
    key: "gastro",
    label: "גסטרואנטרולוגיה",
    emoji: "🩺",
    subDomains: [{ key: "gi", label: "קולונוסקופיה ומערכת העיכול" }],
  },
  {
    key: "ophthalmology",
    label: "רפואת עיניים",
    emoji: "👁️",
    subDomains: [{ key: "cataract", label: "קטרקט ועדשות" }],
  },
];

export interface BodyRegionMeta {
  id: string;
  emoji: string;
  label: string;
  domains: string[]; // MedicalDomain labels, prioritized
}

export const BODY_REGIONS: BodyRegionMeta[] = [
  { id: "head", emoji: "🧠", label: "ראש", domains: ["נוירולוגיה", "רפואת עיניים"] },
  { id: "eyes", emoji: "👁️", label: "עיניים", domains: ["רפואת עיניים"] },
  { id: "shoulder", emoji: "💪", label: "כתף", domains: ["אורתופדיה"] },
  { id: "chest", emoji: "❤️", label: "חזה", domains: ["קרדיולוגיה"] },
  { id: "spine", emoji: "🦴", label: "עמוד שדרה", domains: ["אורתופדיה"] },
  { id: "abdomen", emoji: "🩺", label: "בטן", domains: ["גסטרואנטרולוגיה"] },
  { id: "knee", emoji: "🦵", label: "ברך", domains: ["אורתופדיה"] },
];

export const KUPAH_LOGOS: Record<string, string> = {
  כללית: "🟢",
  מכבי: "🔵",
  מאוחדת: "🟠",
  לאומית: "🟣",
};

export const DAY_LABELS: Record<string, string> = {
  sunday: "ראשון",
  monday: "שני",
  tuesday: "שלישי",
  wednesday: "רביעי",
  thursday: "חמישי",
  friday: "שישי",
  saturday: "שבת",
};
