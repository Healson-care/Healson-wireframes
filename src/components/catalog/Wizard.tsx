"use client";

import { ReactNode } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { BodyRegionMeta, BODY_REGIONS, KUPAH_LOGOS } from "@/lib/medical-tree";
import { CatalogItem, Kupah } from "@/types";
import { Check } from "lucide-react";

export const STEP_LABELS = ["איזור בגוף", "קופת חולים", "תחום רפואי", "תת-תחום", "תוצאות"];

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

export function OptionGrid({
  options,
  onSelect,
  renderIcon,
}: {
  options: string[];
  onSelect: (value: string) => void;
  renderIcon?: (value: string) => ReactNode;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-right transition hover:border-primary hover:shadow-md hover:-translate-y-0.5"
        >
          {renderIcon && <span className="text-xl">{renderIcon(opt)}</span>}
          <span className="text-sm font-medium text-slate-700">{opt}</span>
        </button>
      ))}
    </div>
  );
}

export function KupahLogo({ kupah }: { kupah: string }) {
  return <span className="text-xl">{KUPAH_LOGOS[kupah] ?? "🏥"}</span>;
}

export function PriceCalculator({ item, kupah }: { item: CatalogItem; kupah: Kupah }) {
  const priceEntry = item.price_K.find((p) => p.kupah === kupah);
  if (!priceEntry) return <p className="text-sm text-slate-400">אין מחיר עבור קופה זו</p>;
  const discount = priceEntry.discount ?? 0;
  const finalPrice = priceEntry.price - (priceEntry.price * discount) / 100;
  return (
    <div className="flex items-baseline gap-2">
      {discount > 0 && (
        <span className="text-sm text-slate-400 line-through">{formatCurrency(priceEntry.price)}</span>
      )}
      <span className="text-lg font-bold text-primary">{formatCurrency(finalPrice)}</span>
      {discount > 0 && <span className="text-xs font-medium text-emerald-600">{discount}% הנחה</span>}
    </div>
  );
}
