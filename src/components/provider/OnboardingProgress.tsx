"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, Rocket, ArrowLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ProgressRing } from "@/components/ui/Progress";
import { AgreementSignSection } from "@/components/provider/AgreementSignSection";
import { ProfilePhotoDialog } from "@/components/provider/ProfilePhoto";
import { SurgicalPrivilegesSection } from "@/components/provider/SurgicalPrivilegesSection";
import { DemoPanel } from "@/components/provider/DemoPanel";
import { cn } from "@/lib/utils";
import type { ProviderProfile } from "@/types";
import { isUnitPath } from "@/lib/provider-phases";
import { PhaseHeader } from "@/components/provider/PhaseHeader";
import {
  getNextProviderAction,
  getProviderSetupConfig,
  isCatalogComplete,
  isLocationsComplete,
  isAvailabilityComplete,
  isAffiliatedDoctorsComplete,
  isSurgicalPrivilegesComplete,
  needsSurgicalPrivileges,
  requiresPlatformAgreement,
} from "@/lib/provider-setup";

interface Step {
  key: string;
  ok: boolean;
  label: string;
  /** Second line under the label in the stepper — never required reading. */
  hint?: string;
  href?: string;
  /** The agreement-signing step opens a dialog instead of navigating. */
  sign?: boolean;
  /** The profile step also opens a dialog (photo upload happens in place). */
  photo?: boolean;
  /** Surgical privileges — also an in-place dialog. */
  surgical?: boolean;
  /** Recommended but never blocks the go-live request, and doesn't count
   * toward the completion percent. */
  optional?: boolean;
}

/**
 * PHASE 2 — הקמה. The persistent setup meter, and the point where the two join
 * paths unite: a solo provider arrives here after Healson verifies their
 * license, a medical unit STARTS here (Ops opened the account, so רישום never
 * existed for them — see src/lib/provider-phases.ts).
 *
 * Shown on the dashboard and on every profile-config page for as long as
 * `status === "onboarding"`, so the provider always knows what's left and can
 * jump to it. Self-contained: owns the agreement-sign dialog and the go-live /
 * demo-approve actions. Once published it is never rendered again.
 */
