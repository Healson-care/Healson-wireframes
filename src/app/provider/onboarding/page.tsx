"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Handshake,
  Stethoscope,
  FileSignature,
  CheckCircle2,
  Rocket,
  Clock3,
  LogOut,
  Lock,
  MapPin,
  CalendarClock,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useRequireRole } from "@/lib/useRequireRole";
import { useCurrentProvider } from "@/lib/useCurrentPatient";
import { Logo } from "@/components/shared/Logo";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { PageHeader, OpenDecisionNote } from "@/components/ui/Misc";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { AgreementsSection } from "@/components/provider/AgreementsSection";
import { PriceListEntry, PriceListSection } from "@/components/provider/PriceListSection";
import { ServiceCatalogSection } from "@/components/provider/ServiceCatalogSection";
import { ClinicsSection } from "@/components/provider/ClinicsSection";
import { AvailabilitySection } from "@/components/provider/AvailabilitySection";
import { AgreementSignSection } from "@/components/provider/AgreementSignSection";
import { ProviderJourneyStepper } from "@/components/provider/ProviderJourneyStepper";
import { OnboardingChecklist } from "@/components/provider/OnboardingChecklist";
import { formatDateHe } from "@/lib/utils";
import {
  getFirstIncompleteStepKey,
  getProviderSetupConfig,
  isAvailabilityComplete,
  isCatalogComplete,
  isLocationsComplete,
} from "@/lib/provider-setup";

