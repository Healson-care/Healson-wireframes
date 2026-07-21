"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { MohCode, findMohCode, searchMohCodes } from "@/lib/moh-codes";
import { PROVIDER_SERVICE_TYPE_LABELS, ProviderServiceType } from "@/types";
import { Check, FileSearch, X } from "lucide-react";

/** Search-and-pick from the Ministry of Health code book (§PRV-09).
 *
 * A בדיקה / הדמייה / פעולה / ניתוח must carry its official MOH code, so the
 * provider searches the book (by code, name or the mixed Hebrew/English they
 * actually say — "mri ברך") instead of typing a name freely. The picker is
 * scoped to the clinical classification currently selected, which is what makes
 * a short list navigable. */
export function MohCodePicker({
  serviceType,
  value,
  onChange,
}: {
  serviceType: ProviderServiceType;
  value?: string;
  onChange: (code: string | undefined) => void;
}) {
  const [query, setQuery] = useState("");
  const selected = findMohCode(value);
  const results = useMemo(() => searchMohCodes(query, serviceType), [query, serviceType]);

  if (selected) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-700">קוד משרד הבריאות</span>
        <div className="flex items-center gap-2 rounded-lg border border-success-border bg-success-bg px-3 py-2">
          <Check className="h-4 w-4 shrink-0 text-success-text" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-success-text">
              {selected.code} · {selected.name_he}
            </p>
            <p className="truncate text-[11px] text-success-text/80">{selected.group}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setQuery("");
            }}
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-success-text hover:bg-white/60"
          >
            <X className="h-3 w-3" /> החלף קוד
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        label="קוד משרד הבריאות"
        icon={<FileSearch className="h-4 w-4" />}
        placeholder={`חיפוש בספר הקודים — ${PROVIDER_SERVICE_TYPE_LABELS[serviceType]}`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        hint="חיפוש לפי קוד, שם הבדיקה או מילה נרדפת (למשל: mri, בקע, ספירת דם)"
        required
      />
      <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200">
        {results.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-400">
            לא נמצא קוד תואם. נסו מונח אחר, או שנו את הסיווג הקליני מעל.
          </p>
        ) : (
          results.map((code) => <CodeRow key={code.code} code={code} onPick={() => onChange(code.code)} />)
        )}
      </div>
    </div>
  );
}

function CodeRow({ code, onPick }: { code: MohCode; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-right transition-colors last:border-b-0",
        "hover:bg-primary/5"
      )}
    >
      <Badge tone="slate">{code.code}</Badge>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-slate-800">{code.name_he}</span>
        <span className="block truncate text-[11px] text-slate-400">{code.group}</span>
      </span>
    </button>
  );
}
