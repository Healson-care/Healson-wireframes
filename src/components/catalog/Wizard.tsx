"use client";

import { cn, formatCurrency } from "@/lib/utils";
import { BodyRegionMeta, BODY_REGIONS } from "@/lib/medical-tree";
import { resolveCatalogPrice } from "@/lib/pricing";
import { CatalogItem, LAYER_LABELS, Patient } from "@/types";
import { Check } from "lucide-react";

export const STEP_LABELS = ["איזור בגוף", "תחום רפואי", "תת-תחום", "תוצאות"];

export function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-between mb-6">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex flex-1 items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all",
                i < step
                  ? "bg-primary text-white"
                  : i === step
                  ? "bg-primary text-white scale-110 shadow"
                  : "bg-slate-100 text-slate-400"
              )}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className="text-[10px] text-slate-500 hidden sm:block whitespace-nowrap">{label}</span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={cn("h-0.5 flex-1 mx-1", i < step ? "bg-primary" : "bg-slate-100")} />
          )}
        </div>
      ))}
    </div>
  );
}

export function BodyMap({ onSelect }: { onSelect: (region: BodyRegionMeta) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {BODY_REGIONS.map((region) => (
        <button
          key={region.id}
          onClick={() => onSelect(region)}
          className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-primary hover:shadow-md hover:-translate-y-0.5"
        >
          <span className="text-3xl">{region.emoji}</span>
          <span className="text-sm font-medium text-slate-700">{region.label}</span>
        </button>
      ))}
    </div>
  );
}

export interface SelectableOption {
  id: string;
  label: string;
}

export function OptionGrid({
  options,
  onSelect,
}: {
  options: SelectableOption[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onSelect(opt.id)}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-right transition hover:border-primary hover:shadow-md hover:-translate-y-0.5"
        >
          <span className="text-sm font-medium text-slate-700">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Reference price breakdown by SKBH layer, for staff-facing lookup tools
 * (/catalog, /medical) that aren't tied to one specific logged-in patient. */
export function PriceCalculator({ item }: { item: CatalogItem }) {
  const layers = (["K", "B", "H"] as const).map((layer) => ({
    layer,
    price:
      layer === "K"
        ? Math.round(item.base_price * 0.25)
        : layer === "B"
        ? Math.round(item.base_price * 0.15)
        : item.base_price,
  }));
  return (
    <div className="flex flex-col gap-1">
      {layers.map((l) => (
        <div key={l.layer} className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-400">{LAYER_LABELS[l.layer]}</span>
          <span className="font-semibold text-primary">{formatCurrency(l.price)}</span>
        </div>
      ))}
    </div>
  );
}

/** Actual price for the logged-in patient, resolved from their SKBH profile
 * (§7.1) — used on the patient-facing catalog search. */
export function PatientPriceTag({ item, patient }: { item: CatalogItem; patient: Patient | null | undefined }) {
  if (!patient) {
    return <span className="text-sm text-slate-400">התחברו לצפייה במחיר</span>;
  }
  const resolved = resolveCatalogPrice(item.base_price, patient);
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-lg font-bold text-primary">{formatCurrency(resolved.price)}</span>
      <span className="text-xs font-medium text-emerald-600">{LAYER_LABELS[resolved.layer]}</span>
    </div>
  );
}
