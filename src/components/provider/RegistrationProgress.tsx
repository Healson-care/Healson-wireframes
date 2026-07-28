"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/Progress";
import { cn } from "@/lib/utils";
import type { ProviderProfile } from "@/types";
import { ProviderTypePicker } from "@/components/provider/ProviderTypePicker";
import { PhaseHeader } from "@/components/provider/PhaseHeader";

type StepState = "done" | "current" | "waiting";

// Speak the HEALSON navy + gold across the whole registration panel — the same
// token-remap technique OnboardingProgress uses, so Button/ProgressRing and any
// primary-tinted child follow the brand without per-element overrides.
const BRAND_TOKENS = {
  "--color-primary": "var(--brand-navy)",
  "--color-primary-dark": "var(--brand-navy-900)",
  "--color-accent": "var(--brand-gold)",
} as CSSProperties;

/**
 * PHASE 1 — רישום. The solo path only.
 *
 * Deliberately SHORT. The old version of this panel listed the entire journey
 * including every הקמה step as a locked row, which made registration look like
 * a 12-step slog when it is really three: open an account, fill in who you are,
 * wait for the license check. Everything past that belongs to phase 2 and is
 * summarised in one line rather than enumerated — a provider deciding whether
 * to start should see how little phase 1 costs.
 *
 * A unit-path provider never renders this: Healson completed רישום for them and
 * their account arrives already in הקמה (see src/lib/provider-phases.ts).
 */
