"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, ChevronDown, Smartphone, PauseCircle, Ban, Phone } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { PatientTypeToggle } from "@/components/shared/PatientTypeToggle";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";
import { homeForRole } from "@/lib/useRequireRole";
import { cn } from "@/lib/utils";
import { useOtpAttemptGuard, ResendControl, BlockedPanel, WrongAttemptsLockoutNotice } from "@/components/shared/OtpAttemptGuard";

type Phase = "credentials" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const login = useStore((s) => s.login);
  const loginAsDemo = useStore((s) => s.loginAsDemo);
  const verifyLoginOtp = useStore((s) => s.verifyLoginOtp);
  const resendLoginOtp = useStore((s) => s.resendLoginOtp);
  const showToast = useStore((s) => s.showToast);
  const currentUser = useStore((s) => s.currentUser);
  const guard = useOtpAttemptGuard("login");
  // If this page is reached with a 2FA verification already queued (e.g.
  // redirected here from the landing page's demo role cards, or a refresh
  // mid-flow), resume at the OTP step instead of showing a blank
  // credentials form that silently discards the in-progress login.
  const [phase, setPhase] = useState<Phase>(() =>
    useStore.getState().pendingLoginVerification ? "otp" : "credentials"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [blockedStatus, setBlockedStatus] = useState<"rejected" | "suspended" | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  const greetedPendingRef = useRef(false);
  useEffect(() => {
    if (greetedPendingRef.current) return;
    greetedPendingRef.current = true;
    if (phase !== "otp") return;
    const hint = resendLoginOtp();
    if (!hint) return;
    showToast("קוד אימות נשלח ב-SMS ובמייל", { description: `קוד הדגמה: ${hint}`, variant: "success" });
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
    setBlockedStatus(null);
    setLoading(true);
    setTimeout(() => {
      const result = login(email, password);
      setLoading(false);
      if (!result.ok) {
        if (result.blockedStatus) {
          // A provider blocked by lifecycle status gets a full explanation
          // panel (what happened, what to do next) instead of a generic error.
          setBlockedStatus(result.blockedStatus);
          setError(result.error ?? "");
          return;
        }
        setError(result.error ?? "שגיאה בהתחברות");
        return;
      }
      if (result.requiresOtp) {
        setPhase("otp");
        const hint = resendLoginOtp();
        showToast("קוד אימות נשלח ב-SMS ובמייל", { description: `קוד הדגמה: ${hint}`, variant: "success" });
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
      setPhase("otp");
      const hint = resendLoginOtp();
      showToast("קוד אימות נשלח ב-SMS ובמייל", { description: `קוד הדגמה: ${hint}`, variant: "success" });
      return;
    }
    setTimeout(goHome, 50);
  }

  function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (guard.verifyLockSecondsLeft > 0) return;
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = verifyLoginOtp(code);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה באימות");
        guard.noteWrongAttempt();
        return;
      }
      goHome();
    }, 300);
  }

  function handleResendOtp() {
    if (guard.secondsLeft > 0 || guard.blocked) return;
    const otp = resendLoginOtp();
    if (otp) {
      showToast("קוד חדש נשלח ב-SMS ובמייל", { description: `קוד הדגמה: ${otp}` });
      guard.noteResend();
    }
  }

  if (phase === "otp") {
    return (
      <AuthLayout>
        <div className="mb-1 flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-semibold text-slate-900">אימות דו-גורמי</h1>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          שלחנו קוד אימות גם ב-SMS וגם למייל שלך — הקוד זהה בשני הערוצים, מספיק להזין אותו פעם אחת.
        </p>
        {error && (
          <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
            {error}
          </div>
        )}
        {guard.blocked ? (
          <BlockedPanel />
        ) : (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3">
            <Input
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              label="קוד אימות"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="text-center tracking-[0.4em] text-lg"
              disabled={guard.verifyLockSecondsLeft > 0}
              required
            />
            <WrongAttemptsLockoutNotice secondsLeft={guard.verifyLockSecondsLeft} />
            <Button type="submit" loading={loading} disabled={guard.verifyLockSecondsLeft > 0} className="w-full">
              אמת קוד וכניסה
            </Button>
            <ResendControl
              secondsLeft={guard.secondsLeft}
              onResend={handleResendOtp}
              resendCount={guard.resendCount}
              issueReported={guard.issueReported}
              onReportIssue={() => guard.reportIssue("sms", email)}
            />
          </form>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <PatientTypeToggle active="existing" />
      <h1 className="text-lg font-semibold text-slate-900 mb-1">התחברות</h1>
      <p className="text-sm text-slate-500 mb-5">היכנסו לחשבון שלכם כדי להמשיך</p>

      {blockedStatus ? (
        <div className="mb-4 rounded-xl border border-danger-border bg-danger-bg p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-danger">
              {blockedStatus === "suspended" ? <PauseCircle className="h-5 w-5" /> : <Ban className="h-5 w-5" />}
            </span>
            <div className="min-w-0 text-sm text-danger-text">
              <p className="font-semibold mb-1">
                {blockedStatus === "suspended" ? "חשבון הספק שלך מושהה זמנית" : "בקשת ההצטרפות שלך נדחתה"}
              </p>
              <p className="leading-relaxed">{error}</p>
              <p className="mt-2 leading-relaxed text-danger-text/80">
                {blockedStatus === "suspended"
                  ? "ההשהיה בוצעה על ידי צוות Healson. לבירור סיבת ההשהיה ותנאי החזרה לפעילות — פנו לתמיכה, ואנו נחזור אליכם בהקדם."
                  : "ניתן להגיש בקשת הצטרפות חדשה עם מסמכים מעודכנים, או לפנות לתמיכה לבירור נוסף."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href="mailto:support@healson.co.il"
                  className="flex items-center gap-1.5 rounded-lg border border-danger-border bg-white px-3 py-1.5 text-xs font-medium text-danger-text hover:bg-danger-bg/50"
                >
                  <Phone className="h-3.5 w-3.5" /> פנייה לתמיכה
                </a>
                {blockedStatus === "rejected" && (
                  <Link
                    href="/apply"
                    className="flex items-center gap-1.5 rounded-lg border border-danger-border bg-white px-3 py-1.5 text-xs font-medium text-danger-text hover:bg-danger-bg/50"
                  >
                    הגשת בקשה חדשה
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        error && (
          <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
            {error}
          </div>
        )
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
