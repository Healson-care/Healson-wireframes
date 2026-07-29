"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ShieldCheck,
  Lock,
  Mail,
  Fingerprint,
  CheckCircle2,
  Loader2,
  ScanLine,
  KeyRound,
  Smartphone,
  AlertCircle,
  ArrowRight,
  Stethoscope,
  Building2,
  Network,
  ChevronLeft,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  DEMO_INSTITUTE_USER,
  DEMO_OUTPATIENT_USER,
  DEMO_PROVIDER_USER,
  SEED_PROVIDERS,
} from "@/lib/mock-data";
import type { User } from "@/types";

// The demo offers exactly two kinds of live provider account — a single
// practitioner and a medical unit — because those are the two portals that
// actually differ (a unit additionally manages affiliated doctors, a
// unit-specific service catalogue and multi-shift schedules). Picking a unit
// then chooses which of the two seeded unit accounts to open.
type AccountKind = "individual" | "unit";

interface DemoAccount {
  id: string;
  kind: AccountKind;
  user: User;
  label: string;
  description: string;
  icon: typeof Stethoscope;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "individual",
    kind: "individual",
    user: DEMO_PROVIDER_USER,
    label: "רופא או מטפל",
    description: "פורטל של נותן שירות יחיד — יומן אישי, מטופלים והפניות",
    icon: Stethoscope,
  },
  {
    id: "institute",
    kind: "unit",
    user: DEMO_INSTITUTE_USER,
    label: "מכון רפואי",
    description: "בדיקות, פעולות וניתוחים, עם נותני שירות משויכים",
    icon: Building2,
  },
  {
    id: "outpatient",
    kind: "unit",
    user: DEMO_OUTPATIENT_USER,
    label: "מרפאת חוץ",
    description: "ייעוצים, אבחונים וטיפולים, עם נותני שירות משויכים",
    icon: Network,
  },
];

const ACCOUNT_KINDS: { kind: AccountKind; label: string; description: string; icon: typeof Stethoscope }[] = [
  {
    kind: "individual",
    label: "נותן שירות יחיד",
    description: "רופא או מטפל",
    icon: Stethoscope,
  },
  {
    kind: "unit",
    label: "יחידה רפואית",
    description: "מכון רפואי / מרפאת חוץ",
    icon: Building2,
  },
];

function profileFor(account: DemoAccount) {
  return SEED_PROVIDERS.find((p) => p.user_id === account.user.id);
}

const TRUST_BADGES = [
  { icon: Lock, label: "הצפנת AES-256" },
  { icon: ShieldCheck, label: "תואם ISO 27799" },
  { icon: Fingerprint, label: "אימות דו-שלבי" },
];

const VERIFY_STEPS = [
  "מאמת קוד אימות דו-שלבי",
  "מצפין ערוץ תקשורת (TLS 1.3)",
  "בודק הרשאות גישה לתיקי מטופלים",
  "טוען סביבת עבודה מאובטחת",
];

const DEMO_OTP_CODE = "123456";
const OTP_RESEND_SECONDS = 30;

function maskPhone(phone?: string) {
  if (!phone) return "המכשיר המשויך לחשבון";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  const last4 = digits.slice(-4);
  return `${digits.slice(0, 3)}-***-${last4}`;
}

// "kind" → pick single-practitioner vs. medical unit; "account" → (units only)
// pick which unit; then the existing credentials → OTP → verify → success run.
type Stage = "kind" | "account" | "form" | "otp" | "verifying" | "success";

