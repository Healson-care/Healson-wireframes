// Visual identity for the insurers a patient's profile can name — the kupot
// and the private carriers.
//
// These are brand-COLOURED marks, not the real trademarked logos: a coloured
// disc with the insurer's Hebrew initials. Colour is what makes an insurer
// recognisable at a glance, and it carries no licensing question. When real
// artwork is available, drop the file under /public and set `logoSrc` here —
// InsuranceLogo renders the image instead, and nothing else has to change.

export interface InsuranceBrand {
  /** The insurer's own colour, used as the disc background. */
  color: string;
  /** Two Hebrew letters, shown when there is no logo file. */
  initials: string;
  /** Optional path under /public — takes precedence over initials when set. */
  logoSrc?: string;
}

// Artwork lives in /public/logos/<slug>.png. Every brand already points at
// its file; InsuranceLogo falls back to the coloured initials for any file
// that isn't there yet, so brands can be dropped in one at a time.
const BRANDS: Record<string, InsuranceBrand> = {
  // Kupot
  "כללית": { color: "#00A651", initials: "כל", logoSrc: "/logos/clalit.png" },
  "מכבי": { color: "#0072CE", initials: "מכ", logoSrc: "/logos/maccabi.png" },
  "מאוחדת": { color: "#D6002A", initials: "מא", logoSrc: "/logos/meuhedet.png" },
  "לאומית": { color: "#5B2D8E", initials: "לא", logoSrc: "/logos/leumit.png" },
  // שב"ן plans. Each carries its own branding — "מכבי שלי" is not the מכבי
  // mark — so every plan gets its own entry rather than inheriting its
  // kupah's. The colour stays the kupah's, since the plan belongs to it.
  "כללית בסיס": { color: "#00A651", initials: "בס", logoSrc: "/logos/clalit-basis.png" },
  "כללית מושלם": { color: "#00A651", initials: "מו", logoSrc: "/logos/clalit-mushlam.png" },
  "כללית פלטינום": { color: "#00A651", initials: "פל", logoSrc: "/logos/clalit-platinum.png" },
  "מכבי בסיס": { color: "#0072CE", initials: "בס", logoSrc: "/logos/maccabi-basis.png" },
  "מכבי שלי": { color: "#0072CE", initials: "של", logoSrc: "/logos/maccabi-sheli.png" },
  "מכבי כסף": { color: "#0072CE", initials: "כס", logoSrc: "/logos/maccabi-kesef.png" },
  "מאוחדת בסיס": { color: "#D6002A", initials: "בס", logoSrc: "/logos/meuhedet-basis.png" },
  "מאוחדת עדיף": { color: "#D6002A", initials: "עד", logoSrc: "/logos/meuhedet-adif.png" },
  "מאוחדת שיא": { color: "#D6002A", initials: "שי", logoSrc: "/logos/meuhedet-sia.png" },
  "לאומית בסיס": { color: "#5B2D8E", initials: "בס", logoSrc: "/logos/leumit-basis.png" },
  "לאומית זהב": { color: "#5B2D8E", initials: "זה", logoSrc: "/logos/leumit-zahav.png" },
  // Private carriers
  "הראל": { color: "#00539B", initials: "הר", logoSrc: "/logos/harel.png" },
  "מגדל": { color: "#1B3A93", initials: "מג", logoSrc: "/logos/migdal.png" },
  "הפניקס": { color: "#E87722", initials: "פנ", logoSrc: "/logos/phoenix.png" },
  "כלל": { color: "#005EB8", initials: "כל", logoSrc: "/logos/clal.png" },
  "מנורה מבטחים": { color: "#C8102E", initials: "מנ", logoSrc: "/logos/menora.png" },
  "איילון": { color: "#E8A33D", initials: "אי", logoSrc: "/logos/ayalon.png" },
  AIG: { color: "#003DA5", initials: "AIG", logoSrc: "/logos/aig.png" },
  "שירביט": { color: "#7C3AED", initials: "שי", logoSrc: "/logos/shirbit.png" },
};

const FALLBACK: InsuranceBrand = { color: "#475569", initials: "??" };

/**
 * The brand for an insurer or plan name. Named plans have their own entries
 * above and match exactly; the substring pass below is only a safety net, so
 * an unlisted plan still shows its kupah's mark rather than nothing.
 */
export function brandFor(name?: string | null): InsuranceBrand {
  if (!name) return FALLBACK;
  const exact = BRANDS[name];
  if (exact) return exact;
  // Also resolves a whole sentence that names an insurer inside it, e.g.
  // "מחיר הסדר · מכבי שלי". Longest name first, so "כללית" is matched before
  // the shorter, unrelated "כלל".
  const owner = Object.keys(BRANDS)
    .sort((a, b) => b.length - a.length)
    .find((brand) => name.includes(brand));
  return owner ? BRANDS[owner] : { ...FALLBACK, initials: name.slice(0, 2) };
}
