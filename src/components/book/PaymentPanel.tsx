"use client";

import { useState } from "react";
import { CreditCard, FileCheck2, MapPin, ShieldCheck, Smartphone, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { HoldTimer } from "@/components/book/HoldTimer";
import { PreparationRequirements } from "@/components/book/PreparationRequirements";
import { resolveBalanceAmount, resolveDepositAmount } from "@/lib/deposit";
import { requiresReferral } from "@/lib/referral";
import { formatCurrency } from "@/lib/utils";
import { ConsultationType, InsuranceLayer, Kupah, LAYER_LABELS, ProviderProfile } from "@/types";


export function PaymentPanel({
  provider,
  itemName,
  consultation,
  clinicId,
  selectedSlot,
  kupah,
  layer,
  price,
  fullPrice,
  holdExpiresAt,
  onExpire,
  payMethod,
  onPayMethodChange,
  paying,
  onPay,
  referralFile,
  onReferralFileChange,
}: {
  provider: ProviderProfile;
  itemName?: string;
  consultation?: ConsultationType;
  clinicId?: string;
  selectedSlot: { date: string; time: string; label: string };
  kupah?: Kupah;
  layer?: InsuranceLayer;
  // The price this specific patient pays, already resolved against their
  // held insurance layers/arrangements.
  price: number;
  // The private/out-of-pocket price regardless of arrangement — falls back
  // to `price` when the caller doesn't have it (e.g. no consultation yet).
  fullPrice?: number;
  holdExpiresAt: number;
  onExpire: () => void;
  payMethod: "card" | "apple" | "google";
  onPayMethodChange: (method: "card" | "apple" | "google") => void;
  paying: boolean;
  onPay: () => void;
  /** The kupah referral attached so far, when this service demands one. */
  referralFile?: File | null;
  onReferralFileChange?: (file: File | null) => void;
}) {
  const [saveCard, setSaveCard] = useState(false);
  const depositAmount = resolveDepositAmount(price, consultation);
  const balanceAmount = resolveBalanceAmount(price, consultation);
  const clinic = provider.clinic_locations.find((c) => c.id === clinicId) ?? provider.clinic_locations[0];
  const resolvedFullPrice = fullPrice ?? price;
  const hasArrangement = !!layer && layer !== "H" && price < resolvedFullPrice;
  // Basket-covered service (route S): nothing is paid on the platform — the
  // patient arrives with a kupah commitment instead of paying a deposit.
  const basketCovered = layer === "S" && price === 0;
  // A referral isn't advice, it's a condition of the booking: the kupah won't
  // honour the appointment without one, so payment is blocked until it's here.
  const referralRequired = requiresReferral(consultation) && !!onReferralFileChange;
  const referralMissing = referralRequired && !referralFile;

  return (
    <div>
      <div className="text-center mb-4">
        <HoldTimer expiresAt={holdExpiresAt} onExpire={onExpire} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 mb-4">
        <p className="text-xs text-slate-400 mb-2">סיכום ההזמנה</p>
        {itemName && (
          <div className="flex items-start justify-between gap-3 text-sm">
            <span className="flex items-center gap-1.5 text-slate-500">
              <Stethoscope className="h-3.5 w-3.5 shrink-0" /> שירות
            </span>
            <span className="font-medium text-slate-900">{itemName}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-slate-500">רופא</span>
          <span className="font-medium text-slate-900">
            {provider.title} {provider.display_name}
          </span>
        </div>
        {clinic && (
          <div className="flex items-start justify-between gap-3 text-sm mt-2">
            <span className="flex items-center gap-1.5 text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> מיקום
            </span>
            <span className="text-left font-medium text-slate-900">
              {clinic.name}
              <span className="block text-xs font-normal text-slate-400">
                {clinic.address}, {clinic.city}
              </span>
            </span>
          </div>
        )}
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
      </div>

      <div className="mb-4">
        <PreparationRequirements consultation={consultation} />
      </div>

      {/* By the time payment is reached the referral has already been
          uploaded and approved by the unit — this is a receipt of that, not
          another chance to attach it. */}
      {referralRequired && referralFile && (
        <div className="rounded-lg border border-success-border bg-success-bg p-4 mb-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-success-text">
            <FileCheck2 className="h-4 w-4 shrink-0" /> ההפניה אושרה על ידי היחידה
          </p>
          <p className="mt-0.5 text-xs text-success-text/80">
            {referralFile.name} · תישמר במסמכים שלך יחד עם התור
          </p>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 mb-4">
        <p className="text-xs text-slate-400 mb-2">מחיר</p>
        {basketCovered ? (
          <p className="text-sm font-medium text-emerald-700">מכוסה בסל הבריאות — לא נדרש תשלום באתר. יש להצטייד בהתחייבות (טופס 17) מהקופה.</p>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">מחיר מלא</span>
              <span className={hasArrangement ? "text-slate-400 line-through" : "font-medium text-slate-900"}>
                {formatCurrency(resolvedFullPrice)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-slate-500">המחיר שלך</span>
              <span className="font-medium text-slate-900">{formatCurrency(price)}</span>
            </div>
            {hasArrangement && layer && (
              <p className="text-[11px] text-slate-400 mt-1">
                * המחיר מבוסס על ה{LAYER_LABELS[layer]}
                {layer === "S" && kupah ? ` שלך ב${kupah}` : " שלך"} — בהנחת זכאות מלאה. מגבלות זכאות אישיות (למשל תקרת
                מספר טיפולים מוטבים בשנה) לא מוצגות כאן ואינן ידועות למערכת; מומלץ לוודא מול חברת הביטוח/הקופה שלך.
              </p>
            )}
            <div className="h-px bg-slate-100 my-3" />
            {/* One number, never a rate: how the deposit is worked out is a
                business rule (see lib/deposit.ts), and showing the percentage
                would let anyone derive what the platform keeps. */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">לתשלום עכשיו</span>
              <span className="text-lg font-bold text-primary">{formatCurrency(depositAmount)}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              התשלום הזה משריין את התור. את היתרה משלמים במועד הביקור.
            </p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-slate-400">יתרה במועד הביקור</span>
              <span className="text-[11px] text-slate-400">{formatCurrency(balanceAmount)}</span>
            </div>
          </>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-bold text-slate-900 mb-3">אמצעי תשלום</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button
            onClick={() => onPayMethodChange("card")}
            className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium ${payMethod === "card" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500"}`}
          >
            <CreditCard className="h-4 w-4" /> כרטיס אשראי
          </button>
          <button
            onClick={() => onPayMethodChange("apple")}
            className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium ${payMethod === "apple" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500"}`}
          >
            <Smartphone className="h-4 w-4" /> Apple Pay
          </button>
          <button
            onClick={() => onPayMethodChange("google")}
            className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium ${payMethod === "google" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500"}`}
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
        <Button size="lg" className="w-full" loading={paying} onClick={onPay} disabled={referralMissing}>
          {basketCovered ? "אשר תור (ללא תשלום)" : `שלם ${formatCurrency(depositAmount)} ואשר תור`}
        </Button>
        {referralMissing && (
          <p className="mt-2 text-center text-[11px] text-warning-text">
            לא ניתן לשריין תור לשירות הזה ללא הפניה תקפה — צרפו אותה למעלה.
          </p>
        )}
      </div>
    </div>
  );
}
