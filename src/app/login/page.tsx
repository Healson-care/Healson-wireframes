"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, ChevronDown, Smartphone } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { PatientTypeToggle } from "@/components/shared/PatientTypeToggle";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";
import { homeForRole } from "@/lib/useRequireRole";
import { cn } from "@/lib/utils";

type Phase = "credentials" | "otp-sms" | "otp-email";

export default function LoginPage() {
  const router = useRouter();
  const login = useStore((s) => s.login);
  const loginAsDemo = useStore((s) => s.loginAsDemo);
  const verifyLoginSmsOtp = useStore((s) => s.verifyLoginSmsOtp);
  const verifyLoginEmailOtp = useStore((s) => s.verifyLoginEmailOtp);
  const resendLoginOtp = useStore((s) => s.resendLoginOtp);
  const showToast = useStore((s) => s.showToast);
  const currentUser = useStore((s) => s.currentUser);
  // If this page is reached with a double-OTP verification already queued
  // (e.g. redirected here from the landing page's demo role cards, or a
  // refresh mid-flow), resume at the right OTP step instead of showing a
  // blank credentials form that silently discards the in-progress login.
  const [phase, setPhase] = useState<Phase>(() => {
    const pending = useStore.getState().pendingLoginVerification;
    if (!pending) return "credentials";
    return pending.smsVerified ? "otp-email" : "otp-sms";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  const greetedPendingRef = useRef(false);
  useEffect(() => {
    if (greetedPendingRef.current) return;
    greetedPendingRef.current = true;
    if (phase !== "otp-sms" && phase !== "otp-email") return;
    const channel = phase === "otp-sms" ? "sms" : "email";
    const hint = resendLoginOtp(channel);
    if (!hint) return;
    showToast(channel === "sms" ? "קוד אימות נשלח ב-SMS" : "קוד אימות נשלח באימייל", {
      description: `קוד הדגמה: ${hint}`,
      variant: "success",
    });
    // Only meant to greet an already-pending verification found at mount —
    // handleSubmit/handleDemo show their own toast when they create it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goHome() {
    const user = useStore.getState().currentUser;
    router.push(user ? homeForRole(user.role) : "/login");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = login(email, password);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה בהתחברות");
        return;
      }
      if (result.requiresOtp) {
        setPhase("otp-sms");
        const hint = resendLoginOtp("sms");
        showToast("קוד אימות נשלח ב-SMS", { description: `קוד הדגמה: ${hint}`, variant: "success" });
        return;
      }
      goHome();
    }, 350);
  }

  function handleDemo(role: "admin" | "provider" | "patient", patientVariant?: "new" | "existing") {
    loginAsDemo(role, patientVariant);
    if (role === "patient" && patientVariant === "new") {
      // A lead (no Patient record yet) doesn't enter the personal area
      // (/client/*) — they only see the public search/booking flow, same
      // as any anonymous visitor, until they register.
      router.push("/book");
      return;
    }
    if (role === "patient" && useStore.getState().pendingLoginVerification) {
      setPhase("otp-sms");
      const hint = resendLoginOtp("sms");
      showToast("קוד אימות נשלח ב-SMS", { description: `קוד הדגמה: ${hint}`, variant: "success" });
      return;
    }
    setTimeout(goHome, 50);
  }

  function handleVerifySms(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = verifyLoginSmsOtp(smsCode);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה באימות");
        return;
      }
      setPhase("otp-email");
      const hint = resendLoginOtp("email");
      showToast("קוד אימות נשלח באימייל", { description: `קוד הדגמה: ${hint}`, variant: "success" });
    }, 300);
  }

  function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = verifyLoginEmailOtp(emailCode);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה באימות");
        return;
      }
      goHome();
    }, 300);
  }

  function handleResendSms() {
    const otp = resendLoginOtp("sms");
    if (otp) showToast("קוד חדש נשלח ב-SMS", { description: `קוד הדגמה: ${otp}` });
  }

  function handleResendEmail() {
    const otp = resendLoginOtp("email");
    if (otp) showToast("קוד חדש נשלח באימייל", { description: `קוד הדגמה: ${otp}` });
  }

  if (phase === "otp-sms") {
    return (
      <AuthLayout>
        <div className="mb-1 flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-semibold text-slate-900">אימות דו-שלבי (1/2)</h1>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          לצורך אבטחת המידע הרפואי, מטופלים רשומים נדרשים לאמת קוד שנשלח ב-SMS וקוד נוסף באימייל.
        </p>
        {error && (
          <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
            {error}
          </div>
        )}
        <form onSubmit={handleVerifySms} className="flex flex-col gap-3">
          <Input
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            label="קוד מ-SMS"
            value={smsCode}
            onChange={(e) => setSmsCode(e.target.value)}
            className="text-center tracking-[0.4em] text-lg"
            required
          />
          <Button type="submit" loading={loading} className="w-full">
            אמת קוד SMS
          </Button>
          <button type="button" onClick={handleResendSms} className="text-sm text-primary hover:underline">
            שלח קוד מחדש
          </button>
        </form>
      </AuthLayout>
    );
  }

  if (phase === "otp-email") {
    return (
      <AuthLayout>
        <div className="mb-1 flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-semibold text-slate-900">אימות דו-שלבי (2/2)</h1>
        </div>
        <p className="text-sm text-slate-500 mb-5">שלחנו קוד אימות נוסף לכתובת האימייל שלך</p>
        {error && (
          <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
            {error}
          </div>
        )}
        <form onSubmit={handleVerifyEmail} className="flex flex-col gap-3">
          <Input
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            label="קוד מהאימייל"
            value={emailCode}
            onChange={(e) => setEmailCode(e.target.value)}
            className="text-center tracking-[0.4em] text-lg"
            required
          />
          <Button type="submit" loading={loading} className="w-full">
            אמת קוד וכניסה
          </Button>
          <button type="button" onClick={handleResendEmail} className="text-sm text-primary hover:underline">
            שלח קוד מחדש
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <PatientTypeToggle active="existing" />
      <h1 className="text-lg font-semibold text-slate-900 mb-1">התחברות</h1>
      <p className="text-sm text-slate-500 mb-5">היכנסו לחשבון שלכם כדי להמשיך</p>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-xs text-primary hover:underline">
            שכחת סיסמה?
          </Link>
        </div>
        <Button type="submit" loading={loading} className="w-full mt-1">
          התחברות
        </Button>
      </form>

      <div className="mt-5">
        <button
          type="button"
          onClick={() => setDemoOpen((v) => !v)}
          className="flex w-full items-center justify-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600"
        >
          מצב הדגמה לצוות פנימי
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", demoOpen && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {demoOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-2 pt-3">
                <Button variant="outline" size="sm" onClick={() => handleDemo("patient", "new")}>
                  מטופל חדש
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDemo("patient", "existing")}>
                  מטופל קיים
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDemo("provider")}>
                  ספק
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDemo("admin")}>
                  מנהל
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="mt-5 text-center text-sm text-slate-500">
        אין לך חשבון?{" "}
        <Link href="/register" className="text-primary font-medium hover:underline">
          צור חשבון
        </Link>
      </p>
      <p className="mt-1.5 text-center text-sm text-slate-500">
       נותן שירות?{" "}
        <Link href="/apply" className="text-primary font-medium hover:underline">
          הגישו בקשת הצטרפות כספק
        </Link>
      </p>
      {currentUser && (
        <p className="mt-2 text-center text-xs text-slate-400">מחובר כ-{currentUser.full_name}</p>
      )}
    </AuthLayout>
  );
}
