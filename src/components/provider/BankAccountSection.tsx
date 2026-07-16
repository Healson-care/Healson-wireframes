"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Input";
import { fileToDataUrl } from "@/lib/file";
import { formatDateHe } from "@/lib/utils";
import { ISRAELI_BANKS, ProviderBankAccount, ProviderProfile, ToastItem, UploadedFile } from "@/types";
import { Banknote, ShieldCheck, Upload, CheckCircle2, Loader2, Lock } from "lucide-react";

const VERIFY_STEPS = [
  "בודק תקינות פרטי החשבון",
  "מוודא התאמה לפרטי בעל העסק הרשומים",
  "רושם את אישור ניהול החשבון",
];

/** Bank account details a provider needs on file before Healson can transfer
 * their monthly payout — collects the account + a signed bank-authorization
 * document, then runs a fake (demo-only) verification sequence before
 * flipping to "verified", mirroring SecureProviderLoginDialog's pattern for
 * other sensitive-data flows in this app. */
export function BankAccountSection({
  provider,
  onSave,
  showToast,
}: {
  provider: ProviderProfile;
  onSave: (data: Partial<ProviderProfile>) => void;
  showToast: (title: string, opts?: { description?: string; variant?: ToastItem["variant"] }) => void;
}) {
  const existing = provider.bank_account;
  const [editing, setEditing] = useState(!existing);
  const [accountHolderName, setAccountHolderName] = useState(existing?.account_holder_name ?? provider.display_name ?? "");
  const [bankCode, setBankCode] = useState(existing?.bank_code ?? ISRAELI_BANKS[0].code);
  const [branchNumber, setBranchNumber] = useState(existing?.branch_number ?? "");
  const [accountNumber, setAccountNumber] = useState(existing?.account_number ?? "");
  const [authFile, setAuthFile] = useState<UploadedFile | undefined>(existing?.authorization_file);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyStep, setVerifyStep] = useState(-1);

  async function handleFileSelect(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const data_url = await fileToDataUrl(file);
      setAuthFile({ file_name: file.name, uploaded_at: new Date().toISOString(), data_url });
    } catch (err) {
      showToast("שגיאה בהעלאת הקובץ", { description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authFile) {
      showToast("יש לצרף אישור ניהול חשבון בנק", { variant: "destructive" });
      return;
    }
    const record: ProviderBankAccount = {
      account_holder_name: accountHolderName,
      bank_code: bankCode,
      branch_number: branchNumber,
      account_number: accountNumber,
      authorization_file: authFile,
      submitted_at: existing?.submitted_at ?? new Date().toISOString(),
    };
    setVerifying(true);
    setVerifyStep(0);
    let i = 0;
    const tick = () => {
      i += 1;
      if (i >= VERIFY_STEPS.length) {
        onSave({ bank_account: { ...record, verified_at: new Date().toISOString() } });
        setVerifying(false);
        setVerifyStep(-1);
        setEditing(false);
        showToast("חשבון הבנק אומת ופעיל לקבלת העברות", { variant: "success" });
        return;
      }
      setVerifyStep(i);
      setTimeout(tick, 480);
    };
    setTimeout(tick, 480);
  }

  const bankName = ISRAELI_BANKS.find((b) => b.code === existing?.bank_code)?.name;
  const maskedAccount = existing ? `•••• ${existing.account_number.slice(-4)}` : undefined;

  if (existing?.verified_at && !editing) {
    return (
      <Card className="border-success-border">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-bg text-success">
              <ShieldCheck className="h-4.5 w-4.5" />
            </span>
            <div>
              <CardTitle>חשבון בנק להעברת תשלומים</CardTitle>
              <p className="text-sm text-slate-500">
                {bankName} · סניף {existing.branch_number} · {maskedAccount}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="success">
              <CheckCircle2 className="h-3 w-3" /> מאומת ופעיל
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              עדכון פרטים
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-400">
            בעל החשבון: {existing.account_holder_name} · אומת ב-{formatDateHe(existing.verified_at)} · הפרטים המלאים מוצפנים ואינם גלויים במלואם לצוות Healson
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-warning-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-slate-400" /> חשבון בנק להעברת תשלומים
        </CardTitle>
        <p className="text-sm text-slate-500">
          {existing
            ? "עדכון פרטי החשבון ידרוש אימות מחדש לפני שהעברות ימשיכו."
            : "נדרש כדי שנוכל להעביר אליך את התשלום החודשי. הפרטים מוצפנים ומשמשים לתשלום בלבד."}
        </p>
      </CardHeader>
      <CardContent>
        {verifying ? (
          <div className="flex flex-col gap-3 py-2">
            {VERIFY_STEPS.map((label, i) => {
              const isDone = i < verifyStep;
              const isCurrent = i === verifyStep;
              return (
                <div key={label} className="flex items-center gap-2.5 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : isCurrent ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                    )}
                  </span>
                  <span className={isDone ? "text-slate-500" : isCurrent ? "text-slate-800 font-medium" : "text-slate-300"}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-3">
            <Input
              label="שם בעל החשבון"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              required
            />
            <Select label="בנק" value={bankCode} onChange={(e) => setBankCode(e.target.value)} required>
              {ISRAELI_BANKS.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Input
              label="מספר סניף"
              value={branchNumber}
              onChange={(e) => setBranchNumber(e.target.value)}
              inputMode="numeric"
              maxLength={3}
              required
            />
            <Input
              label="מספר חשבון"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              inputMode="numeric"
              required
            />
            <div className="sm:col-span-2">
              <label className="flex w-fit items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm text-slate-600 cursor-pointer hover:border-primary">
                <Upload className="h-4 w-4" />
                {uploading ? "מעלה..." : authFile ? authFile.file_name : "העלאת אישור ניהול חשבון בנק"}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
                />
              </label>
              <p className="mt-1.5 text-xs text-slate-400">
                מסמך רשמי מהבנק (או צ׳ק מבוטל) המאשר שהחשבון מתנהל על שם בעל העסק
              </p>
            </div>
            <div className="sm:col-span-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <Lock className="h-3.5 w-3.5 shrink-0" /> הפרטים מוצפנים ומשמשים אך ורק לביצוע העברות תשלום מהילסון אליך
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              {existing && (
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  ביטול
                </Button>
              )}
              <Button type="submit" disabled={uploading}>
                שמירה ואימות פרטי חשבון
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
