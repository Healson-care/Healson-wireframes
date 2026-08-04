"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useStore } from "@/lib/store";
import {
  BALANCE_COLLECTOR_LABELS,
  INSURANCE_LAYERS,
  LAYER_LABELS,
  ProviderProfile,
} from "@/types";
import { Building2, Lock } from "lucide-react";

/** Insurance arrangements are declared ONCE, by the medical unit, and every
 * provider working under it inherits them (payments meeting §5) — a patient's
 * cover depends on the contracting entity that bills the payer, not on which
 * doctor happened to see them. So an affiliated provider reads the unit's
 * arrangements here instead of maintaining a second, divergent set of their own.
 *
 * Rendered for any provider with at least one live affiliation; a provider who
 * ALSO runs their own clinic keeps their own editor above this card, for the
 * work they bill themselves. */
export function InheritedArrangementsCard({ provider }: { provider: ProviderProfile }) {
  const affiliations = useStore((s) => s.affiliations);
  const providers = useStore((s) => s.providers);

  const units = useMemo(() => {
    const live = affiliations.filter(
      (a) => a.provider_id === provider.id && (a.status === "active" || a.status === "unclaimed")
    );
    return live
      .map((a) => providers.find((p) => p.id === a.unit_id))
      .filter((u): u is ProviderProfile => !!u);
  }, [affiliations, providers, provider.id]);

  if (units.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-slate-400" /> הסדרים מכוח שיוך ליחידה
        </CardTitle>
        <p className="text-sm text-slate-500">
          בפעילות שלך בתוך יחידה רפואית חלים ההסדרים של היחידה — הם מוגדרים על ידה בלבד ומוצגים כאן לצפייה.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {units.map((unit) => {
          const layers = INSURANCE_LAYERS.filter((layer) =>
            unit.agreements.some((a) => a.layer === layer)
          );
          const sAgreement = unit.agreements.find((a) => a.layer === "S");
          return (
            <div key={unit.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{unit.display_name}</p>
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Lock className="h-3 w-3" /> נקבע על ידי היחידה
                </span>
              </div>

              {layers.length === 0 ? (
                <p className="mt-1.5 text-xs text-slate-400">היחידה טרם הגדירה הסדרי ביטוח.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {layers.map((layer) => (
                    <Badge key={layer} tone="blue">
                      {LAYER_LABELS[layer]} ({layer})
                    </Badge>
                  ))}
                </div>
              )}

              {(sAgreement?.kupah_list?.length ?? 0) > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  קופות בסל: {sAgreement!.kupah_list!.join(" · ")}
                </p>
              )}
              {(unit.kupah_arrangements?.length ?? 0) > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  שב&quot;ן: {unit.kupah_arrangements!.map((a) => a.level).join(" · ")}
                </p>
              )}
              {(unit.private_insurance_companies?.length ?? 0) > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  ביטוחים פרטיים: {unit.private_insurance_companies!.join(" · ")}
                </p>
              )}
              <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                גביית יתרה בתורים של היחידה: {BALANCE_COLLECTOR_LABELS[unit.balance_collector ?? "healson"]}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
