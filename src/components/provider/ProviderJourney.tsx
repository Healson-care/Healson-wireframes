"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, Clock, Lock, PartyPopper, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/Progress";
import { cn } from "@/lib/utils";
import type { ProviderProfile } from "@/types";
import { getProviderSetupConfig } from "@/lib/provider-setup";
import { ProviderTypePicker } from "@/components/provider/ProviderTypePicker";

type JourneyState = "done" | "current" | "waiting" | "locked";

interface JourneyStep {
  key: string;
  label: string;
  hint?: string;
  state: JourneyState;
  href?: string;
}

/**
 * The pre-approval half of the provider journey (status === "pending_review"),
 * shown on the dashboard so a freshly registered provider lands in the PORTAL
 * rather than straight in a form. It deliberately renders the WHOLE onboarding
 * path — including the post-approval setup steps — as locked rows, so the
 * provider can see that services/locations/availability exist but only open
 * after Healson verifies the license (INV-SCOPE-GATE-01). Once the license is
 * verified the status flips to "onboarding" and OnboardingProgress (the live
 * meter for those same steps) takes over.
 */
export function ProviderJourney({
  provider,
  displayName,
  className,
}: {
  provider: ProviderProfile;
  /** Falls back to the account name — a draft org profile has no name yet. */
  displayName?: string;
  className?: string;
}) {
  const router = useRouter();
  const setupConfig = getProviderSetupConfig(provider.provider_type);
  const submitted = !!provider.application_submitted_at;
  const started = !!provider.provider_type;

  // Everything past the license check is gated: these rows are informational
  // only — no href, so there is nothing to click through to before approval.
  const lockedSetupSteps: { key: string; label: string }[] = [
    { key: "sign", label: "חתימת הסכם מול Healson" },
    ...(setupConfig.showAgreements ? [{ key: "agreements", label: "הסדרי ביטוח וקופות" }] : []),
    { key: "catalog", label: setupConfig.catalogLabel },
    ...(setupConfig.locationTypes.length > 0 ? [{ key: "locations", label: setupConfig.locationLabelPlural }] : []),
    ...(setupConfig.showFacilities ? [{ key: "facilities", label: "מתקנים" }] : []),
    ...(setupConfig.showAvailability ? [{ key: "availability", label: "זמינות ולוח זמנים" }] : []),
    ...(setupConfig.showAffiliatedDoctors ? [{ key: "doctors", label: "רופאים משויכים" }] : []),
    { key: "publish", label: "פרסום הפרופיל וקבלת הזמנות" },
  ];

  const steps: JourneyStep[] = [
    { key: "account", label: "יצירת חשבון", hint: "הושלם — את/ה כבר בתוך הפורטל", state: "done" },
    {
      key: "application",
      label: "פרטי הבקשה והמסמכים",
      hint: submitted
        ? "נשלח לבדיקה"
        : started
        ? "אפשר להמשיך עכשיו או לחזור מתי שנוח — הפרטים נשמרים"
        : "בוחרים סוג ספק וממלאים את הפרטים — אפשר בכמה פעימות",
      state: submitted ? "done" : "current",
      href: submitted ? undefined : "/provider/register",
    },
    {
      key: "license",
      label: "בדיקת רישיון ע\"י צוות Healson",
      hint: submitted ? "בבדיקה — בדרך כלל עד 24 שעות" : "מתחילה רק אחרי שתשלח/י את הבקשה",
      state: submitted ? "waiting" : "locked",
    },
    ...lockedSetupSteps.map((s) => ({ ...s, state: "locked" as const })),
  ];

  const doneCount = steps.filter((s) => s.state === "done").length;
  const percent = Math.round((doneCount / steps.length) * 100);

  const heading = submitted ? "הבקשה בבדיקה אצל Healson" : "השלמת ההצטרפות";
  const message = submitted
    ? "אין מה לעשות כרגע — צוות Healson בודק את הרישיון והמסמכים שצירפת. ברגע שהבדיקה תסתיים כל שאר השלבים ייפתחו כאן אוטומטית, ונעדכן אותך במייל."
    : started
    ? "החשבון שלך כבר קיים ואת/ה בתוך הפורטל. נשאר להשלים את פרטי הבקשה — לא חייבים הכול עכשיו: כל מה שמילאת נשמר, ואפשר לצאת ולחזור עד שתחליט/י לשלוח לבדיקה."
    : "החשבון שלך נוצר ואת/ה כבר בתוך הפורטל. השלב הבא הוא מילוי פרטי הבקשה — אפשר להתחיל עכשיו ולעצור באמצע: הכול נשמר, ושום דבר לא נשלח ל-Healson עד שתלחץ/י על ‹שליחת בקשה›.";

  const stepsList = (
    <ol className="flex flex-col gap-1.5">
        {steps.map((step) => {
          const icon =
            step.state === "done" ? (
              <CheckCircle2 className="h-4 w-4 text-success-text" />
            ) : step.state === "current" ? (
              <Circle className="h-4 w-4 text-primary" />
            ) : step.state === "waiting" ? (
              <Clock className="h-4 w-4 animate-pulse text-info" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-slate-400" />
            );
          const rowClass = cn(
            "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-right",
            step.state === "done"
              ? "border-success-border bg-success-bg/50"
              : step.state === "current"
              ? "border-primary/40 bg-white shadow-sm"
              : step.state === "waiting"
              ? "border-info-border bg-info-bg/50"
              : "border-slate-200/70 bg-slate-50/60"
          );
          const body = (
            <>
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm font-medium",
                    step.state === "locked" ? "text-slate-400" : "text-slate-900"
                  )}
                >
                  {step.label}
                </span>
                {step.hint && <span className="block text-xs text-slate-500">{step.hint}</span>}
              </span>
              {step.state === "locked" && (
                <span className="mt-0.5 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  נעול
                </span>
              )}
            </>
          );
          return (
            <li key={step.key}>
              {step.href ? (
                <Link href={step.href} className={cn(rowClass, "transition-colors hover:border-primary hover:bg-primary/5")}>
                  {body}
                </Link>
              ) : (
                <div className={rowClass}>{body}</div>
              )}
            </li>
          );
        })}
    </ol>
  );

  const lockNote = (
    <p className="flex items-start gap-2 rounded-xl border border-dashed border-slate-300 bg-white/70 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        השלבים הנעולים — {setupConfig.catalogLabel}, {setupConfig.locationLabelPlural} וזמינות — הם חלק מההצטרפות,
        אבל הם נפתחים רק אחרי שצוות Healson מאמת את הרישיון. עד אז אין צורך להתעסק בהם.
      </span>
    </p>
  );

  // First screen after the account is created. The progress meter would be
  // noise here — there is exactly one thing to do, so the welcome and the type
  // picker get the whole stage and the roadmap moves to a quieter card below.
  if (!started) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/10 via-white to-accent-bg/50 p-5 shadow-sm sm:p-7">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1 text-[11px] font-semibold text-success-text">
            <CheckCircle2 className="h-3.5 w-3.5" /> החשבון שלך נוצר · את/ה מחובר/ת
          </span>
          <h2 className="mt-2.5 flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            ברוך/ה הבא/ה ל-Healson{displayName ? `, ${displayName}` : ""}
            <PartyPopper className="h-5 w-5 text-primary" />
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
            זה הפורטל שלך — מכאן תנהל/י את הבקשה, ובהמשך גם את השירותים, היומן וההזמנות. כדי שנדע אילו פרטים
            ומסמכים לבקש ממך, נתחיל בבחירת סוג הספק.
          </p>
          <div className="mt-5">
            <ProviderTypePicker />
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
            <Save className="h-3.5 w-3.5" />
            אפשר לעצור בכל שלב — כל מה שתמלא/י נשמר, ושום דבר לא נשלח ל-Healson עד שתחליט/י לשלוח לבדיקה.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <ShieldCheck className="h-4 w-4 text-slate-400" /> מה מחכה בהמשך
          </h3>
          {stepsList}
          <div className="mt-3">{lockNote}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/5 via-white to-accent-bg/40 p-5 sm:p-6 shadow-sm",
        className
      )}
    >
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
            {submitted ? <Clock className="h-4 w-4 text-info" /> : <Save className="h-4 w-4 text-primary" />}
            <h2 className="text-base font-bold text-slate-900">{heading}</h2>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{message}</p>
        </div>
        {!submitted && (
          <Button className="shrink-0" onClick={() => router.push("/provider/register")}>
            המשך במילוי הבקשה
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="mt-5">{stepsList}</div>
      <div className="mt-3">{lockNote}</div>
    </div>
  );
}
