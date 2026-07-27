"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";
import { useOtpAttemptGuard, ResendControl, BlockedPanel, WrongAttemptsLockoutNotice } from "@/components/shared/OtpAttemptGuard";

type Step = "request" | "otp-sms" | "otp-email";

function ForgotPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // /forgot-password is shared by the patient login (/client/login) and the
  // staff/provider login (/login) — ?from=client says which one linked here,
  // so "חזרה להתחברות" (and the post-reset redirect) send the user back to
  // the right one instead of always /login.
  const loginPath = searchParams.get("from") === "client" ? "/client/login" : "/login";
  const forgotPassword = useStore((s) => s.forgotPassword);
  const verifyPasswordResetSmsOtp = useStore((s) => s.verifyPasswordResetSmsOtp);
  const verifyPasswordResetEmailLink = useStore((s) => s.verifyPasswordResetEmailLink);
  const resendPasswordResetOtp = useStore((s) => s.resendPasswordResetOtp);
  const maskedPhone = useStore((s) => s.pendingPasswordReset?.maskedPhone);
  const showToast = useStore((s) => s.showToast);
  // Separate instances (not shared) — SMS and email are two sequential
  // steps of the *same* flow here (like registration), so a resend/report
  // on one shouldn't reset the other's count.
  const smsGuard = useOtpAttemptGuard("password-reset");
  const emailGuard = useOtpAttemptGuard("password-reset");

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleRequestSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = forgotPassword(email, loginPath);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה בשליחת קוד האימות");
        return;
      }
      setStep("otp-sms");
      showToast("קוד אימות נשלח ב-SMS", { description: `קוד הדגמה: ${result.otpHint}`, variant: "success" });
    }, 300);
  }

  function handleVerifySms(e: React.FormEvent) {
    e.preventDefault();
    if (smsGuard.verifyLockSecondsLeft > 0) return;
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = verifyPasswordResetSmsOtp(smsCode);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה באימות");
        smsGuard.noteWrongAttempt();
        return;
      }
      setStep("otp-email");
      // No code to show a "demo hint" for — the confirmation card on the
      // next screen *is* the simulated email, so there's nothing to send
      // separately here.
      resendPasswordResetOtp("email");
      showToast("שלחנו לך מייל עם קישור לאיפוס הסיסמה", { variant: "success" });
    }, 300);
  }

  // Clicking the (simulated) link in the confirmation card below is the
  // entire "verification" for this step — no code to type or check.
  function handleConfirmEmailLink() {
    setError("");
    setLoading(true);
    setTimeout(() => {
      const result = verifyPasswordResetEmailLink();
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "שגיאה באימות");
        return;
      }
      router.push("/reset-password");
    }, 300);
  }

  function handleResend(channel: "sms" | "email") {
    const guard = channel === "sms" ? smsGuard : emailGuard;
    if (guard.secondsLeft > 0 || guard.blocked) return;
    const otp = resendPasswordResetOtp(channel);
    if (!otp) return;
    if (channel === "sms") {
      showToast("קוד חדש נשלח ב-SMS", { description: `קוד הדגמה: ${otp}` });
    } else {
      showToast("שלחנו שוב מייל עם קישור לאיפוס הסיסמה");
    }
    guard.noteResend();
  }

  function handleReportIssue(channel: "sms" | "email") {
    const guard = channel === "sms" ? smsGuard : emailGuard;
    guard.reportIssue(channel, channel === "sms" ? maskedPhone ?? "" : email);
  }

  return (
    <AuthLayout>
      {step === "request" && (
        <>
          <h1 className="text-lg font-semibold text-slate-900 mb-1">שכחת סיסמה?</h1>
          <p className="text-sm text-slate-500 mb-5">
            הזינו את כתובת האימייל שלכם ונאמת את זהותכם (SMS ואימייל) לפני שמאפשרים איפוס סיסמה
          </p>
          {error && (
            <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
              {error}
            </div>
          )}
          <form onSubmit={handleRequestSubmit} className="flex flex-col gap-3">
            <Input
              type="email"
              placeholder="you@example.com"
              label="אימייל"
              icon={<Mail className="h-4 w-4" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" loading={loading} className="w-full">
              שלח קוד אימות
            </Button>
          </form>
        </>
      )}

      {step === "otp-sms" && (
        <>
          <h1 className="text-lg font-semibold text-slate-900 mb-1">אימות דו-שלבי (1/2)</h1>
          <p className="text-sm text-slate-500 mb-5">
            שלחנו קוד אימות ב-SMS{maskedPhone ? ` למספר ${maskedPhone}` : " למספר הטלפון המשויך לחשבון"}
          </p>
          {error && (
            <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
              {error}
            </div>
          )}
          {smsGuard.blocked ? (
            <BlockedPanel />
          ) : (
            <form onSubmit={handleVerifySms} className="flex flex-col gap-3">
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                label="קוד מ-SMS"
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value)}
                className="text-center tracking-[0.4em] text-lg"
                disabled={smsGuard.verifyLockSecondsLeft > 0}
                required
              />
              <WrongAttemptsLockoutNotice secondsLeft={smsGuard.verifyLockSecondsLeft} />
              <Button type="submit" loading={loading} disabled={smsGuard.verifyLockSecondsLeft > 0} className="w-full">
                אמת קוד SMS
              </Button>
              <ResendControl
                secondsLeft={smsGuard.secondsLeft}
                onResend={() => handleResend("sms")}
                resendCount={smsGuard.resendCount}
                issueReported={smsGuard.issueReported}
                onReportIssue={() => handleReportIssue("sms")}
              />
            </form>
          )}
        </>
      )}

      {step === "otp-email" && (
        <>
          <h1 className="text-lg font-semibold text-slate-900 mb-1">אימות דו-שלבי (2/2)</h1>
          <p className="text-sm text-slate-500 mb-5">שלחנו לך מייל עם קישור לאיפוס הסיסמה</p>
          {error && (
            <div className="mb-4 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
              {error}
            </div>
          )}
          {emailGuard.blocked ? (
            <BlockedPanel />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 mb-2 text-slate-500">
                  <Mail className="h-4 w-4" />
                  <span className="text-xs font-medium">מייל הדגמה מ-HEALSON</span>
                </div>
                <p className="text-sm text-slate-700 mb-3">לחצו על הקישור הבא כדי לאפס את הסיסמה שלכם.</p>
                <Button type="button" onClick={handleConfirmEmailLink} loading={loading} className="w-full">
                  איפוס הסיסמה שלי
                </Button>
              </div>
              <ResendControl
                secondsLeft={emailGuard.secondsLeft}
                onResend={() => handleResend("email")}
                resendCount={emailGuard.resendCount}
                issueReported={emailGuard.issueReported}
                onReportIssue={() => handleReportIssue("email")}
              />
            </div>
          )}
        </>
      )}

      <p className="mt-5 text-center text-sm text-slate-500">
        <Link href={loginPath} className="text-primary font-medium hover:underline">
          חזרה להתחברות
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<AuthLayout>{null}</AuthLayout>}>
      <ForgotPasswordPageContent />
    </Suspense>
  );
}
