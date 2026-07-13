import { Tag, ReceiptText, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { PriceBreakdown } from "@/lib/pricing";

function listSources(sources: string[]) {
  if (sources.length === 1) return `מ-${sources[0]}`;
  return sources
    .slice(0, -1)
    .map((s) => `מ-${s}`)
    .join(", ") + ` ומ-${sources[sources.length - 1]}`;
}

export function InsurancePriceBlock({ breakdown }: { breakdown: PriceBreakdown }) {
  if (breakdown.arrangement) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-xs text-slate-400 line-through decoration-slate-300">
          {formatCurrency(breakdown.privatePrice)}
        </span>
        <span className="flex items-center gap-1.5 rounded-lg bg-success-bg px-2.5 py-1 text-success-text">
          <Tag className="h-3.5 w-3.5" />
          <span className="text-lg font-bold leading-none">{formatCurrency(breakdown.arrangement.price)}</span>
        </span>
        <span className="text-[11px] font-medium text-success-text">{breakdown.arrangement.label}</span>
      </div>
    );
  }

  if (breakdown.reimbursementSources && breakdown.reimbursementSources.length > 0) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-sm font-semibold text-slate-800">{formatCurrency(breakdown.privatePrice)}</span>
        <span className="flex items-center gap-1 rounded-full bg-info-bg px-2 py-0.5 text-[11px] font-medium text-info-text">
          <ReceiptText className="h-3 w-3 shrink-0" /> זכאי/ת להחזר {listSources(breakdown.reimbursementSources)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-sm font-semibold text-slate-800">{formatCurrency(breakdown.privatePrice)}</span>
      <span className="flex items-center gap-1 text-[11px] text-slate-400">
        <Info className="h-3 w-3 shrink-0" /> אין הסדר או החזר לפרופיל הביטוחי שלך
      </span>
    </div>
  );
}
