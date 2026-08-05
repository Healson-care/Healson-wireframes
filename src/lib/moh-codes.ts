// Ministry-of-Health procedure code book (§PRV-09).
//
// A clinical service that is a בדיקה / הדמייה / פעולה / ניתוח has an official
// Ministry of Health code — the provider must pick it from this book rather
// than typing a name freely, so the same procedure carries the same code across
// every provider on the platform (billing, kupah claims, reporting).
// Consultations ("ייעוץ", "חוות דעת נוספת") and internal/product-like entries
// have no MOH code — how those are coded is still an OPEN QUESTION, surfaced to
// the provider in the catalog dialog rather than silently decided here.
//
// DEMO DATA: this is a small illustrative subset in the real code book's shape.
// In production it would be loaded from the Ministry of Health publication and
// searched server-side.
import { ProviderServiceType } from "@/types";

export interface MohCode {
  code: string;
  name_he: string;
  /** Which clinical classification this code belongs to. */
  service_type: ProviderServiceType;
  /**
   * The medical domain (SkillDomain.id) the procedure belongs to. It travels
   * with the CODE and not with whoever performs it — an MRI ברך is an
   * orthopaedic item whether a doctor or a station runs it, which is what lets
   * the patient search by תחום for machine-run items that have no doctor.
   */
  skill_domain_id?: string;
  /**
   * The sub-domain (SkillSubdomain.id) inside that domain. Left unset where
   * the taxonomy has no sub-domain that honestly fits the procedure — better
   * a coded item with no sub-domain than one filed under the wrong one.
   */
  skill_subdomain_id?: string;
  /** Free-text grouping shown in the picker ("הדמיה — MRI"). */
  group: string;
  /** Extra words to match on ("mri", "מגנטי") — the code book is Hebrew but
   * providers search in the mixed Hebrew/English they actually use. */
  aliases?: string[];
}

/** Service types that must carry a MOH code before the item can be saved. */
export const MOH_CODED_SERVICE_TYPES: ProviderServiceType[] = ["test", "imaging", "procedure", "surgery"];

export function requiresMohCode(serviceType?: ProviderServiceType): boolean {
  return !!serviceType && MOH_CODED_SERVICE_TYPES.includes(serviceType);
}

