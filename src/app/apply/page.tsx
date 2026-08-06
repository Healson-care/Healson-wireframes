"use client";

import { useState, type ReactNode, type InputHTMLAttributes } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  User as UserIcon,
  ArrowLeft,
  ShieldCheck,
  Stethoscope,
  HeartPulse,
  ScanLine,
  FlaskConical,
  Building2,
  FileText,
  Rocket,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { ProviderGoogleSignIn } from "@/components/shared/ProviderGoogleSignIn";

// The service constellation — the brand's signature motif (an arch of circular
// badges), rebuilt as a living hero. Middle badge sits highest (ARCH offsets).
const SERVICES: { icon: typeof Stethoscope; label: string }[] = [
  { icon: Stethoscope, label: "רופאים מומחים" },
  { icon: HeartPulse, label: "אחים ואחיות" },
  { icon: ScanLine, label: "בדיקות ודימות" },
  { icon: FlaskConical, label: "מעבדות" },
  { icon: Building2, label: "מכונים ומרפאות" },
];
const ARCH = [26, 10, 0, 10, 26];

const STEPS: { icon: typeof UserIcon; title: string; desc: string }[] = [
  { icon: UserIcon, title: "יצירת חשבון", desc: "פחות מדקה" },
  { icon: FileText, title: "מילוי הבקשה", desc: "בקצב שלכם" },
  { icon: ShieldCheck, title: "אישור רישיון", desc: "עד 24 שעות" },
  { icon: Rocket, title: "עולים לאוויר", desc: "מקבלים הזמנות" },
];

/** The gold "H." brand mark, on-brand with the marketing logo. */
function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-gold-soft)] to-[var(--brand-gold-deep)] text-[var(--brand-navy)] shadow-lg",
        className
      )}
    >
      <span className="font-display text-xl font-black leading-none">H</span>
      <span className="absolute bottom-1.5 left-1.5 h-1 w-1 rounded-full bg-[var(--brand-navy)]" />
    </span>
  );
}

/** Premium field — navy label, gold focus ring, icon at the RTL start edge. */
function Field({
  label,
  icon,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; icon: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-medium text-[var(--brand-ink)]">{label}</span>
      <span className="relative">
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[var(--brand-gold-deep)]">
          {icon}
        </span>
        <input
          {...props}
          className={cn(
            "h-10 w-full rounded-xl border border-[var(--brand-ivory-200)] bg-white pr-10 pl-3 text-sm text-[var(--brand-ink)] outline-none transition-all placeholder:text-slate-300",
            "focus:border-[var(--brand-gold)] focus:ring-4 focus:ring-[var(--brand-gold)]/15",
            className
          )}
        />
      </span>
    </label>
  );
}

