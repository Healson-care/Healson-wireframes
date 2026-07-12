"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Handshake, Stethoscope, FileSignature, CheckCircle2, Rocket, Clock3, LogOut, Lock } from "lucide-react";
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
import { AgreementSignSection } from "@/components/provider/AgreementSignSection";
import { ProviderJourneyStepper } from "@/components/provider/ProviderJourneyStepper";
import { formatDateHe } from "@/lib/utils";
import { getProviderSetupConfig } from "@/lib/provider-setup";

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

  if (!ready || !user || !provider || alreadyLive) {
    return <DashboardSkeleton />;
  }

  const setupConfig = getProviderSetupConfig(provider.provider_type);
  const step1Done = !!provider.agreement_signed_at;
  const step2Done = provider.agreements.length > 0;
  const step3Done = provider.consultation_types.length > 0 || provider.exam_types.length > 0;
  const doneCount = [step1Done, step2Done, step3Done].filter(Boolean).length;

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
          description="הרישיון שלך אומת. השלימו את שלושת השלבים הבאים כדי להשלים את ההצטרפות."
        />

        <ProviderJourneyStepper provider={provider} className="mb-5" />

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
                <p className="text-sm font-medium">כל שלושת השלבים הושלמו! השלב האחרון הוא לשלוח בקשה לפרסום.</p>
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
          <p className="mb-5 text-sm text-slate-500">{doneCount} מתוך 3 שלבים הושלמו</p>
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
          <TabsList className="mb-4">
            <TabsTrigger value="sign" icon={<FileSignature className="h-3.5 w-3.5" />}>
              {step1Done && <CheckCircle2 className="h-3 w-3 text-emerald-500" />} חתימת הסכם
            </TabsTrigger>
            <TabsTrigger value="agreements" icon={step1Done ? <Handshake className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}>
              {step2Done && <CheckCircle2 className="h-3 w-3 text-emerald-500" />} הסדרי ביטוח
            </TabsTrigger>
            <TabsTrigger value="catalog" icon={step1Done ? <Stethoscope className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}>
              {step3Done && <CheckCircle2 className="h-3 w-3 text-emerald-500" />} קטלוג שירותים
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sign">
            <AgreementSignSection
              signedAt={provider.agreement_signed_at}
              onSign={() => {
                signProviderAgreement(provider.id);
                showToast("ההסכם נחתם בהצלחה — כעת ניתן להזין הסדרי ביטוח וקטלוג שירותים", { variant: "success" });
                setActiveTab("agreements");
              }}
            />
          </TabsContent>

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
                />
              )}
            </div>
            {setupConfig.showExamsCatalog && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">בדיקות</h3>
                <PriceListSection
                  items={provider.exam_types as unknown as PriceListEntry[]}
                  onChange={(items) =>
                    upsertProviderProfile(user.id, { exam_types: items as unknown as typeof provider.exam_types })
                  }
                  extraFieldKey="lab_code"
                  extraFieldLabel="קוד מעבדה"
                  extraFieldType="text"
                  itemLabel="בדיקה"
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