export function SecureProviderLoginDialog({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  /** The seeded demo user id to sign in as, once the flow completes. */
  onComplete: (userId: string) => void;
}) {
  const [stage, setStage] = useState<Stage>("kind");
  const [account, setAccount] = useState<DemoAccount>(DEMO_ACCOUNTS[0]);
  const [email, setEmail] = useState(DEMO_ACCOUNTS[0].user.email);
  const [password, setPassword] = useState("demo-secure-2026");
  const [stepIndex, setStepIndex] = useState(-1);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const accountProfile = profileFor(account);

  function handleClose() {
    setStage("kind");
    setStepIndex(-1);
    setOtpCode("");
    setOtpError(null);
    setResendCooldown(0);
    onClose();
  }

  function selectKind(kind: AccountKind) {
    const options = DEMO_ACCOUNTS.filter((a) => a.kind === kind);
    if (options.length === 1) {
      selectAccount(options[0]);
      return;
    }
    setStage("account");
  }

  function selectAccount(next: DemoAccount) {
    setAccount(next);
    setEmail(next.user.email);
    setStage("form");
  }

  useEffect(() => {
    if (stage !== "otp" || resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, resendCooldown]);

  useEffect(() => {
    if (stage !== "verifying") return;
    if (stepIndex >= VERIFY_STEPS.length - 1) {
      const t = setTimeout(() => setStage("success"), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStepIndex((i) => i + 1), 420);
    return () => clearTimeout(t);
  }, [stage, stepIndex]);

  useEffect(() => {
    if (stage !== "success") return;
    const userId = account.user.id;
    const t = setTimeout(() => onComplete(userId), 1000);
    return () => clearTimeout(t);
  }, [stage, onComplete, account]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOtpCode("");
    setOtpError(null);
    setResendCooldown(OTP_RESEND_SECONDS);
    setStage("otp");
  }

  function handleResend() {
    if (resendCooldown > 0) return;
    setOtpCode("");
    setOtpError(null);
    setResendCooldown(OTP_RESEND_SECONDS);
  }

  function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otpCode !== DEMO_OTP_CODE) {
      setOtpError("קוד שגוי — נסי שוב");
      return;
    }
    setOtpError(null);
    setStage("verifying");
    setStepIndex(0);
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={stage === "verifying" || stage === "success" ? undefined : handleClose}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
          <motion.div
            className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-primary/50 px-6 pt-6 pb-8 text-center overflow-hidden">
              <div className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-primary/30 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-accent/20 blur-2xl" />
              <motion.div
                className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
              >
                <ShieldCheck className="h-6 w-6" />
              </motion.div>
              <h2 className="relative mt-3 text-lg font-semibold text-white">כניסה מאובטחת לנותני שירות</h2>
              <p className="relative mt-1 text-xs text-white/60 leading-relaxed">
                פורטל ספקים — גישה מוצפנת לתיקי מטופלים ולנתונים רפואיים רגישים
              </p>
            </div>

            <div className="px-6 py-5">
              <AnimatePresence mode="wait">
                {stage === "kind" && (
                  <motion.div
                    key="kind"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    <p className="mb-3 text-center text-sm text-slate-600">
                      איזה סוג תיק ספק תרצו לראות בהדגמה?
                    </p>
                    <div className="flex flex-col gap-2">
                      {ACCOUNT_KINDS.map((k) => (
                        <button
                          key={k.kind}
                          type="button"
                          onClick={() => selectKind(k.kind)}
                          className="group flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3 text-right transition-all hover:border-primary hover:bg-primary/5 hover:shadow-sm"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700">
                            <k.icon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-slate-900">{k.label}</span>
                            <span className="block text-xs text-slate-500">{k.description}</span>
                          </span>
                          <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-x-0.5" />
                        </button>
                      ))}
                    </div>
                    <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
                      מצב הדגמה — שני החשבונות פעילים ומפורסמים בפלטפורמה
                    </p>
                  </motion.div>
                )}

                {stage === "account" && (
                  <motion.div
                    key="account"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    <p className="mb-3 text-center text-sm text-slate-600">בחרו את היחידה הרפואית להדגמה</p>
                    <div className="flex flex-col gap-2">
                      {DEMO_ACCOUNTS.filter((a) => a.kind === "unit").map((a) => {
                        const profile = profileFor(a);
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => selectAccount(a)}
                            className="group flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3 text-right transition-all hover:border-primary hover:bg-primary/5 hover:shadow-sm"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700">
                              <a.icon className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-slate-900">{a.label}</span>
                              <span className="block text-xs text-slate-500">{a.description}</span>
                              {profile && (
                                <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                                  {profile.display_name}
                                </span>
                              )}
                            </span>
                            <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-x-0.5" />
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setStage("kind")}
                      className="mt-4 flex w-full items-center justify-center gap-1 text-[11px] text-slate-400 transition-colors hover:text-slate-600"
                    >
                      <ArrowRight className="h-3 w-3" /> חזרה לבחירת סוג הספק
                    </button>
                  </motion.div>
                )}

                {stage === "form" && (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {TRUST_BADGES.map((b) => (
                        <span
                          key={b.label}
                          className="flex items-center gap-1 rounded-full bg-info-bg border border-info-border px-2.5 py-1 text-[11px] font-medium text-info-text"
                        >
                          <b.icon className="h-3 w-3" /> {b.label}
                        </span>
                      ))}
                    </div>

                    <div className="mb-3 flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <account.icon className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                        <strong className="font-semibold text-slate-800">{account.label}</strong>
                        {accountProfile ? ` · ${accountProfile.display_name}` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => setStage("kind")}
                        className="shrink-0 text-[11px] font-medium text-primary hover:underline"
                      >
                        שינוי
                      </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                      <Input
                        type="email"
                        label="דוא״ל ספק"
                        icon={<Mail className="h-4 w-4" />}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                      <Input
                        type="password"
                        label="סיסמה"
                        icon={<Lock className="h-4 w-4" />}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <Button type="submit" className="w-full mt-1">
                        <Lock className="h-4 w-4" /> כניסה מאובטחת
                      </Button>
                    </form>

                    <p className="mt-4 text-center text-[11px] text-slate-400 leading-relaxed">
                      מצב הדגמה — הכניסה מדמה את זרימת האבטחה המלאה של פורטל ספקים רפואי, ללא חיבור אמיתי לשרת
                    </p>
                  </motion.div>
                )}

                {stage === "otp" && (
                  <motion.div
                    key="otp"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-info-bg text-info">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <p className="text-center text-sm text-slate-600 leading-relaxed mb-4">
                      לאבטחת חשבונך שלחנו קוד אימות בן 6 ספרות ב-SMS למספר
                      <br />
                      <span className="font-semibold text-slate-900" dir="ltr">
                        {maskPhone(account.user.phone)}
                      </span>
                    </p>

                    {otpError && (
                      <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-xs text-danger-text">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {otpError}
                      </div>
                    )}

                    <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3">
                      <Input
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="000000"
                        label="קוד אימות"
                        icon={<KeyRound className="h-4 w-4" />}
                        value={otpCode}
                        onChange={(e) => {
                          setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                          setOtpError(null);
                        }}
                        className="text-center tracking-[0.5em] text-lg"
                        required
                        autoFocus
                      />
                      <Button type="submit" className="w-full mt-1">
                        <ShieldCheck className="h-4 w-4" /> אמת קוד והמשך
                      </Button>
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendCooldown > 0}
                        className={cn(
                          "text-sm text-center transition-colors",
                          resendCooldown > 0 ? "text-slate-300 cursor-not-allowed" : "text-primary hover:underline"
                        )}
                      >
                        {resendCooldown > 0 ? `שליחה חוזרת בעוד ${resendCooldown} שניות` : "שלח קוד מחדש"}
                      </button>
                    </form>

                    <button
                      type="button"
                      onClick={() => setStage("form")}
                      className="mt-4 flex items-center justify-center gap-1 w-full text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <ArrowRight className="h-3 w-3" /> חזרה לעריכת פרטי התחברות
                    </button>

                    <p className="mt-2 text-center text-[11px] text-slate-400 leading-relaxed">
                      מצב הדגמה — קוד האימות: {DEMO_OTP_CODE}
                    </p>
                  </motion.div>
                )}

                {stage === "verifying" && (
                  <motion.div
                    key="verifying"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col gap-3 py-2"
                  >
                    {VERIFY_STEPS.map((label, i) => {
                      const isDone = i < stepIndex;
                      const isCurrent = i === stepIndex;
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
                          <span className={cn(isDone ? "text-slate-500" : isCurrent ? "text-slate-800 font-medium" : "text-slate-300")}>
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </motion.div>
                )}

                {stage === "success" && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col items-center gap-2 py-3 text-center"
                  >
                    <motion.div
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 16 }}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-success-bg text-success"
                    >
                      <ScanLine className="h-6 w-6" />
                    </motion.div>
                    <p className="font-semibold text-slate-900 mt-1">זוהית בהצלחה</p>
                    <p className="text-sm text-slate-600 flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                      {accountProfile?.display_name ?? account.user.full_name}
                      {accountProfile?.specialty && ` · ${accountProfile.specialty}`}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">מעביר אותך לפורטל הספק...</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
