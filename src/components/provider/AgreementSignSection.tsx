"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDateHe } from "@/lib/utils";
import { CheckCircle2, FileSignature } from "lucide-react";

const AGREEMENT_TEXT =
  "אני מאשר/ת כי קראתי את הסכם ההתקשרות עם HEALSON, לרבות מדיניות העמלות על עסקאות שיבוצעו דרך הפלטפורמה, " +
  "ואני מסכים/ה לתנאיו. גרסת מסמך: AGREEMENT-2026-v1.";

/** Step 3 of the onboarding wizard (FEAT-05) — MVP e-signature: a required
 * checkbox + timestamp, not a legally-binding digital signature. */
export function AgreementSignSection({
  signedAt,
  onSign,
}: {
  signedAt?: string;
  onSign: () => void;
}) {
  const [agreed, setAgreed] = useState(false);

  if (signedAt) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3 text-success-text">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">ההסכם נחתם בתאריך {formatDateHe(signedAt)}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <FileSignature className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" />
        <p className="text-sm text-slate-600 leading-relaxed">{AGREEMENT_TEXT}</p>
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 cursor-pointer hover:border-primary/40">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-primary"
        />
        <span className="text-sm text-slate-700">קראתי ואני מסכים/ה לתנאי ההסכם ולמדיניות העמלות</span>
      </label>
      <Button className="self-start" disabled={!agreed} onClick={onSign}>
        חתום על ההסכם
      </Button>
    </Card>
  );
}
