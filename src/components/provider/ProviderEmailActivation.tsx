"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import {
  MailCheck,
  Lock,
  ShieldCheck,
  Inbox,
  CheckCircle2,
  MousePointerClick,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// Same navy + gold token remap the other registration panels use, so the very
// first screen of the portal speaks in the /apply brand voice it arrived from.
const BRAND_TOKENS = {
  "--color-primary": "var(--brand-navy)",
  "--color-primary-dark": "var(--brand-navy-900)",
  "--color-accent": "var(--brand-gold)",
} as CSSProperties;

const RESEND_SECONDS = 30;

/**
 * PHASE 1, STEP 0 — הפעלת החשבון.
 *
 * The account exists and the applicant is already signed in, but an activation
 * link was mailed to them and nothing else in the portal opens until it's
 * clicked (see needsEmailActivation): no provider-type picker, no application
 * form. Everything the applicant would normally do in their mail client is
 * mirrored on the left as a mock message — clicking its button IS clicking the
 * link, which is what makes the gate demonstrable without a real inbox.
 */
export function ProviderEmailActivation({
  email,
  displayName,
  className,
}: {
  /** The address the activation mail went to — the account's login email. */
  email: string;
  displayName?: string;
  className?: string;
}) {
  const verifyProviderEmailLink = useStore((s) => s.verifyProviderEmailLink);
  const resendProviderActivationEmail = useStore((s) => s.resendProviderActivationEmail);
  const showToast = useStore((s) => s.showToast);
  const [activating, setActivating] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function handleActivate() {
    setActivating(true);
    // A beat of latency — the real link round-trips through the server, and
    // without it the whole screen swaps mid-click with no cause visible.
    setTimeout(() => {
      const result = verifyProviderEmailLink();
      setActivating(false);
      if (!result.ok) {
        showToast(result.error ?? "לא הצלחנו להפעיל את החשבון", { variant: "destructive" });
        return;
      }
      showToast("החשבון הופעל · כתובת המייל אומתה", {
        description: "אפשר להתחיל למלא את הבקשה.",
        variant: "success",
      });
    }, 500);
  }

  function handleResend() {
    if (cooldown > 0) return;
    if (!resendProviderActivationEmail()) return;
    setCooldown(RESEND_SECONDS);
    showToast("שלחנו את מייל ההפעלה מחדש", { description: `לכתובת ${email}` });
  }

  return (
    <div className={cn("flex flex-col gap-4", className)} style={BRAND_TOKENS}>
      <div className="relative overflow-hidden rounded-3xl border border-[var(--brand-ivory-200)] bg-gradient-to-br from-white via-[var(--brand-ivory)] to-[var(--brand-ivory)] p-6 shadow-sm sm:p-8">
        <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-l from-transparent via-[var(--brand-gold)] to-transparent opacity-70" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_-10%,rgba(198,161,91,0.14),transparent_45%)]" />

        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          {/* ── The notice ───────────────────────────────────────────────── */}
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-gold)]/40 bg-[var(--brand-gold)]/[0.12] px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-gold-deep)]">
              <CheckCircle2 className="h-3.5 w-3.5" /> החשבון שלך נוצר · את/ה מחובר/ת
            </span>

            <h2 className="mt-3 font-display text-[26px] font-bold leading-tight text-[var(--brand-navy)] sm:text-[30px]">
              נשאר להפעיל את החשבון{displayName ? `, ${displayName}` : ""}
            </h2>

            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-[var(--brand-ink-soft)]">
              שלחנו מייל עם קישור הפעלה לכתובת{" "}
              <span className="font-semibold text-[var(--brand-navy)]" dir="ltr">
                {email}
              </span>
              . לחיצה על הקישור מאמתת את כתובת המייל שלך ופותחת את מילוי הבקשה — בחירת סוג הספק,
              הפרטים והמסמכים.
            </p>

            <p className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 text-xs leading-relaxed text-[var(--brand-ink-soft)]">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span>
                עד ההפעלה אין מה למלא כאן — הפורטל ייפתח במלואו מיד לאחר הלחיצה על הקישור, ולא צריך
                להתחבר שוב.
              </span>
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[var(--brand-ink-soft)]">
              <span className="flex items-center gap-1.5">
                <Inbox className="h-3.5 w-3.5 shrink-0 text-[var(--brand-gold-deep)]" />
                לא קיבלת? כדאי לבדוק את תיקיית הספאם.
              </span>
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0}
                className={cn(
                  "font-semibold transition-colors",
                  cooldown > 0
                    ? "cursor-not-allowed text-slate-300"
                    : "text-[var(--brand-navy)] hover:text-[var(--brand-gold-deep)] hover:underline"
                )}
              >
                {cooldown > 0 ? `שליחה חוזרת בעוד ${cooldown} שניות` : "שליחת המייל מחדש"}
              </button>
            </div>
          </div>

          {/* ── The mail itself, as the demo's "inbox" ───────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative overflow-hidden rounded-2xl border border-[var(--brand-ivory-200)] bg-white shadow-[0_24px_50px_-30px_rgba(20,42,79,0.45)]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <MailCheck className="h-3.5 w-3.5 text-[var(--brand-gold-deep)]" />
                המייל שנשלח אליך
              </span>
              <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                הדגמה
              </span>
            </div>

            <div className="px-4 py-4 text-center">
              <p className="text-[11px] text-slate-400" dir="ltr">
                no-reply@healson.co.il
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--brand-navy)]">
                הפעלת חשבון נותן השירות שלך
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                {displayName ? `שלום ${displayName}, ` : ""}
                תודה שנרשמת להילסון. לאישור כתובת המייל והפעלת החשבון:
              </p>

              <Button className="mt-3.5 w-full" loading={activating} onClick={handleActivate}>
                <MousePointerClick className="h-4 w-4" />
                הפעלת החשבון
              </Button>

              <p className="mt-2.5 text-[10px] leading-relaxed text-slate-400">
                הקישור תקף ל-72 שעות. אם לא נרשמת להילסון, אין צורך לעשות דבר.
              </p>
            </div>

            <p className="flex items-center justify-center gap-1.5 border-t border-slate-100 bg-[var(--brand-ivory)]/60 px-4 py-2 text-[10px] text-slate-400">
              <ShieldCheck className="h-3 w-3 shrink-0" />
              במצב הדגמה הכפתור מחליף את הלחיצה על הקישור במייל
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