export const MOH_CODES: MohCode[] = [
  // ---- הדמייה ----
  { code: "54010", name_he: "MRI ראש ללא חומר ניגוד", service_type: "imaging", skill_domain_id: "dom_neuro", skill_subdomain_id: "sub_neuro_headache", group: "הדמיה — MRI", aliases: ["mri", "מוח", "מגנטי"] },
  { code: "54011", name_he: "MRI ראש עם חומר ניגוד", service_type: "imaging", skill_domain_id: "dom_neuro", skill_subdomain_id: "sub_neuro_stroke", group: "הדמיה — MRI", aliases: ["mri", "מוח", "גדוליניום"] },
  { code: "54020", name_he: "MRI עמוד שדרה צווארי", service_type: "imaging", skill_domain_id: "dom_ortho", skill_subdomain_id: "sub_ortho_spine", group: "הדמיה — MRI", aliases: ["mri", "צוואר"] },
  { code: "54021", name_he: "MRI עמוד שדרה מותני", service_type: "imaging", skill_domain_id: "dom_ortho", skill_subdomain_id: "sub_ortho_spine", group: "הדמיה — MRI", aliases: ["mri", "גב", "מותן"] },
  { code: "54030", name_he: "MRI בטן ואגן", service_type: "imaging", skill_domain_id: "dom_radiology", skill_subdomain_id: "sub_radiology_ct_mri", group: "הדמיה — MRI", aliases: ["mri", "בטן"] },
  { code: "54040", name_he: "MRI ברך", service_type: "imaging", skill_domain_id: "dom_ortho", skill_subdomain_id: "sub_ortho_knee", group: "הדמיה — MRI", aliases: ["mri", "ברך", "אורתופדי"] },
  { code: "54050", name_he: "MRI שד", service_type: "imaging", skill_domain_id: "dom_oncology", skill_subdomain_id: "sub_oncology_breast", group: "הדמיה — MRI", aliases: ["mri", "שד"] },
  { code: "53010", name_he: "CT ראש ללא חומר ניגוד", service_type: "imaging", skill_domain_id: "dom_neuro", skill_subdomain_id: "sub_neuro_stroke", group: "הדמיה — CT", aliases: ["ct", "מוח", "טומוגרפיה"] },
  { code: "53020", name_he: "CT בטן ואגן עם חומר ניגוד", service_type: "imaging", skill_domain_id: "dom_radiology", skill_subdomain_id: "sub_radiology_ct_mri", group: "הדמיה — CT", aliases: ["ct", "בטן", "ניגוד"] },
  { code: "53030", name_he: "CT חזה", service_type: "imaging", skill_domain_id: "dom_pulmonology", skill_subdomain_id: "sub_pulmonology_cancer", group: "הדמיה — CT", aliases: ["ct", "ריאות", "חזה"] },
  { code: "53040", name_he: "CT סינוסים", service_type: "imaging", skill_domain_id: "dom_ent", skill_subdomain_id: "sub_ent_sinus", group: "הדמיה — CT", aliases: ["ct", "סינוס", "אף אוזן גרון"] },
  { code: "53050", name_he: "CT אנגיוגרפיה כלילית", service_type: "imaging", skill_domain_id: "dom_cardio", skill_subdomain_id: "sub_cardio_general", group: "הדמיה — CT", aliases: ["ct", "לב", "כלילית", "angio"] },
  { code: "52010", name_he: "אולטרסאונד בטן שלמה", service_type: "imaging", skill_domain_id: "dom_radiology", skill_subdomain_id: "sub_radiology_ultrasound", group: "הדמיה — אולטרסאונד", aliases: ["us", "אולטרה", "סונר"] },
  { code: "52020", name_he: "אולטרסאונד בלוטת התריס", service_type: "imaging", skill_domain_id: "dom_endocrine", skill_subdomain_id: "sub_endocrine_thyroid", group: "הדמיה — אולטרסאונד", aliases: ["us", "תריס", "טירואיד"] },
  { code: "52030", name_he: "אולטרסאונד דופלר עורקי צוואר", service_type: "imaging", skill_domain_id: "dom_cardio", skill_subdomain_id: "sub_cardio_general", group: "הדמיה — אולטרסאונד", aliases: ["דופלר", "doppler", "צוואר"] },
  { code: "52040", name_he: "אקו לב (אקוקרדיוגרפיה)", service_type: "imaging", skill_domain_id: "dom_cardio", skill_subdomain_id: "sub_cardio_general", group: "הדמיה — אולטרסאונד", aliases: ["אקו", "echo", "לב", "מסתמים"] },
  { code: "52050", name_he: "OCT — טומוגרפיה אופטית של הרשתית", service_type: "imaging", skill_domain_id: "dom_eyes", group: "הדמיה — עיניים", aliases: ["oct", "רשתית", "עיניים", "מקולה"] },
  { code: "51010", name_he: "צילום חזה", service_type: "imaging", skill_domain_id: "dom_pulmonology", skill_subdomain_id: "sub_pulmonology_tb", group: "הדמיה — רנטגן", aliases: ["רנטגן", "xray", "ריאות"] },
  { code: "51020", name_he: "צילום עמוד שדרה מותני", service_type: "imaging", skill_domain_id: "dom_ortho", skill_subdomain_id: "sub_ortho_spine", group: "הדמיה — רנטגן", aliases: ["רנטגן", "xray", "גב"] },
  { code: "51500", name_he: "ממוגרפיה דו-צדדית", service_type: "imaging", skill_domain_id: "dom_oncology", skill_subdomain_id: "sub_oncology_breast", group: "הדמיה — ממוגרפיה", aliases: ["שד", "סקר"] },
  { code: "55010", name_he: "PET-CT גוף שלם", service_type: "imaging", skill_domain_id: "dom_oncology", skill_subdomain_id: "sub_oncology_general", group: "הדמיה — רפואה גרעינית", aliases: ["pet", "אונקולוגי"] },
  { code: "55020", name_he: "בדיקת צפיפות עצם (DEXA)", service_type: "imaging", skill_domain_id: "dom_endocrine", skill_subdomain_id: "sub_endocrine_osteo", group: "הדמיה — רפואה גרעינית", aliases: ["dexa", "אוסטאופורוזיס", "עצם"] },

  // ---- בדיקות ----
  { code: "20010", name_he: "ספירת דם מלאה", service_type: "test", skill_domain_id: "dom_internal", skill_subdomain_id: "sub_internal_general", group: "בדיקות מעבדה", aliases: ["cbc", "דם"] },
  { code: "20020", name_he: "פאנל שומנים בדם", service_type: "test", skill_domain_id: "dom_internal", skill_subdomain_id: "sub_internal_chronic", group: "בדיקות מעבדה", aliases: ["כולסטרול", "ליפידים"] },
  { code: "20030", name_he: "תפקודי בלוטת התריס (TSH, T4)", service_type: "test", skill_domain_id: "dom_endocrine", skill_subdomain_id: "sub_endocrine_thyroid", group: "בדיקות מעבדה", aliases: ["tsh", "תריס"] },
  { code: "20040", name_he: "גלוקוז בצום והמוגלובין מסוכרר", service_type: "test", skill_domain_id: "dom_endocrine", skill_subdomain_id: "sub_endocrine_diabetes", group: "בדיקות מעבדה", aliases: ["סוכר", "hba1c", "סוכרת"] },
  { code: "20050", name_he: "בדיקת שתן כללית ותרבית", service_type: "test", skill_domain_id: "dom_nephro", group: "בדיקות מעבדה", aliases: ["שתן", "תרבית"] },
  { code: "20060", name_he: "בדיקת PCR לזיהוי נגיפי נשימה", service_type: "test", skill_domain_id: "dom_infectious", skill_subdomain_id: "sub_infectious_general", group: "בדיקות מעבדה", aliases: ["pcr", "קורונה", "שפעת"] },
  { code: "21010", name_he: "משטח צוואר הרחם (PAP)", service_type: "test", skill_domain_id: "dom_obgyn", skill_subdomain_id: "sub_obgyn_onco", group: "בדיקות אבחון", aliases: ["pap", "גינקולוגי", "סקר"] },
  { code: "21020", name_he: "בדיקת תפקודי ריאות (ספירומטריה)", service_type: "test", skill_domain_id: "dom_pulmonology", skill_subdomain_id: "sub_pulmonology_asthma_copd", group: "בדיקות אבחון", aliases: ["ספירומטריה", "ריאות"] },
  { code: "21030", name_he: "אק״ג במנוחה", service_type: "test", skill_domain_id: "dom_cardio", skill_subdomain_id: "sub_cardio_general", group: "בדיקות אבחון", aliases: ["ekg", "ecg", "לב", "אקג"] },
  { code: "21040", name_he: "מבחן מאמץ לבבי", service_type: "test", skill_domain_id: "dom_cardio", skill_subdomain_id: "sub_cardio_general", group: "בדיקות אבחון", aliases: ["ארגומטריה", "מאמץ", "לב"] },
  { code: "21050", name_he: "הולטר לחץ דם 24 שעות", service_type: "test", skill_domain_id: "dom_cardio", skill_subdomain_id: "sub_cardio_general", group: "בדיקות אבחון", aliases: ["הולטר", "לחץ דם"] },
  { code: "21060", name_he: "בדיקת שמיעה (אודיומטריה)", service_type: "test", skill_domain_id: "dom_ent", skill_subdomain_id: "sub_ent_hearing", group: "בדיקות אבחון", aliases: ["שמיעה", "אודיו"] },
  { code: "21070", name_he: "מיפוי שומות דיגיטלי (דרמוסקופיה)", service_type: "test", skill_domain_id: "dom_derma", skill_subdomain_id: "sub_derma_onco", group: "בדיקות אבחון", aliases: ["שומות", "דרמוסקופיה", "עור", "מלנומה"] },
  { code: "21080", name_he: "שדה ראייה ממוחשב (פרימטריה)", service_type: "test", skill_domain_id: "dom_eyes", group: "בדיקות אבחון", aliases: ["עיניים", "פרימטריה", "גלאוקומה"] },
  { code: "21090", name_he: "הולטר קצב לב 24 שעות", service_type: "test", skill_domain_id: "dom_cardio", skill_subdomain_id: "sub_cardio_arrhythmia", group: "בדיקות אבחון", aliases: ["הולטר", "קצב", "הפרעות קצב"] },

  // ---- פעולות ----
  { code: "31010", name_he: "קולונוסקופיה אבחנתית", service_type: "procedure", skill_domain_id: "dom_gastro", skill_subdomain_id: "sub_gastro_gi", group: "פעולות — גסטרו", aliases: ["מעי", "קולונו", "colonoscopy"] },
  { code: "31011", name_he: "קולונוסקופיה עם כריתת פוליפ", service_type: "procedure", skill_domain_id: "dom_gastro", skill_subdomain_id: "sub_gastro_gi", group: "פעולות — גסטרו", aliases: ["פוליפ", "מעי"] },
  { code: "31020", name_he: "גסטרוסקופיה אבחנתית", service_type: "procedure", skill_domain_id: "dom_gastro", skill_subdomain_id: "sub_gastro_gi", group: "פעולות — גסטרו", aliases: ["קיבה", "גסטרו"] },
  { code: "31030", name_he: "ביופסיה מונחית אולטרסאונד", service_type: "procedure", skill_domain_id: "dom_radiology", skill_subdomain_id: "sub_radiology_interventional", group: "פעולות — אבחון פולשני", aliases: ["ביופסיה", "דגימה"] },
  { code: "32010", name_he: "כריתת נגע עורי שפיר", service_type: "procedure", skill_domain_id: "dom_derma", skill_subdomain_id: "sub_derma_general", group: "פעולות — עור", aliases: ["שומה", "עור", "כריתה"] },
  { code: "32020", name_he: "הזרקה תוך-מפרקית מונחית", service_type: "procedure", skill_domain_id: "dom_ortho", group: "פעולות — אורתופדיה", aliases: ["הזרקה", "מפרק", "סטרואיד"] },
  { code: "32030", name_he: "ציסטוסקופיה אבחנתית", service_type: "procedure", skill_domain_id: "dom_urology", skill_subdomain_id: "sub_urology_general", group: "פעולות — אורולוגיה", aliases: ["שלפוחית", "אורולוגי"] },
  { code: "32040", name_he: "אלקטרוליזה ורידית (סקלרותרפיה)", service_type: "procedure", skill_domain_id: "dom_gensurgery", skill_subdomain_id: "sub_gensurgery_minimally_invasive", group: "פעולות — כלי דם", aliases: ["ורידים", "סקלרו"] },

  // ---- ניתוחים ----
  { code: "41010", name_he: "תיקון בקע מפשעתי", service_type: "surgery", skill_domain_id: "dom_gensurgery", skill_subdomain_id: "sub_gensurgery_abdomen", group: "ניתוחים — כירורגיה כללית", aliases: ["בקע", "הרניה", "מפשעה"] },
  { code: "41020", name_he: "כריתת כיס מרה לפרוסקופית", service_type: "surgery", skill_domain_id: "dom_gensurgery", skill_subdomain_id: "sub_gensurgery_abdomen", group: "ניתוחים — כירורגיה כללית", aliases: ["מרה", "לפרוסקופיה"] },
  { code: "41030", name_he: "כריתת תוספתן", service_type: "surgery", skill_domain_id: "dom_gensurgery", skill_subdomain_id: "sub_gensurgery_abdomen", group: "ניתוחים — כירורגיה כללית", aliases: ["תוספתן", "אפנדיציט"] },
  { code: "42010", name_he: "ארתרוסקופיה של הברך", service_type: "surgery", skill_domain_id: "dom_ortho", skill_subdomain_id: "sub_ortho_knee", group: "ניתוחים — אורתופדיה", aliases: ["ברך", "ארתרו", "מניסקוס"] },
  { code: "42020", name_he: "ניתוח שחרור התעלה הקרפלית", service_type: "surgery", skill_domain_id: "dom_ortho", group: "ניתוחים — אורתופדיה", aliases: ["שורש כף יד", "קרפלי"] },
  { code: "43010", name_he: "ניתוח קטרקט עם השתלת עדשה", service_type: "surgery", skill_domain_id: "dom_eyes", skill_subdomain_id: "sub_eyes_cataract", group: "ניתוחים — עיניים", aliases: ["קטרקט", "עין", "עדשה"] },
  { code: "44010", name_he: "כריתת שקדים", service_type: "surgery", skill_domain_id: "dom_ent", skill_subdomain_id: "sub_ent_throat", group: "ניתוחים — אף אוזן גרון", aliases: ["שקדים", "טונסיל"] },
  { code: "44020", name_he: "ניתוח מחיצת האף", service_type: "surgery", skill_domain_id: "dom_ent", skill_subdomain_id: "sub_ent_sinus", group: "ניתוחים — אף אוזן גרון", aliases: ["מחיצה", "ספטום", "אף"] },
];

/** Search the code book — by code prefix, Hebrew name, group or alias.
 * `serviceType` narrows to the codes valid for that clinical classification,
 * which is what the catalog dialog always wants. */
export function searchMohCodes(query: string, serviceType?: ProviderServiceType, limit = 12): MohCode[] {
  const pool = serviceType ? MOH_CODES.filter((c) => c.service_type === serviceType) : MOH_CODES;
  const q = query.trim().toLowerCase();
  if (!q) return pool.slice(0, limit);
  return pool
    .filter(
      (c) =>
        c.code.startsWith(q) ||
        c.name_he.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q) ||
        (c.aliases ?? []).some((a) => a.toLowerCase().includes(q))
    )
    .slice(0, limit);
}

export function findMohCode(code?: string): MohCode | undefined {
  return code ? MOH_CODES.find((c) => c.code === code) : undefined;
}
