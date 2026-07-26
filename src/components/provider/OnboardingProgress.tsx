"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Circle, Clock, Rocket, ArrowLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ProgressRing } from "@/components/ui/Progress";
import { AgreementSignSection } from "@/components/provider/AgreementSignSection";
import { ProfilePhotoField } from "@/components/provider/ProfilePhotoField";
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
} from "@/lib/provider-setup";

interface Step {
  key: string;
  ok: boolean;
  label: string;
  href?: string;
  /** The agreement-signing step opens a dialog instead of navigating. */
  sign?: boolean;
  /** The profile-photo step also opens a dialog (upload happens in place). */
  photo?: boolean;
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

  const setupConfig = getProviderSetupConfig(provider.provider_type);
  const unitPath = isUnitPath(provider);
  // Branches and מערכים live in their own store slices, not on the profile.
  const unitBranches = organizationBranches.filter((b) => b.unit_id === provider.id);
  const unitBranchIds = new Set(unitBranches.map((b) => b.id));
  const unitArrays = serviceArrays.filter((a) => unitBranchIds.has(a.branch_id));
  const steps: Step[] = [
    { key: "sign", ok: !!provider.agreement_signed_at, label: "חתימת הסכם", sign: true },
    ...(setupConfig.showAgreements
      ? [{ key: "agreements", ok: provider.agreements.length > 0, label: "הסדרי ביטוח", href: "/provider/profile/agreements" }]
      : []),
    { key: "catalog", ok: isCatalogComplete(provider), label: setupConfig.catalogLabel, href: "/provider/profile/services" },
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
    { key: "photo", ok: !!provider.image_url, label: "תמונת פרופיל · מומלץ", photo: true, optional: true },
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
          <div className="mt-3 flex flex-wrap gap-1.5">
            {steps.map((step) => {
              const chipClass = cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                step.ok
                  ? "border-success-border bg-success-bg text-success-text"
                  : "border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:text-primary"
              );
              const inner = (
                <>
                  {step.ok ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                  {step.label}
                </>
              );
              if (step.sign || step.photo) {
                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => (step.sign ? setSignDialogOpen(true) : setPhotoDialogOpen(true))}
                    className={chipClass}
                  >
                    {inner}
                  </button>
                );
              }
              return (
                <Link key={step.key} href={step.href!} className={chipClass}>
                  {inner}
                </Link>
              );
            })}
          </div>
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

      {goLiveRequested && (
        <DemoPanel className="mt-4" description="לצורך הדגמת המוצר בלבד — סמלץ את אישור הפרסום של צוות Healson:">
          <Button onClick={() => approveProviderGoLive(provider.id)} variant="outline" className="border-primary/40 text-primary">
            <Rocket className="h-4 w-4" /> אשר פרסום ועבור לפורטל החי (דמו)
          </Button>
        </DemoPanel>
      )}

      <Dialog open={photoDialogOpen} onClose={() => setPhotoDialogOpen(false)} title="תמונת פרופיל">
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-slate-600">
            התמונה (או הלוגו) תוצג למטופלים בתוצאות החיפוש ובעמוד הפרופיל שלך. אפשר להחליף אותה בכל עת
            דרך פרופיל ← הגדרות.
          </p>
          <ProfilePhotoField
            name={provider.display_name}
            imageUrl={provider.image_url}
            onUpload={(url) => {
              updateProviderById(provider.id, { image_url: url });
              showToast("תמונת הפרופיל נשמרה", { variant: "success" });
            }}
          />
          {provider.image_url && (
            <Button className="self-end" onClick={() => setPhotoDialogOpen(false)}>
              סיום
            </Button>
          )}
        </div>
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