export function RegistrationProgress({
  provider,
  displayName,
  className,
}: {
  provider: ProviderProfile;
  /** Falls back to the account name — a draft profile has no name yet. */
  displayName?: string;
  className?: string;
}) {
  const router = useRouter();
  const submitted = !!provider.application_submitted_at;
  const started = !!provider.provider_type;

  const steps: { key: string; label: string; hint: string; state: StepState }[] = [
    {
      key: "account",
      label: "יצירת חשבון",
      hint: "הושלם — את/ה כבר בתוך הפורטל",
      state: "done",
    },
    {
      key: "application",
      label: "פרטי הבקשה והמסמכים",
      hint: submitted
        ? "נשלח לבדיקה"
        : started
        ? "אפשר להמשיך עכשיו או לחזור מתי שנוח — הפרטים נשמרים"
        : "בוחרים סוג ספק וממלאים את הפרטים",
      state: submitted ? "done" : "current",
    },
    {
      key: "license",
      label: 'בדיקת רישיון ע"י צוות Healson',
      hint: submitted ? "בבדיקה — בדרך כלל עד 24 שעות. נעדכן אותך במייל" : "מתחילה אחרי שליחת הבקשה",
      state: "waiting",
    },
  ];

  const doneCount = steps.filter((s) => s.state === "done").length;
  const percent = Math.round((doneCount / steps.length) * 100);

  // One line, not a checklist — phase 2 is previewed, never enumerated here.
  const nextPhaseTeaser = (
    <p className="flex items-start gap-2 rounded-xl border border-dashed border-[var(--brand-gold)]/40 bg-[var(--brand-gold)]/[0.06] px-3 py-2.5 text-xs leading-relaxed text-[var(--brand-ink-soft)]">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand-gold-deep)]" />
      <span>
        מיד אחרי אישור הרישיון נפתח <b className="text-[var(--brand-navy)]">שלב ההקמה</b> — הסכמים, פריטים, מיקומים
        ולוחות זמנים. אין צורך להתעסק בזה עכשיו.
      </span>
    </p>
  );

  const stepsList = (
    <ol className="flex flex-col gap-1.5">
      {steps.map((step) => {
        const icon =
          step.state === "done" ? (
            <CheckCircle2 className="h-4 w-4 text-success-text" />
          ) : step.state === "current" ? (
            <Circle className="h-4 w-4 text-[var(--brand-navy)]" />
          ) : (
            <Clock className={cn("h-4 w-4 text-slate-400", submitted && "animate-pulse text-info")} />
          );
        return (
          <li
            key={step.key}
            className={cn(
              "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-right",
              step.state === "done"
                ? "border-success-border bg-success-bg/50"
                : step.state === "current"
                ? "border-[var(--brand-navy)]/25 bg-white shadow-sm"
                : submitted
                ? "border-info-border bg-info-bg/50"
                : "border-slate-200/70 bg-slate-50/60"
            )}
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-900">{step.label}</span>
              <span className="block text-xs text-slate-500">{step.hint}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );

  // First screen after the account is created: one decision on stage, nothing
  // else — a navy welcome band that echoes the /apply arrival, with the type
  // picker (light cards) popping on top of it.
  if (!started) {
    return (
      <div className={cn("flex flex-col gap-4", className)} style={BRAND_TOKENS}>
        <div className="relative overflow-hidden rounded-3xl border border-[var(--brand-ivory-200)] bg-gradient-to-br from-white via-[var(--brand-ivory)] to-[var(--brand-ivory)] p-6 shadow-sm sm:p-8">
          <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-l from-transparent via-[var(--brand-gold)] to-transparent opacity-70" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_-10%,rgba(198,161,91,0.14),transparent_45%)]" />

          <span className="relative inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-gold)]/40 bg-[var(--brand-gold)]/[0.12] px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-gold-deep)]">
            <CheckCircle2 className="h-3.5 w-3.5" /> החשבון שלך נוצר · את/ה מחובר/ת
          </span>

          <h2 className="relative mt-3 font-display text-[26px] font-bold leading-tight text-[var(--brand-navy)] sm:text-[30px]">
            ברוך/ה הבא/ה להילסון{displayName ? `, ${displayName}` : ""}
          </h2>
          <p className="relative mt-2 max-w-2xl text-sm leading-relaxed text-[var(--brand-ink-soft)]">
            נשאר רק לספר לנו מה את/ה עושה, כדי שנדע אילו פרטים ומסמכים לבקש. הרישום קצר — את כל השאר מקימים
            אחר כך, בקצב שלך.
          </p>

          <div className="relative mt-6">
            <ProviderTypePicker />
          </div>

          <p className="relative mt-5 flex items-center gap-1.5 text-xs text-[var(--brand-ink-soft)]">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[var(--brand-gold-deep)]" />
            אפשר לעצור בכל שלב — כל מה שתמלא/י נשמר, ושום דבר לא נשלח ל-Healson עד שתחליט/י לשלוח לבדיקה.
          </p>
        </div>
        <div className="rounded-3xl border border-[var(--brand-ivory-200)] bg-white p-5">{nextPhaseTeaser}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-[var(--brand-ivory-200)] bg-white p-5 shadow-sm sm:p-6",
        className
      )}
      style={BRAND_TOKENS}
    >
      <PhaseHeader phase="registration" className="mb-4" />
      <div className="flex flex-wrap items-center gap-5">
        <ProgressRing
          percent={percent}
          size={72}
          tone={submitted ? "info" : "primary"}
          label="הושלם"
          textClassName="text-slate-900"
        />
        <div className="min-w-[220px] flex-1">
          <div className="flex items-center gap-2">
            {submitted ? (
              <Clock className="h-4 w-4 text-info" />
            ) : (
              <Sparkles className="h-4 w-4 text-[var(--brand-gold-deep)]" />
            )}
            <h2 className="text-base font-bold text-slate-900">
              {submitted ? "הבקשה בבדיקה אצל Healson" : "השלמת הרישום"}
            </h2>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {submitted
              ? "אין מה לעשות כרגע — צוות Healson בודק את הרישיון והמסמכים. ברגע שהבדיקה תסתיים ייפתח שלב ההקמה, ונעדכן אותך במייל."
              : "החשבון שלך כבר קיים. נשאר להשלים את פרטי הבקשה — לא חייבים הכול עכשיו: כל מה שמילאת נשמר."}
          </p>
        </div>
        {!submitted && (
          <Button className="shrink-0" onClick={() => router.push("/provider/register")}>
            המשך במילוי הבקשה
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="mt-5">{stepsList}</div>
      <div className="mt-3">{nextPhaseTeaser}</div>

      {!submitted && (
        <p className="mt-3 text-center text-xs text-slate-400">
          רוצה לשנות את סוג הספק?{" "}
          <Link href="/provider/register" className="font-medium text-[var(--brand-navy)] hover:underline">
            בחזרה לבחירה
          </Link>
        </p>
      )}
    </div>
  );
}
