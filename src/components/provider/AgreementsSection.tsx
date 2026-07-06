"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { generateId } from "@/lib/utils";
import { INSURANCE_LAYERS, KUPOT, LAYER_LABELS, InsuranceLayer, Kupah, ProviderAgreement } from "@/types";

/** S/K/B/H agreement editor (§6.3, §8.3 PRV-07) — which insurance layers a
 * provider currently works with, and the layer-specific eligibility scope
 * (which kupot for K, which insurance companies for B). */
export function AgreementsSection({
  providerId,
  agreements,
  onChange,
}: {
  providerId: string;
  agreements: ProviderAgreement[];
  onChange: (agreements: ProviderAgreement[]) => void;
}) {
  const [companiesDraft, setCompaniesDraft] = useState<Record<InsuranceLayer, string>>(() => {
    const draft = {} as Record<InsuranceLayer, string>;
    for (const layer of INSURANCE_LAYERS) {
      draft[layer] = agreements.find((a) => a.layer === layer)?.insurance_companies?.join(", ") ?? "";
    }
    return draft;
  });

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

  function toggleKupah(layer: InsuranceLayer, kupah: Kupah) {
    onChange(
      agreements.map((a) => {
        if (a.layer !== layer) return a;
        const list = a.kupah_list ?? [];
        const next = list.includes(kupah) ? list.filter((k) => k !== kupah) : [...list, kupah];
        return { ...a, kupah_list: next };
      })
    );
  }

  function updateCompanies(layer: InsuranceLayer, text: string) {
    setCompaniesDraft((d) => ({ ...d, [layer]: text }));
    const companies = text
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    onChange(agreements.map((a) => (a.layer === layer ? { ...a, insurance_companies: companies } : a)));
  }

  return (
    <div className="flex flex-col gap-3">
      {INSURANCE_LAYERS.map((layer) => {
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

            {enabled && (layer === "S" || layer === "K") && (
              <div className="mt-3 flex flex-wrap gap-2">
                {KUPOT.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleKupah(layer, k)}
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

            {enabled && layer === "B" && (
              <div className="mt-3">
                <Input
                  label="חברות ביטוח מוכרות (מופרד בפסיקים)"
                  placeholder="כלל, הראל, מגדל"
                  value={companiesDraft[layer]}
                  onChange={(e) => updateCompanies(layer, e.target.value)}
                />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
