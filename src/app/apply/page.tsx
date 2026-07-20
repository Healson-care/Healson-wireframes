"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, Phone, User as UserIcon, CheckCircle2, Clock, ShieldCheck, FileText, X } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ProviderGoogleSignIn } from "@/components/shared/ProviderGoogleSignIn";
import { useStore } from "@/lib/store";

export default function ProviderApplyPage() {
  const router = useRouter();
  const registerProviderAccount = useStore((s) => s.registerProviderAccount);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const result = registerProviderAccount(fullName, phone, email, password);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה ביצירת החשבון");
        return;
      }
      router.push("/provider/register");
    }, 300);
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-slate-50 to-amber-50 p-4">
      <Link
        href="/"
        className="absolute top-4 left-4 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-400 hover:bg-white/60 hover:text-slate-600"
      >
        <X className="h-4 w-4" /> <span className="hidden sm:inline">חזרה לדף הבית</span>
      </Link>
      <div className="mb-6">
        <Logo size={40} className="text-xl" />
      </div>

      <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
        {/* Form Section */}
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">הצטרף כנותן שירות</h1>
            <p className="text-sm text-slate-500 mt-2">
              יצרו חשבון בדקה אחת והתחילו את תהליך ההצטרפות לפלטפורמה
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="שם מלא"
              icon={<UserIcon className="h-4 w-4" />}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <Input
              type="tel"
              label="מספר טלפון"
              icon={<Phone className="h-4 w-4" />}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <Input
              type="email"
              placeholder="you@example.com"
              label="אימייל"
              icon={<Mail className="h-4 w-4" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="••••••••"
              label="סיסמה"
              icon={<Lock className="h-4 w-4" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="••••••••"
              label="אימות סיסמה"
              icon={<Lock className="h-4 w-4" />}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <Button type="submit" loading={loading} className="w-full mt-2">
              צור חשבון והמשך
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">או</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <ProviderGoogleSignIn label="הצטרפות מהירה עם Google" />

          <p className="mt-5 text-center text-sm text-slate-500">
            כבר יש לך חשבון?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              התחבר
            </Link>
          </p>
        </div>

        {/* Timeline Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900 mb-4">מה קורה בהצטרפות?</h3>
          
          <div className="space-y-3">
            <div className="flex gap-3 rounded-xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">1</div>
              <div>
                <p className="font-medium text-slate-900">יצירת חשבון</p>
                <p className="text-xs text-slate-500 mt-0.5">חשבון שלכם יוצר בתוך שנייה, אתם מתחברים מיד</p>
              </div>
            </div>

            <div className="flex gap-3 rounded-xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-semibold text-sm">2</div>
              <div>
                <p className="font-medium text-slate-900">מילוי פרטים</p>
                <p className="text-xs text-slate-500 mt-0.5">בחרו את סוג הספק והשלימו את הטופס</p>
              </div>
            </div>

            <div className="flex gap-3 rounded-xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <Clock className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">בדיקת רישיון</p>
                <p className="text-xs text-slate-500 mt-0.5">צוות Healson בודק את הרישיון (עד 24 שעות)</p>
              </div>
            </div>

            <div className="flex gap-3 rounded-xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <FileText className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">חתימת הסכם</p>
                <p className="text-xs text-slate-500 mt-0.5">חתימה על הסכם שירותים עם Healson</p>
              </div>
            </div>

            <div className="flex gap-3 rounded-xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <ShieldCheck className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">הגדרת קטלוג</p>
                <p className="text-xs text-slate-500 mt-0.5">הוספת שירותים, מיקומים וזמינות</p>
              </div>
            </div>

            <div className="flex gap-3 rounded-xl bg-success-bg border border-success-border p-4 shadow-sm">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">פעיל בפלטפורמה</p>
                <p className="text-xs text-slate-600 mt-0.5">הפרופיל שלכם חי ולוקחים הזמנות</p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-primary/5 border border-primary/20 p-4">
            <p className="text-xs text-slate-600"><strong>💡 טיפ:</strong> יצירת החשבון לוקחת פחות מדקה — שאר השלבים מטופלים בהמשך, בזמנכם</p>
          </div>
        </div>
      </div>

      <p className="mt-8 text-xs text-slate-400">פלטפורמת ניהול שירותי בריאות בישראל © 2026</p>
    </div>
  );
}