export function OnboardingProgress({ provider, className }: { provider: ProviderProfile; className?: string }) {
  const router = useRouter();
  const signProviderAgreement = useStore((s) => s.signProviderAgreement);
  const requestProviderGoLive = useStore((s) => s.requestProviderGoLive);
  const approveProviderGoLive = useStore((s) => s.approveProviderGoLive);
  const showToast = useStore((s) => s.showToast);
  const updateProviderById = useStore((s) => s.updateProviderById);
  const organizationBranches = useStore((s) => s.organizationBranches);
  const serviceArrays = useStore((s) => s.serviceArrays);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [surgicalDialogOpen, setSurgicalDialogOpen] = useState(false);

  const setupConfig = getProviderSetupConfig(provider.provider_type);
  const unitPath = isUnitPath(provider);
  // Branches and מערכים live in their own store slices, not on the profile.
  const unitBranches = organizationBranches.filter((b) => b.unit_id === provider.id);
  const unitBranchIds = new Set(unitBranches.map((b) => b.id));
  const unitArrays = serviceArrays.filter((a) => unitBranchIds.has(a.branch_id));
  // ORDER: סניפים → פריטים → זמינות → פרופיל → הסכם (wireframe review
  // 04.08.2026). Branches lead because everything after them attaches to one —
  // an item is offered AT a branch, a week is kept FOR a branch. "הסדרי ביטוח"
  // is no longer a step: the קופות are collected at registration and the
  // per-plan terms belong in item pricing. The page itself stays in the
  // profile nav (see profile-sections.ts), it just isn't part of הקמה.
  const steps: Step[] = [
    // Where a surgeon may operate — moved out of registration into הקמה, since
    // it only matters once Healson has verified they are a licensed surgeon.
    // Sits with the branches: it is the same question, for an operating room.
    ...(needsSurgicalPrivileges(provider)
      ? [
          {
            key: "surgical",
            ok: isSurgicalPrivilegesComplete(provider),
            label: "הרשאות ניתוח",
            hint: "היכן תנתחו",
            surgical: true,
          },
        ]
      : []),
    // A unit builds itself bottom-up: סניפים → מערכים → עמדות. Everyone else
    // just needs their location list.
    ...(unitPath && setupConfig.showFacilities
      ? [
          { key: "branches", ok: unitBranches.length > 0, label: "סניפים", href: "/provider/profile/structure" },
          { key: "arrays", ok: unitArrays.length > 0, label: "מערכים", href: "/provider/profile/arrays" },
        ]
      : setupConfig.locationTypes.length > 0
      ? [
          {
            key: "locations",
            ok: isLocationsComplete(provider),
            label: setupConfig.locationLabelPlural,
            href: "/provider/profile/clinics",
          },
        ]
      : []),
    {
      key: "catalog",
      ok: isCatalogComplete(provider),
      label: setupConfig.catalogLabel,
      hint: "ומחירים",
      href: "/provider/profile/services",
    },
    ...(setupConfig.showAvailability
      ? [{ key: "availability", ok: isAvailabilityComplete(provider), label: "זמינות", href: "/provider/profile/availability" }]
      : []),
    ...(setupConfig.showAffiliatedDoctors
      ? [
          {
            key: "doctors",
            ok: isAffiliatedDoctorsComplete(provider),
            label: "נותני שירות",
            href: "/provider/profile/doctors",
          },
        ]
      : []),
    { key: "photo", ok: !!provider.image_url, label: "פרופיל", hint: "מומלץ", photo: true, optional: true },
    // The agreement closes the setup, it doesn't open it — a provider signs
    // once their catalog, prices, branches and hours actually exist. A medical
    // unit signs nothing here at all: its contract is closed off-platform.
    ...(requiresPlatformAgreement(provider)
      ? [{ key: "sign", ok: !!provider.agreement_signed_at, label: "הסכם", sign: true }]
      : []),
  ];
  const requiredSteps = steps.filter((s) => !s.optional);
  const percent = Math.round((requiredSteps.filter((s) => s.ok).length / requiredSteps.length) * 100);
  const firstIncomplete = requiredSteps.find((s) => !s.ok);
  const goLiveRequested = !!provider.go_live_requested_at;
  const message = getNextProviderAction(provider) ?? "כמעט שם — נותרו כמה שלבים לפני הפרסום.";

  function handleGoLive() {
    requestProviderGoLive(provider.id);
    showToast("הבקשה לפרסום נשלחה לצוות Healson", { variant: "success" });
  }

  const cta: { label: string; href?: string; onClick?: () => void } | null = firstIncomplete?.sign
    ? { label: "חתימה על ההסכם", onClick: () => setSignDialogOpen(true) }
    : firstIncomplete?.surgical
    ? { label: "הגדרת הרשאות ניתוח", onClick: () => setSurgicalDialogOpen(true) }
    : firstIncomplete
    ? { label: `המשך: ${firstIncomplete.label}`, href: firstIncomplete.href }
    : goLiveRequested
    ? null
    : { label: "הגשה לאישור ופרסום", onClick: handleGoLive };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/5 via-white to-accent-bg/40 p-5 sm:p-6 shadow-sm",
        className
      )}
      // Speak the HEALSON navy + gold across the whole setup meter — remap the
      // primary/accent tokens for this subtree (stepper, ring, CTA all follow).
      style={
        {
          "--color-primary": "var(--brand-navy)",
          "--color-primary-dark": "var(--brand-navy-900)",
          "--color-accent": "var(--brand-gold)",
        } as React.CSSProperties
      }
    >
      {/* requestProviderChanges drops the provider back to onboarding and stores
          the reviewer's reason — until now it surfaced only in the notifications
          bell, so a provider who never opened it had no idea what to fix. Shown
          until the next go-live request (which clears the banner condition). */}
      {provider.rejection_reason && !goLiveRequested && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warning-border bg-warning-bg p-3.5" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="text-sm text-warning-text">
            <p className="font-semibold">צוות Healson ביקש תיקונים לפני הפרסום:</p>
            <p className="mt-0.5 leading-relaxed">{provider.rejection_reason}</p>
          </div>
        </div>
      )}
      <PhaseHeader phase="setup" registrationDoneByHealson={unitPath} className="mb-4" />

      {/* A unit lands here on day one with nothing configured — frame that as a
          fresh start rather than as "you're 0% done at something you failed". */}
      {unitPath && percent === 0 && !goLiveRequested && (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-info-border bg-info-bg px-3.5 py-2.5 text-sm leading-relaxed text-info-text">
          <Rocket className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            החשבון של {provider.display_name || "היחידה"} מוכן — ההסכמים כבר סגורים מול Healson. מכאן זה שלכם:
            הוסיפו סניפים ומערכים, עמדות ולוחות זמנים, ואת הפריטים שאתם מציעים.
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-5">
        <ProgressRing percent={percent} size={72} tone={goLiveRequested ? "info" : "primary"} label="הושלם" textClassName="text-slate-900" />
        <div className="min-w-[220px] flex-1">
          <div className="flex items-center gap-2">
            {goLiveRequested ? <Clock className="h-4 w-4 text-info" /> : <Rocket className="h-4 w-4 text-primary" />}
            <h2 className="text-base font-bold text-slate-900">
              {goLiveRequested ? "ממתין לאישור פרסום" : "הקמת החשבון"}
            </h2>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{message}</p>
        </div>
        {cta &&
          (cta.href ? (
            <Button className="shrink-0" onClick={() => router.push(cta.href!)}>
              {cta.label}
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <Button className="shrink-0" onClick={cta.onClick}>
              {cta.label}
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ))}
      </div>

      {/* The numbered, clickable stepper (wireframe review 04.08.2026) — it
          replaced a row of chips, which showed the same steps but neither their
          order nor how far along they are. Every stop stays reachable at any
          time: the numbering communicates the intended path, it doesn't lock
          it. `aria-current` marks the first unfinished step for screen readers. */}
      <ol className="mt-5 flex items-start overflow-x-auto pb-1">
        {steps.map((step, i) => {
          const isCurrent = !step.ok && step.key === firstIncomplete?.key;
          const onClick = step.sign
            ? () => setSignDialogOpen(true)
            : step.surgical
            ? () => setSurgicalDialogOpen(true)
            : step.photo
            ? () => setPhotoDialogOpen(true)
            : undefined;
          const inner = (
            <>
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all",
                  step.ok
                    ? "border-primary bg-primary text-white"
                    : isCurrent
                    ? "border-accent bg-white text-accent-text shadow-[0_0_0_4px_var(--color-accent-bg)]"
                    : "border-slate-200 bg-white text-slate-400 group-hover:border-primary/40 group-hover:text-primary"
                )}
              >
                {step.ok ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-[11px] leading-tight",
                  step.ok ? "text-slate-700" : isCurrent ? "font-semibold text-accent-text" : "text-slate-500"
                )}
              >
                {step.label}
              </span>
              {step.hint && <span className="text-[10px] leading-tight text-slate-400">{step.hint}</span>}
            </>
          );
          const stopClass =
            "group flex min-w-[76px] flex-col items-center gap-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg";
          return (
            <li key={step.key} className="flex min-w-[76px] flex-1 items-start">
              {onClick ? (
                <button type="button" onClick={onClick} className={stopClass} aria-current={isCurrent ? "step" : undefined}>
                  {inner}
                </button>
              ) : (
                <Link href={step.href!} className={stopClass} aria-current={isCurrent ? "step" : undefined}>
                  {inner}
                </Link>
              )}
              {/* Pinned to the circle's vertical centre (h-9 → 18px) rather than
                  centred in the <li>, whose height varies with the optional hint. */}
              {i < steps.length - 1 && (
                <div
                  aria-hidden
                  className={cn("mx-1 mt-[17px] h-0.5 flex-1 rounded-full", step.ok ? "bg-primary" : "bg-slate-200")}
                />
              )}
            </li>
          );
        })}
      </ol>

      {goLiveRequested && (
        <DemoPanel className="mt-4" description="לצורך הדגמת המוצר בלבד — סמלץ את אישור הפרסום של צוות Healson:">
          <Button onClick={() => approveProviderGoLive(provider.id)} variant="outline" className="border-primary/40 text-primary">
            <Rocket className="h-4 w-4" /> אשר פרסום ועבור לפורטל החי (דמו)
          </Button>
        </DemoPanel>
      )}

      {/* Same dialog the header avatar opens — one upload surface, one
          explanation of why the photo is worth the minute. */}
      <ProfilePhotoDialog provider={provider} open={photoDialogOpen} onClose={() => setPhotoDialogOpen(false)} />

      <Dialog
        open={surgicalDialogOpen}
        onClose={() => setSurgicalDialogOpen(false)}
        title="הרשאות ניתוח"
        className="max-w-lg"
      >
        <SurgicalPrivilegesSection
          provider={provider}
          onSave={(data) => {
            updateProviderById(provider.id, data);
            showToast("הרשאות הניתוח נשמרו", { variant: "success" });
          }}
          onDone={() => setSurgicalDialogOpen(false)}
        />
      </Dialog>

      <Dialog open={signDialogOpen} onClose={() => setSignDialogOpen(false)} title="חתימה על ההסכם עם Healson">
        <AgreementSignSection
          signedAt={provider.agreement_signed_at}
          onSign={() => {
            signProviderAgreement(provider.id);
            showToast("ההסכם נחתם בהצלחה", { variant: "success" });
            setSignDialogOpen(false);
          }}
        />
      </Dialog>
    </div>
  );
}
