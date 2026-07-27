"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/lib/store";
import { useOtpAttemptGuard, ResendControl, BlockedPanel, WrongAttemptsLockoutNotice } from "./OtpAttemptGuard";

type Phase = "password" | "otp";

// Password, then one OTP sent to SMS+email at once (see PendingReauth in
// store.ts) — the shared shape behind every "confirm it's still you before
// a sensitive change" gate in /client/profile (contact details, insurance
// profile, data export/erasure). Callers that need an extra step *before*
// the password (e.g. RectifyDetailsDialog's own form) don't use this —
// they manage their own outer Dialog and call useOtpAttemptGuard directly
// for the password/otp portion instead.
export function StepUpReauthDialog({
  open,
  onClose,
  title,
  passwordDescription = "לאימות זהותכם לפני השמירה, הזינו את הסיסמה שלכם",
  otpDescription = "שלחנו קוד אימות גם ב-SMS וגם למייל שלכם — הקוד זהה בשני הערוצים",
  otpToastTitle = "קוד אימות נשלח ב-SMS ובמייל",
  onVerified,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  passwordDescription?: string;
  otpDescription?: string;
  otpToastTitle?: string;
  onVerified: () => void;
}) {
  const beginReauth = useStore((s) => s.beginReauth);
  const verifyReauthOtp = useStore((s) => s.verifyReauthOtp);
  const resendReauthOtp = useStore((s) => s.resendReauthOtp);
  const showToast = useStore((s) => s.showToast);
  const currentUser = useStore((s) => s.currentUser);
  const guard = useOtpAttemptGuard("reauth");

  const [phase, setPhase] = useState<Phase>("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  // Reset the wizard (and the attempt guard) when the dialog opens — done
  // during render (React's "adjust state when props change" pattern) rather
  // than in an effect, so it doesn't trigger a second cascading render pass.
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setPhase("password");
      setPassword("");
      setCode("");
      setError("");
      guard.reset();
    }
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Portaled dialogs still bubble synthetic submit events along the React
    // component tree — this form is often a React descendant of a
    // page-level <form>, so without stopPropagation() submitting here would
    // also trigger that page's own save.
    e.stopPropagation();
    setError("");
    if (!password) {
      setError("יש להזין סיסמה");
      return;
    }
    const otp = beginReauth();
    showToast(otpToastTitle, { description: `קוד הדגמה: ${otp}`, variant: "success" });
    setPhase("otp");
  }

  function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (guard.verifyLockSecondsLeft > 0) return;
    setError("");
    const result = verifyReauthOtp(code);
    if (!result.ok) {
      setError(result.error ?? "שגיאה באימות");
      guard.noteWrongAttempt();
      return;
    }
    onVerified();
    onClose();
  }

  function handleResend() {
    if (guard.secondsLeft > 0 || guard.blocked) return;
    const otp = resendReauthOtp();
    if (otp) {
      showToast("קוד חדש נשלח", { description: `קוד הדגמה: ${otp}` });
      guard.noteResend();
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} description={phase === "password" ? passwordDescription : otpDescription}>
      {error && (
        <div className="mb-3 rounded-lg bg-danger-bg border border-danger-border px-3 py-2 text-sm text-danger-text">
          {error}
        </div>
      )}
      {phase === "password" ? (
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
          <Input type="password" label="סיסמה" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              ביטול
            </Button>
            <Button type="submit">המשך</Button>
          </div>
        </form>
      ) : guard.blocked ? (
        <BlockedPanel />
      ) : (
        <form onSubmit={handleOtpSubmit} className="flex flex-col gap-3">
          <Input
            label="קוד אימות"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            className="text-center tracking-[0.4em] text-lg"
            disabled={guard.verifyLockSecondsLeft > 0}
            required
          />
          <WrongAttemptsLockoutNotice secondsLeft={guard.verifyLockSecondsLeft} />
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              ביטול
            </Button>
            <Button type="submit" disabled={guard.verifyLockSecondsLeft > 0}>
              אשר קוד
            </Button>
          </div>
          <ResendControl
            secondsLeft={guard.secondsLeft}
            onResend={handleResend}
            resendCount={guard.resendCount}
            issueReported={guard.issueReported}
            onReportIssue={() => guard.reportIssue("sms", currentUser?.email ?? "")}
          />
        </form>
      )}
    </Dialog>
  );
}