export default function ProviderApplyPage() {
  const router = useRouter();
  const registerProviderAccount = useStore((s) => s.registerProviderAccount);
  const showToast = useStore((s) => s.showToast);

  // Step 1 of the join flow is ONLY the account: Google, or name + email +
  // password. The provider type, the personal details, the phone OTP and the
  // licensing documents all belong to the application itself (step 3), which
  // is started from the portal dashboard — so nothing here asks for them.
  const [fullName, setFullName] = useState("");
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
      // No phone and no provider type at signup — both are collected inside
      // the application form (and the phone is OTP-verified right after it's
      // entered there). The Google path never has either one either. The
      // privacy consents belong to that form too, right before the OTP is
      // sent (see REGISTRATION_CONSENT_TYPES) — this step only opens an empty
      // account, so it asks for a decision the applicant can't yet make.
      const result = registerProviderAccount(fullName, "", email, password);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה ביצירת החשבון");
        return;
      }
      // The welcome mail is a notification, not a gate — nothing waits on it.
      showToast("החשבון נוצר · שלחנו לך מייל ברוך הבא", {
        description: `נשלח לכתובת ${email} עם קישור לפורטל שלך.`,
        variant: "success",
      });
      // Straight to the portal home, where the draft application is waiting
      // to be started (see RegistrationProgress on the dashboard).
      router.push("/provider/dashboard");
    }, 300);
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[var(--brand-ivory)] text-[var(--brand-ink)]">
      {/* Warm architectural ambience — soft gold + navy glows drifting behind. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="animate-brand-drift absolute -top-32 right-[-12%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(198,161,91,0.20),transparent_70%)]" />
        <div className="absolute bottom-[-18%] left-[-8%] h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(20,42,79,0.10),transparent_70%)]" />
      </div>

      <Link
        href="/"
        className="focus-ring absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-full border border-[var(--brand-ivory-200)] bg-white/70 px-3 py-1.5 text-xs font-medium text-[var(--brand-ink-soft)] backdrop-blur transition-colors hover:text-[var(--brand-navy)]"
      >
        <X className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">חזרה לדף הבית</span>
      </Link>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-5">
        <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          {/* ── NAVY BRAND PANEL — the "who you're joining" hero ────────── */}
          <section className="relative hidden flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[var(--brand-navy)] via-[var(--brand-navy-800)] to-[var(--brand-navy-900)] p-7 text-white shadow-[0_40px_90px_-40px_rgba(15,33,64,0.8)] lg:flex">
            <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-[var(--brand-gold)]/60 to-transparent" />
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(198,161,91,0.16),transparent_58%)]" />

            {/* Wordmark */}
            <div className="relative flex items-center gap-3">
              <BrandMark />
              <div className="leading-tight">
                <p className="font-display text-lg font-bold tracking-wide">HEALSON</p>
                <p className="text-[11px] text-white/55">הילסון · מנגישים רפואה שלימה</p>
              </div>
            </div>

            {/* Constellation */}
            <div className="relative">
              <div className="flex items-start justify-center gap-2">
                {SERVICES.map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.09, duration: 0.5, ease: "easeOut" }}
                    style={{ marginTop: ARCH[i] }}
                    className="flex flex-1 flex-col items-center gap-1.5 text-center"
                  >
                    <span
                      className="animate-brand-float flex h-12 w-12 items-center justify-center rounded-full border border-[var(--brand-gold)]/30 bg-white/[0.06] text-[var(--brand-gold-soft)] shadow-inner backdrop-blur"
                      style={{ animationDelay: `${i * 0.55}s` }}
                    >
                      <s.icon className="h-5 w-5" />
                    </span>
                    <span className="text-[10px] font-medium leading-tight text-white/75">{s.label}</span>
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.5 }}
                className="mt-6 text-center"
              >
                <h2 className="font-display text-[22px] font-bold leading-tight">
                  רשת אחת. רפואה שלימה.
                </h2>
                <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-white/60">
                  אלפי מטופלים מחפשים נותני שירות כמוכם. הצטרפו לפלטפורמה שמנגישה רפואה שלימה.
                </p>
              </motion.div>
            </div>

            {/* Journey preview */}
            <div className="relative grid grid-cols-4 gap-2.5">
              {STEPS.map((st, i) => (
                <div key={st.title} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-gold)]/15 text-[11px] font-bold text-[var(--brand-gold-soft)]">
                      {i + 1}
                    </span>
                    {i < STEPS.length - 1 && <span className="h-px flex-1 bg-white/10" />}
                  </div>
                  <p className="text-[12px] font-semibold text-white/85">{st.title}</p>
                  <p className="text-[10px] leading-tight text-white/45">{st.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── FORM PANEL — the invitation ─────────────────────────────── */}
          <section className="relative flex flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="mx-auto w-full max-w-md rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_40px_80px_-36px_rgba(20,42,79,0.35)] backdrop-blur-sm"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <BrandMark />
                  <div className="leading-tight">
                    <p className="font-display text-base font-bold tracking-wide text-[var(--brand-navy)]">HEALSON</p>
                    <p className="text-[10px] text-[var(--brand-ink-soft)]">מנגישים רפואה שלימה</p>
                  </div>
                </div>
                <span className="rounded-full border border-[var(--brand-gold)]/30 bg-[var(--brand-gold)]/10 px-2.5 py-1 text-[10px] font-semibold text-[var(--brand-gold-deep)]">
                  פורטל נותני שירות
                </span>
              </div>

              <h1 className="font-display text-[24px] font-bold leading-tight text-[var(--brand-navy)]">
                מצטרפים להילסון
              </h1>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--brand-ink-soft)]">
                יוצרים חשבון בפחות מדקה ונכנסים ישר לפורטל. את הבקשה עצמה ממלאים משם, בקצב שלכם — הכול נשמר.
              </p>

              <div className="mt-4">
                <ProviderGoogleSignIn label="הצטרפות מהירה עם Google" />
              </div>

              <div className="my-3.5 flex items-center gap-3">
                <span className="h-px flex-1 bg-[var(--brand-ivory-200)]" />
                <span className="text-[11px] text-[var(--brand-ink-soft)]">או הרשמה עם אימייל</span>
                <span className="h-px flex-1 bg-[var(--brand-ivory-200)]" />
              </div>

              {error && (
                <div
                  role="alert"
                  className="mb-3 rounded-xl border border-danger-border bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <Field
                  label="שם מלא"
                  icon={<UserIcon className="h-4 w-4" />}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                <Field
                  type="email"
                  label="אימייל"
                  placeholder="you@example.com"
                  icon={<Mail className="h-4 w-4" />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    type="password"
                    label="סיסמה"
                    placeholder="••••••••"
                    icon={<Lock className="h-4 w-4" />}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Field
                    type="password"
                    label="אימות סיסמה"
                    placeholder="••••••••"
                    icon={<Lock className="h-4 w-4" />}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="focus-ring group relative mt-0.5 flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-b from-[var(--brand-navy-700)] to-[var(--brand-navy)] text-sm font-semibold text-white shadow-lg shadow-[var(--brand-navy)]/25 transition-all hover:-translate-y-px hover:shadow-xl hover:shadow-[var(--brand-navy)]/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 -translate-x-full bg-gradient-to-l from-transparent via-[var(--brand-gold)]/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                  />
                  {loading && (
                    <span className="relative h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  )}
                  <span className="relative">צור חשבון והמשך</span>
                  <ArrowLeft className="relative h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                </button>

                {/* The account by itself holds nothing but a name and a login,
                    so it is opened on notice rather than on a checkbox wall.
                    The consents the law requires are asked in the application
                    itself, just before the phone verification — the point from
                    which real personal data starts being stored. */}
                <p className="text-center text-[11px] leading-relaxed text-[var(--brand-ink-soft)]">
                  יצירת החשבון כפופה לתנאי השימוש ולמדיניות הפרטיות של Healson, הזמינים באתר. ההסכמות
                  המלאות יוצגו לאישורך בתחילת מילוי הבקשה — לפני אימות הטלפון ולפני מסירת פרטי הרישוי
                  והמסמכים.
                </p>
              </form>

              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] leading-tight text-[var(--brand-ink-soft)]">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[var(--brand-gold-deep)]" />
                  שום דבר לא נשלח עד שתחליטו — הכול נשמר
                </span>
                <span className="text-[13px] text-[var(--brand-ink-soft)]">
                  כבר רשומים?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-[var(--brand-navy)] transition-colors hover:text-[var(--brand-gold-deep)]"
                  >
                    התחברות
                  </Link>
                </span>
              </div>
            </motion.div>
          </section>
        </div>
      </div>
    </div>
  );
}
