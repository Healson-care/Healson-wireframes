"use client";

import { Card } from "@/components/ui/Card";
import { generateId } from "@/lib/utils";
import {
  INSURANCE_LAYERS,
  KUPOT,
  KupahArrangement,
  LAYER_LABELS,
  InsuranceLayer,
  Kupah,
  ProviderAgreement,
} from "@/types";
import { KupahArrangementPicker, PrivateInsurerPicker } from "@/components/provider/KupahArrangementPicker";

/** S/K/B/H agreement editor (§6.3, §8.3 PRV-07) — which insurance layers a
 * provider currently works with. Layer S (basic קופה coverage) is tracked at
 * the generic קופה level; layer K (שב"ן) and layer B (private insurance) are
 * tracked at the specific plan/carrier level via ProviderProfile's
 * kupah_arrangements / private_insurance_companies, so a provider can hold
 * more than one plan of the same קופה (e.g. both מאוחדת עדיף and מאוחדת שיא). */
export function AgreementsSection({
  providerId,
  agreements,
  onChange,
  kupahArrangements,
  onKupahArrangementsChange,
  privateInsuranceCompanies,
  onPrivateInsuranceCompaniesChange,
  layers = INSURANCE_LAYERS,
}: {
  providerId: string;
  agreements: ProviderAgreement[];
  onChange: (agreements: ProviderAgreement[]) => void;
  kupahArrangements: KupahArrangement[];
  onKupahArrangementsChange: (value: KupahArrangement[]) => void;
  privateInsuranceCompanies: string[];
  onPrivateInsuranceCompaniesChange: (value: string[]) => void;
  /** Which layers this provider can hold at all. An individual נותן שירות never
   * bills סל קופה (S) — the basket is contracted with a יחידה, not a person —
   * so that layer is left out entirely rather than shown and refused. */
  layers?: InsuranceLayer[];
}) {
  function agreementFor(layer: InsuranceLayer) {
    return agreements.find((a) => a.layer === layer);
  }

  function toggleLayer(layer: InsuranceLayer, enabled: boolean) {
    if (enabled) {
      onChange([...agreements, { id: generateId("agr"), provider_id: providerId, layer }]);
    } else {
      onChange(agreements.filter((a) => a.layer !== layer));
    }
  }

  function toggleKupah(kupah: Kupah) {
    const agreement = agreementFor("S");
    if (!agreement) return;
    const list = agreement.kupah_list ?? [];
    const next = list.includes(kupah) ? list.filter((k) => k !== kupah) : [...list, kupah];
    onChange(agreements.map((a) => (a.layer === "S" ? { ...a, kupah_list: next } : a)));
  }

  return (
    <div className="flex flex-col gap-3">
      {layers.map((layer) => {
        const agreement = agreementFor(layer);
        const enabled = !!agreement;
        return (
          <Card key={layer} className="p-4">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => toggleLayer(layer, e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-primary"
              />
              <span className="font-medium text-slate-900">{LAYER_LABELS[layer]}</span>
              <span className="text-xs text-slate-400">({layer})</span>
            </label>

            {enabled && layer === "S" && (
              <div className="mt-3 flex flex-wrap gap-2">
                {KUPOT.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleKupah(k)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      agreement?.kupah_list?.includes(k)
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            )}

            {enabled && layer === "K" && (
              <div className="mt-3">
                <KupahArrangementPicker value={kupahArrangements} onChange={onKupahArrangementsChange} />
              </div>
            )}

            {enabled && layer === "B" && (
              <div className="mt-3">
                {/* Same picker as the application form — including "אחר", so a
                    carrier the provider typed there survives an edit here. */}
                <PrivateInsurerPicker
                  label="חברות ביטוח פרטיות שאיתן יש הסדר"
                  value={privateInsuranceCompanies}
                  onChange={onPrivateInsuranceCompaniesChange}
                />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
