// Skill taxonomy (§5) — seed data for the admin-editable skill_domains /
// skill_subdomains tables (see src/lib/store.ts). Also holds the UI-only body
// map + kupah/day label lookups used by the catalog wizards.
import { SkillDomain, SkillSubdomain } from "@/types";

// Domain name_he values are kept in exact sync with the doctor specialty
// strings in provider/register/page.tsx's SPECIALTIES list, so a provider's
// own specialty can be matched straight to a domain (ServiceCatalogSection
// auto-scopes the catalog picker to it) without a separate mapping table.
export const SEED_SKILL_DOMAINS: SkillDomain[] = [
  { id: "dom_ortho", name_he: "אורתופדיה", emoji: "🦴", slug: "orthopedics" },
  { id: "dom_cardio", name_he: "קרדיולוגיה", emoji: "❤️", slug: "cardiology" },
  { id: "dom_neuro", name_he: "נוירולוגיה", emoji: "🧠", slug: "neurology" },
  { id: "dom_gastro", name_he: "גסטרואנטרולוגיה", emoji: "🩺", slug: "gastro" },
  { id: "dom_eyes", name_he: "רפואת עיניים", emoji: "👁️", slug: "ophthalmology" },
  { id: "dom_oncology", name_he: "אונקולוגיה", emoji: "🎗️", slug: "oncology" },
  { id: "dom_urology", name_he: "אורולוגיה", emoji: "🫘", slug: "urology" },
  { id: "dom_allergy", name_he: "אלרגולוגיה ואימונולוגיה קלינית", emoji: "🤧", slug: "allergy_immunology" },
  { id: "dom_endocrine", name_he: "אנדוקרינולוגיה", emoji: "🦋", slug: "endocrinology" },
  { id: "dom_ent", name_he: "אף אוזן וגרון", emoji: "👂", slug: "ent" },
  { id: "dom_obgyn", name_he: "גינקולוגיה ומיילדות", emoji: "🤰", slug: "obgyn" },
  { id: "dom_geriatrics", name_he: "גריאטריה", emoji: "👴", slug: "geriatrics" },
  { id: "dom_derma", name_he: "דרמטולוגיה (רפואת עור)", emoji: "🧴", slug: "dermatology" },
  { id: "dom_anesthesia", name_he: "הרדמה וטיפול נמרץ", emoji: "💉", slug: "anesthesia_icu" },
  { id: "dom_gensurgery", name_he: "כירורגיה כללית", emoji: "🔪", slug: "general_surgery" },
  { id: "dom_plastic", name_he: "כירורגיה פלסטית", emoji: "✨", slug: "plastic_surgery" },
  { id: "dom_cardiothoracic", name_he: "כירורגיית לב-חזה", emoji: "🫀", slug: "cardiothoracic_surgery" },
  { id: "dom_infectious", name_he: "מחלות זיהומיות", emoji: "🦠", slug: "infectious_disease" },
  { id: "dom_neurosurgery", name_he: "נוירוכירורגיה", emoji: "🪛", slug: "neurosurgery" },
  { id: "dom_nephro", name_he: "נפרולוגיה", emoji: "💧", slug: "nephrology" },
  { id: "dom_internal", name_he: "פנימית", emoji: "🩺", slug: "internal_medicine" },
  { id: "dom_psychiatry", name_he: "פסיכיאטריה", emoji: "🛋️", slug: "psychiatry" },
  { id: "dom_pathology", name_he: "פתולוגיה", emoji: "🔬", slug: "pathology" },
  { id: "dom_rheum", name_he: "ראומטולוגיה", emoji: "🦴", slug: "rheumatology" },
  { id: "dom_radiology", name_he: "רדיולוגיה", emoji: "🩻", slug: "radiology" },
  { id: "dom_emergency", name_he: "רפואה דחופה", emoji: "🚑", slug: "emergency_medicine" },
  { id: "dom_peds", name_he: "רפואת ילדים", emoji: "👶", slug: "pediatrics" },
  { id: "dom_family", name_he: "רפואת משפחה", emoji: "👨‍👩‍👧", slug: "family_medicine" },
  { id: "dom_pulmonology", name_he: "רפואת ריאות", emoji: "🫁", slug: "pulmonology" },
  { id: "dom_rehab", name_he: "שיקום", emoji: "🦽", slug: "rehabilitation" },
];

