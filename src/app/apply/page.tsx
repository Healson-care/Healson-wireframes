"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, Phone, User as UserIcon, CheckCircle2, Clock, ShieldCheck, FileText, Rocket, X } from "lucide-react";
// `Lock` doubles as the password-field icon and the locked-step marker.
import { Logo } from "@/components/shared/Logo";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ProviderGoogleSignIn } from "@/components/shared/ProviderGoogleSignIn";
import { useStore } from "@/lib/store";

// The join timeline — deliberately a compact single-column list rather than a
// stack of cards: the whole page has to fit one 100%-zoom viewport, and the
// form column (ending in the Google button) is what must never be cut off.
const JOIN_STEPS: { icon: React.ReactNode; title: string; description: string; locked?: boolean }[] = [
  { icon: <UserIcon className="h-4 w-4" />, title: "יצירת חשבון", description: "נפתח בשנייה, נכנסים מיד לפורטל" },
  { icon: <FileText className="h-4 w-4" />, title: "מילוי פרטי הבקשה", description: "בקצב שלכם — נשמר, אפשר לעצור ולחזור" },
  { icon: <Clock className="h-4 w-4" />, title: "בדיקת רישיון", description: "צוות Healson בודק — עד 24 שעות" },
  { icon: <ShieldCheck className="h-4 w-4" />, title: "חתימת הסכם", description: "נפתח אחרי אישור הרישיון", locked: true },
  { icon: <Rocket className="h-4 w-4" />, title: "קטלוג, מיקומים וזמינות", description: "נפתח אחרי אישור הרישיון", locked: true },
  { icon: <CheckCircle2 className="h-4 w-4" />, title: "פעיל בפלטפורמה", description: "הפרופיל חי ומקבל הזמנות", locked: true },
];

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
      // Land in the portal HOME, not straight in the form — the dashboard's
      // ProviderJourney is the "your account exists, here's the whole path,
      // fill it at your pace" moment that a silent jump into a long form
      // never delivered.
      router.push("/provider/dashboard");
    }, 300);
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-slate-50 to-amber-50 px-4 py-6">
      <Link
        href="/"
        className="absolute top-3 left-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-400 hover:bg-white/60 hover:text-slate-600"
      >
        <X className="h-4 w-4" /> <span className="hidden sm:inline">חזרה לדף הבית</span>
      </Link>

      <div className="mb-4">
        <Logo size={32} className="text-lg" />
      </div>

      <div className="grid w-full max-w-4xl items-start gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
        {/* Form column. Google sign-in sits ABOVE the form — the fastest path
            first, and it can never end up below the fold on a 100% zoom. */}
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-lg sm:p-6">
          <div className="mb-4">
            <h1 className="text-xl font-bold text-slate-900">הצטרפו כנותני שירות</h1>
            <p className="mt-1 text-sm text-slate-500">יצירת חשבון לוקחת פחות מדקה</p>
          </div>

          <ProviderGoogleSignIn label="הצטרפות מהירה עם Google" />

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">או הרשמה עם אימייל</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          {error && (
            <div role="alert" className="mb-3 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
            <Input
              type="email"
              placeholder="you@example.com"
              label="אימייל"
              icon={<Mail className="h-4 w-4" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
            <Button type="submit" loading={loading} className="mt-1 w-full">
              צור חשבון והמשך
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            כבר יש לך חשבון?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              התחבר
            </Link>
          </p>
        </div>

        {/* Timeline column. */}
        <aside className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">מה קורה בהצטרפות?</h2>
          <ol className="flex flex-col gap-2.5">
            {JOIN_STEPS.map((step, i) => (
              <li key={step.title} className="flex items-start gap-2.5">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    step.locked ? "bg-slate-100 text-slate-400" : "bg-primary/10 text-primary"
                  }`}
                >
                  {step.locked ? <Lock className="h-3 w-3" /> : i + 1}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-medium ${step.locked ? "text-slate-400" : "text-slate-900"}`}>
                    {step.title}
                  </p>
                  <p className="text-[11px] leading-snug text-slate-500">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-[11px] leading-snug text-slate-600">
            <strong>💡 טיפ:</strong> רק יצירת החשבון נדרשת עכשיו. מיד אחריה תהיו בתוך הפורטל, ואת פרטי הבקשה
            אפשר למלא בכמה פעימות — הכול נשמר עד שתחליטו לשלוח לבדיקה.
          </p>
        </aside>
      </div>

      <p className="mt-5 text-xs text-slate-400">פלטפורמת ניהול שירותי בריאות בישראל © 2026</p>
    </div>
  );
}
