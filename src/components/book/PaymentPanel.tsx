"use client";

import { useState } from "react";
import { CreditCard, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { HoldTimer } from "@/components/book/HoldTimer";
import { formatCurrency } from "@/lib/utils";
import { InsuranceLayer, Kupah, LAYER_LABELS, ProviderProfile } from "@/types";

export function PaymentPanel({
  provider,
  selectedSlot,
  kupah,
  layer,
  price,
  holdExpiresAt,
  onExpire,
  payMethod,
  onPayMethodChange,
  paying,
  onPay,
}: {
  provider: ProviderProfile;
  selectedSlot: { date: string; time: string; label: string };
  kupah?: Kupah;
  layer?: InsuranceLayer;
  price: number;
  holdExpiresAt: number;
  onExpire: () => void;
  payMethod: "card" | "apple" | "google";
  onPayMethodChange: (method: "card" | "apple" | "google") => void;
  paying: boolean;
  onPay: () => void;
}) {
  const [saveCard, setSaveCard] = useState(false);
  const depositAmount = Math.round(price * 0.3);
  const balanceAmount = price - depositAmount;

  return (
    <div>
      <div className="text-center mb-4">
        <HoldTimer expiresAt={holdExpiresAt} onExpire={onExpire} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-5">
        <p className="text-xs text-slate-400 mb-2">סיכום ההזמנה</p>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">רופא</span>
          <span className="font-medium text-slate-900">
            {provider.title} {provider.display_name}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-slate-500">תאריך ושעה</span>
          <span className="font-medium text-slate-900">
            {selectedSlot.label} · {selectedSlot.time}
          </span>
        </div>
        {kupah && (
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-slate-500">קופת חולים</span>
            <span className="font-medium text-slate-900">{kupah}</span>
          </div>
        )}
        {layer && (
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-slate-500">שכבת ביטוח</span>
            <span className="font-medium text-emerald-700">{LAYER_LABELS[layer]}</span>
          </div>
        )}
        <div className="h-px bg-slate-100 my-3" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">מקדמה לתשלום</span>
          <span className="text-lg font-bold text-primary">{formatCurrency(depositAmount)}</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          לשריון התור נדרש תשלום מקדמה עכשיו. היתרה תיגבה במועד התור.
        </p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-slate-400">יתרה לתשלום בתור</span>
          <span className="text-[11px] text-slate-400">{formatCurrency(balanceAmount)}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-700 mb-3">אמצעי תשלום</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button
            onClick={() => onPayMethodChange("card")}
            className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium ${payMethod === "card" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500"}`}
          >
            <CreditCard className="h-4 w-4" /> כרטיס אשראי
          </button>
          <button
            onClick={() => onPayMethodChange("apple")}
            className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium ${payMethod === "apple" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500"}`}
          >
            <Smartphone className="h-4 w-4" /> Apple Pay
          </button>
          <button
            onClick={() => onPayMethodChange("google")}
            className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium ${payMethod === "google" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500"}`}
          >
            <Smartphone className="h-4 w-4" /> Google Pay
          </button>
        </div>
        {payMethod === "card" && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="col-span-2">
              <Input placeholder="מספר כרטיס" dir="ltr" defaultValue="4580 •••• •••• 1234" />
            </div>
            <Input placeholder="MM/YY" dir="ltr" defaultValue="08/28" />
            <Input placeholder="CVV" dir="ltr" defaultValue="•••" />
            <label className="col-span-2 flex items-center gap-2 text-xs text-slate-500 mt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={saveCard}
                onChange={(e) => setSaveCard(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              שמור את פרטי הכרטיס לתשלומים הבאים (הדגמה)
            </label>
          </div>
        )}
        <p className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-4">
          <ShieldCheck className="h-3.5 w-3.5" /> תשלום מאובטח בתקן PCI DSS · מצב הדגמה, לא מתבצע חיוב אמיתי
        </p>
        <Button size="lg" className="w-full" loading={paying} onClick={onPay}>
          שלם {formatCurrency(depositAmount)} ואשר תור
        </Button>
      </div>
    </div>
  );
}
