"use client";

import { Plane } from "lucide-react";
import { InsuranceLogo } from "@/components/search/InsuranceLogo";
import { InsuranceLayer, Patient } from "@/types";

/** Caption colours — the same hues as the discs' rings and the price dots. */
const LAYER_CAPTION: Record<InsuranceLayer, string> = {
  S: "text-teal-700",
  K: "text-amber-700",
  B: "text-blue-700",
  H: "text-slate-600",
};

/**
 * The patient's insurance identity, worn at the top of the search: her actual
 * insurers, each in its own brand colour and ringed in its SKBH layer's hue.
 * Before a single price is read this answers "who are these numbers for?",
 * and the layer rings are the key to every layer-coloured dot further down.
 */
export function InsuranceProfileStrip({ patient }: { patient: Patient }) {
  // One disc per LAYER, because the layer is what every price refers back to.
  // The kupah appears twice — once for the basket, once for the שב"ן it sold
  // her — so each disc carries its layer's caption; without it two identical
  // מכבי discs would be indistinguishable.
  const marks: { key: string; name: string; layer: InsuranceLayer; caption: string; title: string }[] = [];
  if (patient.kupah) {
    marks.push({
      key: "S",
      name: patient.kupah,
      layer: "S",
      caption: "סל",
      title: `סל הבריאות · ${patient.kupah}`,
    });
  }
  if (patient.k_level) {
    marks.push({
      key: "K",
      name: patient.k_level,
      layer: "K",
      caption: 'שב"ן',
      title: `שב"ן · ${patient.k_level}`,
    });
  }
  // Every private policy she holds gets its own disc — a patient may hold
  // several at once, unlike a kupah.
  for (const insurance of patient.b_insurances ?? []) {
    marks.push({
      key: `B:${insurance.company}`,
      name: insurance.company,
      layer: "B",
      caption: "פרטי",
      title: `ביטוח פרטי · ${insurance.company}`,
    });
  }

  // No kupah = a tourist: the H route replaces the whole insurance profile,
  // so the strip says that once for the entire page instead of per price.
  if (marks.length === 0) {
    return (
      <div className="mb-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-600 text-white">
          <Plane className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-800">פרופיל תייר — המחירים לפי מחיר תייר</p>
          <p className="text-[11px] text-slate-500">ללא קופת חולים ישראלית, הסדרים והחזרים אינם רלוונטיים</p>
        </div>
      </div>
    );
  }

  const summary = [patient.kupah, patient.k_level, ...(patient.b_insurances ?? []).map((i) => i.company)]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/70 bg-white/85 px-3 py-2.5 shadow-[0_18px_40px_-30px_rgba(20,42,79,0.4)] backdrop-blur-sm">
      {/* gap, not overlap: the layer rings are the point, and overlapping
          discs would clip the ring that identifies each one. */}
      <div className="flex shrink-0 items-start gap-2.5">
        {marks.map((mark) => (
          <span key={mark.key} className="flex w-9 flex-col items-center gap-0.5">
            <InsuranceLogo name={mark.name} layers={[mark.layer]} title={mark.title} />
            <span className={`text-[9px] font-semibold leading-none ${LAYER_CAPTION[mark.layer]}`}>
              {mark.caption}
            </span>
          </span>
        ))}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[var(--brand-navy)]">המחירים מותאמים לפרופיל הביטוחי שלך</p>
        <p className="truncate text-[11px] text-[var(--brand-ink-soft)]">{summary}</p>
      </div>
    </div>
  );
}
