// Skill taxonomy (§5) — seed data for the admin-editable skill_domains /
// skill_subdomains tables (see src/lib/store.ts). Also holds the UI-only body
// map + kupah/day label lookups used by the catalog wizards.
import { SkillDomain, SkillSubdomain } from "@/types";

export const SEED_SKILL_DOMAINS: SkillDomain[] = [
  { id: "dom_ortho", name_he: "אורתופדיה", emoji: "🦴", slug: "orthopedics" },
  { id: "dom_cardio", name_he: "קרדיולוגיה", emoji: "❤️", slug: "cardiology" },
  { id: "dom_neuro", name_he: "נוירולוגיה", emoji: "🧠", slug: "neurology" },
  { id: "dom_gastro", name_he: "גסטרואנטרולוגיה", emoji: "🩺", slug: "gastro" },
  { id: "dom_eyes", name_he: "רפואת עיניים", emoji: "👁️", slug: "ophthalmology" },
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
