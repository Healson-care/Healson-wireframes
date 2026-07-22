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
import {
  getNextProviderAction,
  getProviderSetupConfig,
  isCatalogComplete,
  isLocationsComplete,
  isAvailabilityComplete,
  isAffiliatedDoctorsComplete,
  isFacilitiesComplete,
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
 * The persistent onboarding progress meter — shown throughout the onboarding
 * STAGE (the dashboard and every profile-config page while `status ===
 * "onboarding"`), so the provider always sees how close they are to going live
 * and can jump to the next step. Self-contained: owns the agreement-sign dialog
 * and the go-live / demo-approve actions. Once published this is never rendered
 * — the provider manages everything through the normal profile pages instead.
 */
export function OnboardingProgress({ provider, className }: { provider: ProviderProfile; className?: string }) {
  const router = useRouter();
  const signProviderAgreement = useStore((s) => s.signProviderAgreement);
  const requestProviderGoLive = useStore((s) => s.requestProviderGoLive);
  const approveProviderGoLive = useStore((s) => s.approveProviderGoLive);
  const showToast = useStore((s) => s.showToast);
  const updateProviderById = useStore((s) => s.updateProviderById);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);

  const setupConfig = getProviderSetupConfig(provider.provider_type);
  const steps: Step[] = [
    { key: "sign", ok: !!provider.agreement_signed_at, label: "חתימת הסכם", sign: true },
    ...(setupConfig.showAgreements
      ? [{ key: "agreements", ok: provider.agreements.length > 0, label: "הסדרי ביטוח", href: "/provider/profile/agreements" }]
      : []),
    { key: "catalog", ok: isCatalogComplete(provider), label: setupConfig.catalogLabel, href: "/provider/profile/services" },
    ...(setupConfig.locationTypes.length > 0
      ? [{ key: "locations", ok: isLocationsComplete(provider), label: setupConfig.locationLabelPlural, href: "/provider/profile/clinics" }]
      : []),
    ...(setupConfig.showFacilities
      ? [{ key: "facilities", ok: isFacilitiesComplete(provider), label: "חדרים", href: "/provider/profile/facilities" }]
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
      <div className="flex flex-wrap items-center gap-5">
        <ProgressRing percent={percent} size={72} tone={goLiveRequested ? "info" : "primary"} label="הושלם" textClassName="text-slate-900" />
        <div className="min-w-[220px] flex-1">
          <div className="flex items-center gap-2">
            {goLiveRequested ? <Clock className="h-4 w-4 text-info" /> : <Rocket className="h-4 w-4 text-primary" />}
            <h2 className="text-base font-bold text-slate-900">
              {goLiveRequested ? "ממתין לאישור פרסום" : "השלמת ההצטרפות"}
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