export default function ProviderOnboardingPage() {
  const router = useRouter();
  const { ready, user } = useRequireRole("provider");
  const provider = useCurrentProvider();
  const upsertProviderProfile = useStore((s) => s.upsertProviderProfile);
  const signProviderAgreement = useStore((s) => s.signProviderAgreement);
  const requestProviderGoLive = useStore((s) => s.requestProviderGoLive);
  const approveProviderGoLive = useStore((s) => s.approveProviderGoLive);
  const logout = useStore((s) => s.logout);
  const showToast = useStore((s) => s.showToast);
  const [activeTab, setActiveTab] = useState("sign");

  const alreadyLive = ready && provider && provider.status !== "onboarding";

  useEffect(() => {
    if (ready && provider && provider.status === "approved") {
      showToast("אושרת! ברוך/ה הבא/ה לפורטל המלא", { variant: "success" });
      router.replace("/provider/dashboard");
    } else if (ready && !provider) {
      router.replace("/login");
    }
  }, [ready, provider, router, showToast]);

  // Auto-advance the active tab whenever the first incomplete step changes
  // (e.g. right after signing the agreement). Adjusted during render, guarded
  // by the ref, rather than in a useEffect — React's sanctioned pattern for
  // syncing local state from a derived value (see the similar comment in
  // provider/register/page.tsx) that also avoids an extra effect-triggered
  // render on mount.
  //
  // Must be computed unconditionally on every render (Rules of Hooks) —
  // including the render where the early return below fires right after a
  // logout clears `provider`. This used to live after that return, so hook
  // count changed between renders and React crashed ("Rendered fewer hooks
  // than expected") the moment a mid-onboarding provider logged out.
  const nextStepKey = provider ? getFirstIncompleteStepKey(provider) : undefined;
  const [appliedNextStepKey, setAppliedNextStepKey] = useState<string | undefined>(undefined);
  if (nextStepKey && nextStepKey !== appliedNextStepKey) {
    setAppliedNextStepKey(nextStepKey);
    setActiveTab(nextStepKey);
  }

  if (!ready || !user || !provider || alreadyLive) {
    return <DashboardSkeleton />;
  }

  const setupConfig = getProviderSetupConfig(provider.provider_type);
  const step1Done = !!provider.agreement_signed_at;
  const step2Done = provider.agreements.length > 0;
  const step3Done = isCatalogComplete(provider);
  const step4Done = isLocationsComplete(provider);
  const step5Done = isAvailabilityComplete(provider);

  const checklistItems = [
    { label: "חתימה על ההסכם עם Healson", done: step1Done, key: "sign" },
    ...(setupConfig.showAgreements ? [{ label: "הגדרת הסדרי ביטוח (S/K/B/H)", done: step2Done, key: "agreements" }] : []),
    { label: `הגדרת ${setupConfig.catalogLabel}`, done: step3Done, key: "catalog" },
    ...(setupConfig.locationTypes.length > 0
      ? [{ label: `הוספת ${setupConfig.locationLabelSingular} ראשון/ה`, done: step4Done, key: "locations" }]
      : []),
    ...(setupConfig.showAvailability ? [{ label: "הגדרת זמינות", done: step5Done, key: "availability" }] : []),
  ];

  const remainingCount = checklistItems.filter((item) => !item.done).length;
  const nextStep = checklistItems.find((item) => !item.done);

  function handleTabChange(next: string) {
    if (!step1Done && next !== "sign") {
      showToast("יש לחתום על ההסכם עם Healson לפני הזנת הסדרים וקטלוג שירותים", { variant: "destructive" });
      return;
    }
    setActiveTab(next);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              אונבורדינג ספק
            </span>
          </div>
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">התנתק</span>
          </button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-6">
        <PageHeader
          title={`ברוך/ה הבא/ה, ${provider.title ?? ""} ${provider.display_name}`}
          description={
            nextStep
              ? `הרישיון שלך אומת. נותרו ${remainingCount} שלבים להשלמת ההצטרפות.`
              : "הרישיון שלך אומת וכל השלבים הושלמו."
          }
        />

        {/* Corrections from Healson come first — the most urgent thing on the page. */}
        {provider.rejection_reason && (
          <Card className="mb-5 border-danger-border bg-danger-bg">
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-danger-text">
                <p className="font-medium mb-0.5">נדרשים תיקונים מצוות Healson:</p>
                <p>{provider.rejection_reason}</p>
              </div>
              {nextStep && (
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => setActiveTab(nextStep.key)}>
                  עבור לתיקון
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <ProviderJourneyStepper provider={provider} className="mb-5" />

        {provider.go_live_requested_at ? (
          <>
            <Card className="mb-5 border-info-border bg-info-bg">
              <CardContent className="flex items-center gap-3 text-info-text">
                <Clock3 className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">
                  ביקשת פרסום בתאריך {formatDateHe(provider.go_live_requested_at)} — הבקשה ממתינה לאישור Go-Live סופי
                  של צוות Healson. תקבל/י עדכון ברגע שהפרופיל יאושר ויפורסם.
                </p>
              </CardContent>
            </Card>
            {/* Demo-only shortcut mirroring the register page's "מצב הדגמה"
                box — simulates the admin's approveProviderGoLive action so a
                demo can walk the full journey without switching to the admin
                account. The approved-status effect at the top of this page
                then redirects to the full dashboard automatically. */}
            <div className="mb-5 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-4">
              <p className="mb-1 text-xs font-semibold text-amber-700">🎮 מצב הדגמה</p>
              <p className="mb-3 text-xs text-amber-700/80">
                לצורך הדגמת המוצר בלבד — סמלץ את אישור הפרסום של צוות Healson:
              </p>
              <Button
                onClick={() => approveProviderGoLive(provider.id)}
                variant="outline"
                className="text-primary border-primary/40"
              >
                <Rocket className="h-4 w-4" /> אשר פרסום ועבור לפורטל המלא (דמו)
              </Button>
            </div>
          </>
        ) : provider.onboarding_ready_at || !nextStep ? (
          // Shown when the store stamped onboarding_ready_at OR every
          // checklist step is done — the store's stamp has extra conditions
          // (insurance agreements, service↔calendar linkage) that don't apply
          // to every provider type, and the publish CTA must never disappear
          // for a provider who finished everything the wizard asked of them.
          <Card className="mb-5 border-success-border bg-success-bg">
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-success-text">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">כל השלבים הושלמו! השלב האחרון הוא לשלוח בקשה לפרסום.</p>
              </div>
              <Button
                onClick={() => {
                  requestProviderGoLive(provider.id);
                  showToast("הבקשה לפרסום נשלחה לצוות Healson", { variant: "success" });
                }}
              >
                <Rocket className="h-4 w-4" /> פרסם והגש לאישור Healson
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="mb-5">
            <OnboardingChecklist items={checklistItems} ring onItemClick={handleTabChange} />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="sign" icon={<FileSignature className="h-3.5 w-3.5" />}>
              {step1Done && <CheckCircle2 className="h-3 w-3 text-emerald-500" />} חתימת הסכם
            </TabsTrigger>
            {setupConfig.showAgreements && (
              <TabsTrigger value="agreements" icon={step1Done ? <Handshake className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}>
                {step2Done && <CheckCircle2 className="h-3 w-3 text-emerald-500" />} הסדרי ביטוח
              </TabsTrigger>
            )}
            <TabsTrigger value="catalog" icon={step1Done ? <Stethoscope className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}>
              {step3Done && <CheckCircle2 className="h-3 w-3 text-emerald-500" />} שירותים
            </TabsTrigger>
            <TabsTrigger value="locations" icon={step1Done ? <MapPin className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}>
              {step4Done && <CheckCircle2 className="h-3 w-3 text-emerald-500" />} {setupConfig.locationLabelPlural}
            </TabsTrigger>
            {setupConfig.showAvailability && (
              <TabsTrigger value="availability" icon={step1Done ? <CalendarClock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}>
                {step5Done && <CheckCircle2 className="h-3 w-3 text-emerald-500" />} זמינות
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="sign">
            <AgreementSignSection
              signedAt={provider.agreement_signed_at}
              onSign={() => {
                signProviderAgreement(provider.id);
                showToast("ההסכם נחתם בהצלחה — כעת ניתן להזין הסדרי ביטוח וקטלוג שירותים", { variant: "success" });
                setActiveTab(setupConfig.showAgreements ? "agreements" : "catalog");
              }}
            />
          </TabsContent>

          {setupConfig.showAgreements && (
            <TabsContent value="agreements">
              <AgreementsSection
                providerId={provider.id}
                agreements={provider.agreements}
                onChange={(agreements) => upsertProviderProfile(user.id, { agreements })}
                kupahArrangements={provider.kupah_arrangements ?? []}
                onKupahArrangementsChange={(kupah_arrangements) => upsertProviderProfile(user.id, { kupah_arrangements })}
                privateInsuranceCompanies={provider.private_insurance_companies ?? []}
                onPrivateInsuranceCompaniesChange={(private_insurance_companies) =>
                  upsertProviderProfile(user.id, { private_insurance_companies })
                }
              />
            </TabsContent>
          )}

          <TabsContent value="catalog" className="flex flex-col gap-6">
            <OpenDecisionNote>
              <b>טרם הוחלט:</b> מדיניות תמחור סופית עדיין לא נקבעה ע&quot;י הנהלת Healson. כרגע אתם קובעים בעצמכם את
              המחיר לכל שכבת ביטוח (S/K/B/H) — ייתכן שבעתיד ייקבע טווח מחירים מאושר או מדיניות תמחור אחידה במסגרת
              ההסכם.
            </OpenDecisionNote>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">{setupConfig.catalogLabel}</h3>
              {setupConfig.useSkillTreeCatalog ? (
                <ServiceCatalogSection
                  items={provider.consultation_types}
                  onChange={(items) => upsertProviderProfile(user.id, { consultation_types: items })}
                  providerId={provider.id}
                  itemLabel={setupConfig.catalogItemLabel}
                  clinics={provider.clinic_locations}
                  providerSpecialty={provider.specialty}
                />
              ) : (
                <PriceListSection
                  items={provider.consultation_types as unknown as PriceListEntry[]}
                  onChange={(items) =>
                    upsertProviderProfile(user.id, { consultation_types: items as unknown as typeof provider.consultation_types })
                  }
                  extraFieldKey={setupConfig.catalogExtraFieldKey}
                  extraFieldLabel={setupConfig.catalogExtraFieldLabel}
                  extraFieldType={setupConfig.catalogExtraFieldType}
                  itemLabel={setupConfig.catalogItemLabel}
                  clinics={provider.clinic_locations}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="locations">
            <ClinicsSection
              clinics={provider.clinic_locations}
              onChange={(clinics) => upsertProviderProfile(user.id, { clinic_locations: clinics })}
              allowedLocationTypes={setupConfig.locationTypes}
              locationLabelSingular={setupConfig.locationLabelSingular}
              locationLabelPlural={setupConfig.locationLabelPlural}
              linkedServices={provider.consultation_types}
            />
          </TabsContent>

          {setupConfig.showAvailability && (
            <TabsContent value="availability">
              <AvailabilitySection
                clinics={provider.clinic_locations}
                onChange={(clinics) => upsertProviderProfile(user.id, { clinic_locations: clinics })}
                locationLabelSingular={setupConfig.locationLabelSingular}
                locationLabelPlural={setupConfig.locationLabelPlural}
              />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
