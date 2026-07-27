"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { OtpIssueChannel, OtpIssueContext } from "@/types";

const RESEND_COOLDOWN_SECONDS = 30;
// After this many resends without success, offer "לא קיבלתי" to flag a real
// delivery problem (wrong carrier, blocked sender, etc.) instead of letting
// the user resend forever.
const OTP_ISSUE_THRESHOLD = 2;
// Once reported, the user gets this many more resend attempts before the
// screen locks entirely — endless retries don't help if the channel is
// actually broken, and it's the signal that staff needs to step in.
const MAX_RESENDS_AFTER_REPORT = 2;
// Wrong-code guessing had no rate limit at all — this caps it so a 6-digit
// numeric code can't just be brute-forced (there's no backend rate limit
// either, since there's no backend).
const MAX_WRONG_ATTEMPTS = 5;
const WRONG_ATTEMPTS_LOCKOUT_SECONDS = 60;

/** Resend cooldown + wrong-attempt lockout + "report to team" escalation —
 * shared by every OTP-entry screen in the app (registration, login,
 * forgot-password, step-up re-auth). One instance per independently
 * verifiable OTP step (e.g. registration's SMS and email steps each get
 * their own instance, since resending one shouldn't reset the other's
 * count). See ResendControl/BlockedPanel below for the matching UI. */
export function useOtpAttemptGuard(context: OtpIssueContext) {
  const showToast = useStore((s) => s.showToast);
  const reportOtpIssueAction = useStore((s) => s.reportOtpIssue);

  const [resendUnlockAt, setResendUnlockAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [verifyLockUntil, setVerifyLockUntil] = useState<number | null>(null);
  const [verifyLockSecondsLeft, setVerifyLockSecondsLeft] = useState(0);
  const [issueReported, setIssueReported] = useState(false);
  const [issueReportId, setIssueReportId] = useState<string | null>(null);

  // Tracks the specific report this screen filed, so it can watch (live, via
  // the store) whether staff already resolved it.
  const issueReport = useStore((s) =>
    issueReportId ? s.otpIssueReports.find((r) => r.id === issueReportId) : undefined
  );

  useEffect(() => {
    if (!resendUnlockAt) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((resendUnlockAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [resendUnlockAt]);

  useEffect(() => {
    if (!verifyLockUntil) {
      setVerifyLockSecondsLeft(0);
      return;
    }
    const tick = () => setVerifyLockSecondsLeft(Math.max(0, Math.ceil((verifyLockUntil - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [verifyLockUntil]);

  // Once staff marks the report "טופל" (resolved), lift the block
  // automatically instead of making the user refresh — the store update is
  // live, so this fires as soon as that happens on the staff side.
  useEffect(() => {
    if (issueReport?.status === "טופל") {
      showToast("התקלה טופלה על ידי הצוות — אפשר לנסות שוב", { variant: "success" });
      setIssueReported(false);
      setIssueReportId(null);
      setResendCount(0);
    }
  }, [issueReport?.status, showToast]);

  const blocked = issueReported && resendCount >= OTP_ISSUE_THRESHOLD + MAX_RESENDS_AFTER_REPORT;

  return {
    secondsLeft,
    resendCount,
    verifyLockSecondsLeft,
    issueReported,
    blocked,
    /** Call when a fresh OTP screen opens with no code sent yet (e.g. a
     * dialog re-opening before the password step) to clear any
     * lockout/report state left over from a previous run. */
    reset() {
      setResendUnlockAt(null);
      setWrongAttempts(0);
      setVerifyLockUntil(null);
      setIssueReported(false);
      setIssueReportId(null);
      setResendCount(0);
    },
    /** Same as reset(), but also starts the resend cooldown — for the
     * moment a fresh code has just been sent (not a re-send), so the
     * "שלח קוד מחדש" link shouldn't be immediately clickable either. */
    start() {
      setWrongAttempts(0);
      setVerifyLockUntil(null);
      setIssueReported(false);
      setIssueReportId(null);
      setResendCount(0);
      setResendUnlockAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    },
    noteResend() {
      setResendCount((c) => c + 1);
      setWrongAttempts(0);
      setVerifyLockUntil(null);
      setResendUnlockAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    },
    noteWrongAttempt() {
      setWrongAttempts((c) => {
        const next = c + 1;
        if (next >= MAX_WRONG_ATTEMPTS) {
          setVerifyLockUntil(Date.now() + WRONG_ATTEMPTS_LOCKOUT_SECONDS * 1000);
          return 0;
        }
        return next;
      });
    },
    reportIssue(channel: OtpIssueChannel, contact: string) {
      const record = reportOtpIssueAction(channel, contact, context);
      setIssueReported(true);
      setIssueReportId(record.id);
      showToast("התקלה דווחה לצוות", { description: "ניצור איתך קשר בהקדם לבירור העניין", variant: "success" });
    },
  };
}

export type OtpAttemptGuard = ReturnType<typeof useOtpAttemptGuard>;

/** Resend link with a countdown lock, plus an escalation option once the
 * user has resent enough times without success (see OTP_ISSUE_THRESHOLD). */
export function ResendControl({
  secondsLeft,
  onResend,
  resendCount,
  issueReported,
  onReportIssue,
}: {
  secondsLeft: number;
  onResend: () => void;
  resendCount: number;
  issueReported: boolean;
  onReportIssue: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onResend}
        disabled={secondsLeft > 0}
        className={cn(
          "text-sm font-medium",
          secondsLeft > 0 ? "text-slate-400 cursor-not-allowed" : "text-primary hover:underline"
        )}
      >
        {secondsLeft > 0 ? `שליחה חוזרת בעוד 0:${String(secondsLeft).padStart(2, "0")}` : "שלח קוד מחדש"}
      </button>
      {resendCount >= OTP_ISSUE_THRESHOLD &&
        (issueReported ? (
          <p className="text-xs font-medium text-success-text">התקלה דווחה לצוות — ניצור קשר בהקדם</p>
        ) : (
          <button type="button" onClick={onReportIssue} className="text-xs font-medium text-danger-text hover:underline">
            עדיין לא קיבלתי את הקוד — דווחו לצוות
          </button>
        ))}
    </div>
  );
}

/** Replaces the code form entirely once too many resends failed after a
 * report was already filed — endless retries don't help a broken channel,
 * and freezing the screen makes the "wait for staff" state unambiguous. */
export function BlockedPanel() {
  return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-3 text-sm text-amber-800">
      התקלה דווחה לצוות ועדיין לא טופלה — לא ניתן להמשיך בשלב הזה עד לבדיקה. ניצור איתך קשר בהקדם, והמסך הזה ייפתח מחדש אוטומטית ברגע שהתקלה תטופל.
    </div>
  );
}

/** Wrong-attempt lockout message shown under the code field — the
 * counterpart to BlockedPanel for the (much more common) "still has resends
 * left" case. */
export function WrongAttemptsLockoutNotice({ secondsLeft }: { secondsLeft: number }) {
  if (secondsLeft <= 0) return null;
  return (
    <p className="-mt-1.5 text-center text-xs font-medium text-danger-text">
      יותר מדי ניסיונות שגויים — ניתן לנסות שוב בעוד 0:{String(secondsLeft).padStart(2, "0")}, או לשלוח קוד חדש
    </p>
  );
}