export const SEED_SKILL_SUBDOMAINS: SkillSubdomain[] = [
  // אורתופדיה — aligned to spec §5.2's example list
  { id: "sub_ortho_shoulder", domain_id: "dom_ortho", name_he: "כתף", slug: "shoulder" },
  { id: "sub_ortho_spine", domain_id: "dom_ortho", name_he: "עמוד שדרה", slug: "spine" },
  { id: "sub_ortho_knee", domain_id: "dom_ortho", name_he: "ברך", slug: "knee" },
  { id: "sub_ortho_hip", domain_id: "dom_ortho", name_he: "ירך", slug: "hip" },
  { id: "sub_ortho_foot", domain_id: "dom_ortho", name_he: "כף רגל", slug: "foot" },

  // קרדיולוגיה
  { id: "sub_cardio_general", domain_id: "dom_cardio", name_he: "כללי", slug: "general" },
  { id: "sub_cardio_arrhythmia", domain_id: "dom_cardio", name_he: "הפרעות קצב", slug: "arrhythmia" },

  // נוירולוגיה
  { id: "sub_neuro_headache", domain_id: "dom_neuro", name_he: "כאב ראש ומיגרנה", slug: "headache" },
  { id: "sub_neuro_stroke", domain_id: "dom_neuro", name_he: "שבץ ואירועים נוירולוגיים", slug: "stroke" },

  // גסטרואנטרולוגיה
  { id: "sub_gastro_gi", domain_id: "dom_gastro", name_he: "קולונוסקופיה ומערכת העיכול", slug: "gi" },

  // רפואת עיניים
  { id: "sub_eyes_cataract", domain_id: "dom_eyes", name_he: "קטרקט ועדשות", slug: "cataract" },

  // אונקולוגיה — same sub-specialty names as SUBSPECIALTIES_BY_SPECIALTY in
  // provider/register/page.tsx, kept in sync so a doctor's self-declared
  // sub-specialty lines up with the catalog's sub-domain.
  { id: "sub_oncology_general", domain_id: "dom_oncology", name_he: "אונקולוגיה כללית", slug: "general" },
  { id: "sub_oncology_breast", domain_id: "dom_oncology", name_he: "אונקולוגיה של השד", slug: "breast" },
  { id: "sub_oncology_gyn", domain_id: "dom_oncology", name_he: "אונקולוגיה גינקולוגית", slug: "gynecologic" },
  { id: "sub_oncology_gi", domain_id: "dom_oncology", name_he: "אונקולוגיה של מערכת העיכול", slug: "gi" },
  { id: "sub_oncology_hemato", domain_id: "dom_oncology", name_he: "המטו-אונקולוגיה", slug: "hemato" },
  { id: "sub_oncology_lung", domain_id: "dom_oncology", name_he: "אונקולוגיית ריאה", slug: "lung" },

  // אורולוגיה
  { id: "sub_urology_general", domain_id: "dom_urology", name_he: "אורולוגיה כללית", slug: "general" },
  { id: "sub_urology_onco", domain_id: "dom_urology", name_he: "אורו-אונקולוגיה", slug: "onco" },
  { id: "sub_urology_andro", domain_id: "dom_urology", name_he: "אנדרולוגיה", slug: "andrology" },
  { id: "sub_urology_stones", domain_id: "dom_urology", name_he: "אבנים בדרכי השתן", slug: "stones" },
  { id: "sub_urology_women", domain_id: "dom_urology", name_he: "אורולוגיה של האישה", slug: "women" },
  { id: "sub_urology_peds", domain_id: "dom_urology", name_he: "אורולוגיית ילדים", slug: "pediatric" },

  // אלרגולוגיה ואימונולוגיה קלינית
  { id: "sub_allergy_food", domain_id: "dom_allergy", name_he: "אלרגיות מזון", slug: "food" },
  { id: "sub_allergy_asthma", domain_id: "dom_allergy", name_he: "אסתמה ונשימה", slug: "asthma" },
  { id: "sub_allergy_immuno", domain_id: "dom_allergy", name_he: "אימונולוגיה קלינית", slug: "immunology" },
  { id: "sub_allergy_peds", domain_id: "dom_allergy", name_he: "אלרגיה בילדים", slug: "pediatric" },

  // אנדוקרינולוגיה
  { id: "sub_endocrine_diabetes", domain_id: "dom_endocrine", name_he: "סוכרת", slug: "diabetes" },
  { id: "sub_endocrine_thyroid", domain_id: "dom_endocrine", name_he: "בלוטת התריס", slug: "thyroid" },
  { id: "sub_endocrine_osteo", domain_id: "dom_endocrine", name_he: "אוסטאופורוזיס", slug: "osteoporosis" },
  { id: "sub_endocrine_obesity", domain_id: "dom_endocrine", name_he: "השמנה ומטבוליזם", slug: "obesity" },
  { id: "sub_endocrine_repro", domain_id: "dom_endocrine", name_he: "אנדוקרינולוגיית רבייה", slug: "reproductive" },

  // אף אוזן וגרון
  { id: "sub_ent_sinus", domain_id: "dom_ent", name_he: "אף וסינוסים", slug: "sinus" },
  { id: "sub_ent_hearing", domain_id: "dom_ent", name_he: "אוזניים ושמיעה", slug: "hearing" },
  { id: "sub_ent_throat", domain_id: "dom_ent", name_he: "גרון וקול", slug: "throat" },
  { id: "sub_ent_sleep", domain_id: "dom_ent", name_he: "שינה ונחירות", slug: "sleep" },
  { id: "sub_ent_peds", domain_id: "dom_ent", name_he: "אף אוזן גרון ילדים", slug: "pediatric" },

  // גינקולוגיה ומיילדות
  { id: "sub_obgyn_obstetrics", domain_id: "dom_obgyn", name_he: "מיילדות", slug: "obstetrics" },
  { id: "sub_obgyn_fertility", domain_id: "dom_obgyn", name_he: "פוריות", slug: "fertility" },
  { id: "sub_obgyn_onco", domain_id: "dom_obgyn", name_he: "אונקוגינקולוגיה", slug: "onco" },
  { id: "sub_obgyn_uro", domain_id: "dom_obgyn", name_he: "אורוגינקולוגיה", slug: "urogynecology" },
  { id: "sub_obgyn_menopause", domain_id: "dom_obgyn", name_he: "גיל המעבר", slug: "menopause" },

  // גריאטריה
  { id: "sub_geriatrics_general", domain_id: "dom_geriatrics", name_he: "גריאטריה כללית", slug: "general" },
  { id: "sub_geriatrics_dementia", domain_id: "dom_geriatrics", name_he: "דמנציה וזיכרון", slug: "dementia" },
  { id: "sub_geriatrics_rehab", domain_id: "dom_geriatrics", name_he: "שיקום גריאטרי", slug: "rehab" },

  // דרמטולוגיה (רפואת עור)
  { id: "sub_derma_general", domain_id: "dom_derma", name_he: "דרמטולוגיה כללית", slug: "general" },
  { id: "sub_derma_aesthetic", domain_id: "dom_derma", name_he: "דרמטולוגיה אסתטית", slug: "aesthetic" },
  { id: "sub_derma_onco", domain_id: "dom_derma", name_he: "דרמטו-אונקולוגיה", slug: "onco" },
  { id: "sub_derma_psoriasis", domain_id: "dom_derma", name_he: "פסוריאזיס ומחלות עור כרוניות", slug: "psoriasis" },
  { id: "sub_derma_peds", domain_id: "dom_derma", name_he: "דרמטולוגיית ילדים", slug: "pediatric" },

  // הרדמה וטיפול נמרץ
  { id: "sub_anesthesia_general", domain_id: "dom_anesthesia", name_he: "הרדמה כללית", slug: "general" },
  { id: "sub_anesthesia_icu", domain_id: "dom_anesthesia", name_he: "טיפול נמרץ", slug: "icu" },
  { id: "sub_anesthesia_pain", domain_id: "dom_anesthesia", name_he: "טיפול בכאב", slug: "pain" },
  { id: "sub_anesthesia_peds", domain_id: "dom_anesthesia", name_he: "הרדמה לילדים", slug: "pediatric" },

  // כירורגיה כללית
  { id: "sub_gensurgery_bariatric", domain_id: "dom_gensurgery", name_he: "כירורגיה בריאטרית", slug: "bariatric" },
  { id: "sub_gensurgery_abdomen", domain_id: "dom_gensurgery", name_he: "כירורגיית בטן", slug: "abdominal" },
  { id: "sub_gensurgery_breast", domain_id: "dom_gensurgery", name_he: "כירורגיית שד", slug: "breast" },
  { id: "sub_gensurgery_minimally_invasive", domain_id: "dom_gensurgery", name_he: "כירורגיה זעיר פולשנית", slug: "minimally_invasive" },

  // כירורגיה פלסטית
  { id: "sub_plastic_aesthetic", domain_id: "dom_plastic", name_he: "כירורגיה אסתטית", slug: "aesthetic" },
  { id: "sub_plastic_reconstruction", domain_id: "dom_plastic", name_he: "שחזור לאחר סרטן שד", slug: "reconstruction" },
  { id: "sub_plastic_burns", domain_id: "dom_plastic", name_he: "כירורגיית כוויות", slug: "burns" },
  { id: "sub_plastic_hand", domain_id: "dom_plastic", name_he: "כירורגיית יד", slug: "hand" },

  // כירורגיית לב-חזה
  { id: "sub_cardiothoracic_open_heart", domain_id: "dom_cardiothoracic", name_he: "ניתוחי לב פתוח", slug: "open_heart" },
  { id: "sub_cardiothoracic_lung", domain_id: "dom_cardiothoracic", name_he: "ניתוחי ריאה", slug: "lung" },
  { id: "sub_cardiothoracic_catheterization", domain_id: "dom_cardiothoracic", name_he: "צנתורים טיפוליים", slug: "catheterization" },

  // מחלות זיהומיות
  { id: "sub_infectious_general", domain_id: "dom_infectious", name_he: "מחלות זיהומיות כלליות", slug: "general" },
  { id: "sub_infectious_hiv", domain_id: "dom_infectious", name_he: "HIV ואיידס", slug: "hiv" },
  { id: "sub_infectious_postop", domain_id: "dom_infectious", name_he: "זיהומים לאחר ניתוח", slug: "postop" },
  { id: "sub_infectious_travel", domain_id: "dom_infectious", name_he: "רפואת נסיעות וחיסונים", slug: "travel" },

  // נוירוכירורגיה
  { id: "sub_neurosurgery_spine", domain_id: "dom_neurosurgery", name_he: "ניתוחי עמוד שדרה", slug: "spine" },
  { id: "sub_neurosurgery_brain", domain_id: "dom_neurosurgery", name_he: "ניתוחי מוח", slug: "brain" },
  { id: "sub_neurosurgery_functional", domain_id: "dom_neurosurgery", name_he: "נוירוכירורגיה תפקודית", slug: "functional" },

  // נפרולוגיה
  { id: "sub_nephro_failure", domain_id: "dom_nephro", name_he: "אי ספיקת כליות", slug: "kidney_failure" },
  { id: "sub_nephro_dialysis", domain_id: "dom_nephro", name_he: "דיאליזה", slug: "dialysis" },
  { id: "sub_nephro_transplant", domain_id: "dom_nephro", name_he: "השתלת כליה", slug: "transplant" },
  { id: "sub_nephro_hypertension", domain_id: "dom_nephro", name_he: "יתר לחץ דם", slug: "hypertension" },

  // פנימית
  { id: "sub_internal_general", domain_id: "dom_internal", name_he: "רפואה פנימית כללית", slug: "general" },
  { id: "sub_internal_complex", domain_id: "dom_internal", name_he: "אבחון מורכב", slug: "complex_diagnosis" },
  { id: "sub_internal_chronic", domain_id: "dom_internal", name_he: "ניהול מחלות כרוניות", slug: "chronic_disease" },

  // פסיכיאטריה
  { id: "sub_psychiatry_adult", domain_id: "dom_psychiatry", name_he: "פסיכיאטריית מבוגרים", slug: "adult" },
  { id: "sub_psychiatry_child", domain_id: "dom_psychiatry", name_he: "פסיכיאטריית ילדים ונוער", slug: "child_adolescent" },
  { id: "sub_psychiatry_geriatric", domain_id: "dom_psychiatry", name_he: "פסיכוגריאטריה", slug: "geriatric" },
  { id: "sub_psychiatry_addiction", domain_id: "dom_psychiatry", name_he: "התמכרויות", slug: "addiction" },
  { id: "sub_psychiatry_forensic", domain_id: "dom_psychiatry", name_he: "פסיכיאטריה משפטית", slug: "forensic" },

  // פתולוגיה
  { id: "sub_pathology_surgical", domain_id: "dom_pathology", name_he: "פתולוגיה כירורגית", slug: "surgical" },
  { id: "sub_pathology_cytology", domain_id: "dom_pathology", name_he: "ציטולוגיה", slug: "cytology" },
  { id: "sub_pathology_molecular", domain_id: "dom_pathology", name_he: "פתולוגיה מולקולרית", slug: "molecular" },

  // ראומטולוגיה
  { id: "sub_rheum_ra", domain_id: "dom_rheum", name_he: "דלקת מפרקים שגרונית", slug: "rheumatoid_arthritis" },
  { id: "sub_rheum_lupus", domain_id: "dom_rheum", name_he: "זאבת", slug: "lupus" },
  { id: "sub_rheum_osteo", domain_id: "dom_rheum", name_he: "אוסטאופורוזיס", slug: "osteoporosis" },
  { id: "sub_rheum_fibro", domain_id: "dom_rheum", name_he: "פיברומיאלגיה", slug: "fibromyalgia" },

  // רדיולוגיה
  { id: "sub_radiology_general", domain_id: "dom_radiology", name_he: "רדיולוגיה כללית", slug: "general" },
  { id: "sub_radiology_ct_mri", domain_id: "dom_radiology", name_he: "CT ו-MRI", slug: "ct_mri" },
  { id: "sub_radiology_interventional", domain_id: "dom_radiology", name_he: "רדיולוגיה התערבותית", slug: "interventional" },
  { id: "sub_radiology_ultrasound", domain_id: "dom_radiology", name_he: "אולטרסאונד", slug: "ultrasound" },
  { id: "sub_radiology_nuclear", domain_id: "dom_radiology", name_he: "מיפויים גרעיניים", slug: "nuclear" },

  // רפואה דחופה
  { id: "sub_emergency_trauma", domain_id: "dom_emergency", name_he: "טראומה", slug: "trauma" },
  { id: "sub_emergency_peds", domain_id: "dom_emergency", name_he: "רפואה דחופה לילדים", slug: "pediatric" },
  { id: "sub_emergency_toxicology", domain_id: "dom_emergency", name_he: "טוקסיקולוגיה", slug: "toxicology" },

  // רפואת ילדים
  { id: "sub_peds_general", domain_id: "dom_peds", name_he: "ילדים כללי", slug: "general" },
  { id: "sub_peds_neonatology", domain_id: "dom_peds", name_he: "נאונטולוגיה (פגים)", slug: "neonatology" },
  { id: "sub_peds_gastro", domain_id: "dom_peds", name_he: "גסטרואנטרולוגיית ילדים", slug: "gastro" },
  { id: "sub_peds_allergy", domain_id: "dom_peds", name_he: "אלרגיה בילדים", slug: "allergy" },
  { id: "sub_peds_development", domain_id: "dom_peds", name_he: "התפתחות הילד", slug: "development" },

  // רפואת משפחה
  { id: "sub_family_general", domain_id: "dom_family", name_he: "רפואת משפחה כללית", slug: "general" },
  { id: "sub_family_preventive", domain_id: "dom_family", name_he: "רפואה מונעת", slug: "preventive" },
  { id: "sub_family_women", domain_id: "dom_family", name_he: "רפואת נשים במשפחה", slug: "women" },
  { id: "sub_family_geriatrics", domain_id: "dom_family", name_he: "גריאטריה קהילתית", slug: "community_geriatrics" },

  // רפואת ריאות
  { id: "sub_pulmonology_asthma_copd", domain_id: "dom_pulmonology", name_he: "אסתמה ו-COPD", slug: "asthma_copd" },
  { id: "sub_pulmonology_sleep", domain_id: "dom_pulmonology", name_he: "שינה ודום נשימה", slug: "sleep_apnea" },
  { id: "sub_pulmonology_cancer", domain_id: "dom_pulmonology", name_he: "סרטן ריאה", slug: "lung_cancer" },
  { id: "sub_pulmonology_tb", domain_id: "dom_pulmonology", name_he: "שחפת וזיהומים", slug: "tb_infections" },

  // שיקום
  { id: "sub_rehab_ortho", domain_id: "dom_rehab", name_he: "שיקום אורתופדי", slug: "orthopedic" },
  { id: "sub_rehab_neuro", domain_id: "dom_rehab", name_he: "שיקום נוירולוגי", slug: "neurological" },
  { id: "sub_rehab_cardiac", domain_id: "dom_rehab", name_he: "שיקום לב", slug: "cardiac" },
  { id: "sub_rehab_peds", domain_id: "dom_rehab", name_he: "שיקום ילדים", slug: "pediatric" },
];

export interface BodyRegionMeta {
  id: string;
  emoji: string;
  label: string;
  domains: string[]; // SkillDomain.name_he values, prioritized
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
