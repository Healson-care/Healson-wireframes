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
  Info,
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
  getNextProviderAction,
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
  const nextAction = getNextProviderAction(provider);

  const checklistItems = [
    { label: "חתימה על ההסכם עם Healson", done: step1Done, key: "sign" },
    ...(setupConfig.showAgreements ? [{ label: "הגדרת הסדרי ביטוח (S/K/B/H)", done: step2Done, key: "agreements" }] : []),
    { label: `הגדרת ${setupConfig.catalogLabel}`, done: step3Done, key: "catalog" },
    ...(setupConfig.locationTypes.length > 0
      ? [{ label: `הוספת ${setupConfig.locationLabelSingular} ראשון/ה`, done: step4Done, key: "locations" }]
      : []),
    ...(setupConfig.showAvailability ? [{ label: "הגדרת זמינות", done: step5Done, key: "availability" }] : []),
  ];

  const progressPercent = checklistItems.length > 0 ? Math.round((checklistItems.filter((item) => item.done).length / checklistItems.length) * 100) : 0;
  const nextStep = checklistItems.find((item) => !item.done);
  const isProfileReady = checklistItems.every((item) => item.done);

  const onboardingHighlights = [
    {
      title: "הסכם מאושר",
      description: "הסכם שירותי Healson מאושר ומוכן לתהליך הבא.",
      completed: step1Done,
      icon: FileSignature,
    },
    ...(setupConfig.showAgreements
      ? [
          {
            title: "הגדרת הסדרי ביטוח",
            description: "ביטוח ציבורי, פרטי וקופות סגורות מוגדרים כראוי.",
            completed: step2Done,
            icon: Handshake,
          },
        ]
      : []),
    {
      title: `קטלוג ${setupConfig.catalogLabel}`,
      description: `הגדר את ${setupConfig.catalogItemLabel} הראשון שלך כדי להתחיל לקבל הזמנות.`, 
      completed: step3Done,
      icon: Stethoscope,
    },
    ...(setupConfig.locationTypes.length > 0
      ? [
          {
            title: `${setupConfig.locationLabelPlural} וקביעת מקום`,
            description: `הוספת ${setupConfig.locationLabelSingular} פעיל עם פרטי מיקום מלאים.`, 
            completed: step4Done,
            icon: MapPin,
          },
        ]
      : []),
    ...(setupConfig.showAvailability
      ? [
          {
            title: "פתיחת זמינות",
            description: "קבע ימים, שעות ושעות הזנה כדי לאפשר לקוחות להזמין בקלות.",
            completed: step5Done,
            icon: CalendarClock,
          },
        ]
      : []),
  ];

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
          description="הרישיון שלך אומת. השלימו את השלבים הבאים כדי להשלים את ההצטרפות."
        />

        <Card className="mb-6 overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white shadow-lg">
          <CardContent className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_220px] items-center">
            <div className="space-y-4">
              <div className="rounded-3xl bg-white/10 p-4 text-sm text-slate-200 shadow-inner">
                <p className="font-semibold">ברוכים הבאים למסלול האונבורדינג של ספקים ב-Healson</p>
                <p className="mt-1 text-slate-300">השלבים כאן מעוצבים כך שתוכל לראות בכל רגע מה נשאר ואיך להגיע ל-Go Live בצורה ברורה ומהירה.</p>
              </div>
              <div className="space-y-3">
                <p className="text-sm uppercase tracking-[0.18em] text-slate-400">מה עוד נשאר</p>
                <div className="text-4xl font-bold tracking-tight text-white tabular-nums">{progressPercent}%</div>
                <p className="text-sm text-slate-300">השלמת {checklistItems.filter((item) => item.done).length} מתוך {checklistItems.length} שלבים על מנת להיות פעיל במערכת.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {onboardingHighlights.map((highlight) => {
                  const Icon = highlight.icon;
                  return (
                    <div
                      key={highlight.title}
                      className={
                        highlight.completed
                          ? "rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-4"
                          : "rounded-3xl border border-slate-700/60 bg-white/5 p-4"
                      }
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-slate-100" />
                        <div>
                          <p className="text-sm font-semibold text-white">{highlight.title}</p>
                          <p className="text-xs text-slate-300">{highlight.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 text-center shadow-xl shadow-slate-950/10">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">איך כובשים את השלב הבא</p>
              <p className="mt-4 text-lg font-semibold text-white">השלם את השלבים לפי הסדר כדי להגיע לפרסום במהירות.</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                חתום על ההסכם, בחר את הצעות הביטוח שלך, הוסף שירותים, פרסם מיקום וקבע זמינות — הכל כאן בממשק אחד.
              </p>
              <div className="mt-6 rounded-3xl bg-primary p-4 text-left text-sm text-white shadow-lg shadow-primary/20">
                <p className="font-semibold">טיפ חכם:</p>
                <p className="mt-2 text-slate-100">שמירה של לפחות שירות אחד, מיקום אחד וזמינות מבטיחה שהלקוחות שלך יראו אותך מייד.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <ProviderJourneyStepper provider={provider} className="mb-5" />

        {!provider.go_live_requested_at && !provider.onboarding_ready_at && (
          <Card className="mb-5 border-primary/20 bg-gradient-to-r from-primary/10 via-white to-accent/10 shadow-sm">
            <CardContent className="flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">השלב הבא שלך</p>
                <p className="mt-2 text-sm text-slate-600">
                  {nextStep
                    ? `השלם את ${nextStep.label} כדי להתקדם לשלב הבא ולקרב את הפרופיל שלך לפרסום.`
                    : "הפרופיל שלך מוכן. שלח בקשה לפרסום כדי להתחיל לקבל לקוחות."}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:items-end">
                {nextStep ? (
                  <Button
                    variant="secondary"
                    onClick={() => setActiveTab(nextStep.key)}
                    className="w-full sm:w-auto"
                  >
                    עבור ל{nextStep.label}
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      requestProviderGoLive(provider.id);
                      showToast("הבקשה לפרסום נשלחה לצוות Healson", { variant: "success" });
                    }}
                    className="w-full sm:w-auto"
                  >
                    פרסם והגש לאישור
                  </Button>
                )}
                <p className="text-xs text-slate-500">
                  {progressPercent}% הושלם • {checklistItems.filter((item) => item.done).length} מתוך {checklistItems.length} שלבים
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {nextAction && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-info-border bg-info-bg p-3.5 text-info-text">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{nextAction}</p>
          </div>
        )}

        {provider.go_live_requested_at ? (
          <Card className="mb-5 border-info-border bg-info-bg">
            <CardContent className="flex items-center gap-3 text-info-text">
              <Clock3 className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">
                ביקשת פרסום בתאריך {formatDateHe(provider.go_live_requested_at)} — הבקשה ממתינה לאישור Go-Live סופי
                של צוות Healson. תקבל/י עדכון ברגע שהפרופיל יאושר ויפורסם.
              </p>
            </CardContent>
          </Card>
        ) : provider.onboarding_ready_at ? (
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
            <OnboardingChecklist items={checklistItems} ring />
          </div>
        )}

        {provider.rejection_reason && (
          <Card className="mb-5 border-danger-border bg-danger-bg">
            <CardContent className="text-sm text-danger-text">
              <p className="font-medium mb-0.5">נדרשים תיקונים:</p>
              <p>{provider.rejection_reason}</p>
            </CardContent>
          </Card>
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
