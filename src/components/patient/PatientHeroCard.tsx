"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronUp, Plane, Plus } from "lucide-react";
import { InsuranceLogo } from "@/components/search/InsuranceLogo";
import { insuranceMarks } from "@/components/search/InsuranceProfileStrip";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { InsuranceLayer, Patient } from "@/types";

const DISC_SIZE = 34;

/** The three layers a patient can hold, in the order the resolver prefers
 *  them (see ARRANGEMENT_PRIORITY in lib/pricing.ts). H is not here: a
 *  tourist holds no layers at all, so it replaces this list rather than
 *  extending it. */
const PATIENT_LAYERS = ["S", "K", "B"] as const;
type PatientLayer = (typeof PATIENT_LAYERS)[number];

/**
 * The SKB model in the patient's own terms — what each layer DOES for her,
 * not what it is called internally. Wording follows the funding routes in
 * lib/pricing.ts: S pays nothing (subject to a טופס 17 commitment), K and B
 * either discount the price via an arrangement or may reimburse afterwards —
 * an amount this system never calculates.
 */
const LAYER_INFO: Record<PatientLayer, { term: string; held: string; missing: string }> = {
  S: {
    term: "סל (קופה)",
    held: "שירותים שבסל הבריאות — ללא תשלום, בכפוף להתחייבות מהקופה (טופס 17)",
    missing: "בלי קופת חולים אין כיסוי סל, והמחירים מוצגים כמחיר תייר",
  },
  K: {
    term: 'שב"ן',
    held: "מחיר הסדר מוזל אצל מי שבהסדר עם הקופה, או החזר בדיעבד",
    missing: 'הוסיפו שב"ן כדי לראות מחירי הסדר של הקופה',
  },
  B: {
    term: "ביטוח פרטי",
    held: "מחיר הסדר מוזל אצל מי שבהסדר עם המבטח, או החזר בדיעבד",
    missing: "הוסיפו ביטוח פרטי כדי לראות הסדרים והחזרים אפשריים",
  },
};

/** The letter badge's own colours — solid fill in the layer's hue with dark
 *  text, so the letter stays legible on navy and reads as the same layer as
 *  the ring around the disc it sits under. */
const LETTER_BADGE: Record<InsuranceLayer, string> = {
  S: "bg-teal-300 text-teal-950",
  K: "bg-amber-300 text-amber-950",
  B: "bg-blue-300 text-blue-950",
  H: "bg-slate-300 text-slate-900",
};

/**
 * The layer's letter, worn wherever that layer appears. This is the whole
 * point of showing S/K/B to patients at all: the letters are the vocabulary
 * the business speaks in, so the personal area teaches them once — badge
 * under the disc, decoded in the line right below it — and every later
 * mention costs nothing to read.
 */
function LetterBadge({ layer, muted = false }: { layer: InsuranceLayer; muted?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] text-[10px] font-bold leading-none ${
        muted ? "border border-dashed border-white/40 text-white/45" : LETTER_BADGE[layer]
      }`}
    >
      {layer}
    </span>
  );
}

// Two-letter monogram from the first two words of the name — Hebrew has no
// casing, so these are just the raw first letters.
function initials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

// Whole years, floored — only rendered when the patient actually has a
// date_of_birth on file (seeded patients don't).
function ageFrom(dateOfBirth: string) {
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function heldLayers(patient: Patient): Record<PatientLayer, boolean> {
  return {
    S: !!patient.kupah,
    K: !!patient.k_level,
    B: (patient.b_insurances?.length ?? 0) > 0,
  };
}

/** One line of the SKB legend, sitting directly under the discs so a colour
 *  seen up there is read down here. A layer she doesn't hold keeps its line
 *  — dimmed, hollow-dotted and linking to the profile — because the gap is
 *  the thing worth showing. */
function LayerLine({ layer, held, value }: { layer: PatientLayer; held: boolean; value?: string }) {
  const info = LAYER_INFO[layer];

  if (held) {
    return (
      <li className="flex items-start gap-2 text-[11px] leading-relaxed">
        <LetterBadge layer={layer} />
        <span className="min-w-0">
          <span className="font-semibold text-white/90">{info.term}</span>
          {value && <span className="text-white/70"> · {value}</span>}
          <span className="text-white/50"> — {info.held}</span>
        </span>
      </li>
    );
  }

  return (
    <li>
      <Link
        href="/client/profile"
        className="focus-ring group flex items-start gap-2 rounded-md text-[11px] leading-relaxed"
      >
        <LetterBadge layer={layer} muted />
        <span className="min-w-0 text-white/40 transition-colors group-hover:text-[var(--brand-gold-soft)]">
          <span className="font-semibold">{info.term}</span> — {info.missing}
        </span>
        <Plus className="mt-[3px] h-3 w-3 shrink-0 text-white/40 transition-colors group-hover:text-[var(--brand-gold-soft)]" />
      </Link>
    </li>
  );
}

function InsurancePanel({ patient }: { patient: Patient }) {
  const marks = insuranceMarks(patient);
  const held = heldLayers(patient);
  const complete = held.S && held.K && held.B;
  // Starts open only while something is still missing — then the fold is
  // carrying a call to action, not just a glossary.
  const [open, setOpen] = useState(!complete);

  // No kupah = tourist (route H): an EXCLUSIVE classification, not a missing
  // layer — so the SKB legend is replaced rather than dimmed. Someone holding
  // an Israeli ת"ז landing here has simply not filled the field in, and does
  // get a way back.
  if (marks.length === 0) {
    const looksLikeTourist = patient.id_document_type === "passport";
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3.5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
            <Plane className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white/90">פרופיל תייר</p>
            <p className="text-[11px] text-white/55">
              ללא קופת חולים ישראלית המחירים מוצגים כמחיר תייר, והסדרים והחזרים אינם רלוונטיים
            </p>
          </div>
        </div>
        {!looksLikeTourist && (
          <Link
            href="/client/profile"
            className="focus-ring mt-2.5 flex items-center gap-1 rounded-md text-[11px] font-medium text-white/60 transition-colors hover:text-[var(--brand-gold-soft)]"
          >
            <Plus className="h-3 w-3 shrink-0" />
            יש לך קופת חולים? הוסיפו אותה כדי לראות מחירים מותאמים
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3.5">
      {/* gap, not overlap — the layer rings are the point, and overlapping
          discs would clip the ring that identifies each one. */}
      <div className="flex items-start gap-2.5">
        {marks.map((mark) => (
          <span key={mark.key} className="flex w-10 flex-col items-center gap-1.5">
            <InsuranceLogo name={mark.name} layers={[mark.layer]} size={DISC_SIZE} title={mark.title} />
            <LetterBadge layer={mark.layer} />
          </span>
        ))}
      </div>

      {/* The SKB model itself, right under the discs it colour-codes — folded
          away once there's nothing left to complete, so a patient who already
          knows her profile isn't re-taught it on every visit. */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="focus-ring mt-3 flex w-full items-center gap-1 rounded-md border-t border-dashed border-white/15 pt-2.5 text-[11px] font-medium text-white/60 transition-colors hover:text-[var(--brand-gold-soft)]"
      >
        {open ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
        מה זה S · K · B?
        {!complete && (
          <span className="mr-auto text-[10px] font-normal text-[var(--brand-gold-soft)]/80">
            הפרופיל שלך חלקי
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <ul className="flex flex-col gap-1.5 pt-2.5">
              {PATIENT_LAYERS.map((layer) => (
                <LayerLine
                  key={layer}
                  layer={layer}
                  held={held[layer]}
                  value={
                    layer === "S"
                      ? patient.kupah
                      : layer === "K"
                      ? patient.k_level
                      : patient.b_insurances?.map((i) => i.company).join(", ")
                  }
                />
              ))}
            </ul>

            {(held.K || held.B) && (
              <p className="mt-2 text-[10px] text-white/35">
                סכומי החזר אינם מחושבים כאן — הזכאות היא מולך ומול המבטח
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Replaces the old "שלום, <שם>" greeting at the top of the personal area with
 * the patient herself: who she is, the insurers she carries — drawn as the
 * very same layer-ringed discs the search page prices against (see
 * InsuranceProfileStrip) — and, underneath them, what each of those layers
 * actually does for her.
 */
export function PatientHeroCard() {
  const currentUser = useStore((s) => s.currentUser);
  const patient = useCurrentPatient();

  const fullName = patient?.full_name ?? currentUser?.full_name ?? "מטופל";
  const age = patient?.date_of_birth ? ageFrom(patient.date_of_birth) : null;
  const phone = patient?.phone ?? currentUser?.phone;
  const idLabel = patient?.id_document_type === "passport" ? "דרכון" : "ת.ז";

  const details = [
    patient?.id_number && `${idLabel} ${patient.id_number}`,
    age !== null && `בן/בת ${age}`,
    phone,
  ].filter(Boolean) as string[];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative mb-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[var(--brand-navy)] via-[var(--brand-navy-800)] to-[var(--brand-navy-900)] p-5 text-white shadow-[0_30px_60px_-32px_rgba(15,33,64,0.8)] sm:p-7"
    >
      {/* The gold hairline and inner glow are what make the navy read as a
          brand surface rather than a coloured box — straight off /apply. */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-[var(--brand-gold)]/60 to-transparent" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(198,161,91,0.16),transparent_58%)]"
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-gold-soft)] to-[var(--brand-gold-deep)] text-lg font-bold text-[var(--brand-navy)] shadow-[0_12px_28px_-14px_rgba(198,161,91,0.95)] ring-1 ring-[var(--brand-gold-soft)]/40">
              {initials(fullName)}
            </span>
            <div className="min-w-0">
              <span className="text-[10px] font-semibold tracking-wide text-[var(--brand-gold-soft)]/80">
                האזור האישי
              </span>
              <h1 className="font-display text-[22px] font-bold leading-tight sm:text-[26px]">{fullName}</h1>
              {details.length > 0 && (
                <p className="mt-0.5 truncate text-[12px] text-white/55">{details.join(" · ")}</p>
              )}
            </div>
          </div>

          {patient && (
            <Link
              href="/client/profile"
              className="focus-ring flex shrink-0 items-center gap-0.5 rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-medium text-white/70 transition-colors hover:border-[var(--brand-gold)]/50 hover:text-[var(--brand-gold-soft)]"
            >
              עריכה
              <ChevronLeft className="h-3 w-3" />
            </Link>
          )}
        </div>

        <div className="my-4 h-px bg-gradient-to-l from-transparent via-[var(--brand-gold)]/45 to-transparent" />

        {/* No Patient record at all (the "מטופל חדש" demo login) — there's no
            insurance profile to draw yet, so the panel collapses into the same
            registration CTA the search page gates booking behind. */}
        {patient ? (
          <InsurancePanel patient={patient} />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3.5">
            <p className="text-xs text-white/65">כדי לראות מחירים מותאמים אישית צריך פרופיל ביטוחי</p>
            <Link
              href="/register"
              className="focus-ring flex items-center gap-1.5 rounded-full border border-[var(--brand-gold)]/40 bg-[var(--brand-gold)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--brand-gold-soft)] transition-colors hover:bg-[var(--brand-gold)]/20"
            >
              <Plus className="h-3.5 w-3.5" />
              השלימו פרופיל ביטוחי
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
}
