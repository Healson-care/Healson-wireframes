"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ProviderLayout } from "@/components/layouts/ProviderLayout";
import { useStore } from "@/lib/store";
import { useCurrentProvider } from "@/lib/useCurrentPatient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar, EmptyState, OpenDecisionNote, PageHeader, StatCard } from "@/components/ui/Misc";
import { CardListSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { PriceListEntry, PriceListSection } from "@/components/provider/PriceListSection";
import { ServiceCatalogSection } from "@/components/provider/ServiceCatalogSection";
import { ClinicsSection } from "@/components/provider/ClinicsSection";
import { AvailabilitySection } from "@/components/provider/AvailabilitySection";
import { ReferralFormsSection } from "@/components/provider/ReferralFormsSection";
import { AgreementsSection } from "@/components/provider/AgreementsSection";
import { BlockedDatesSection } from "@/components/provider/BlockedDatesSection";
import { MonthlyReportSection } from "@/components/provider/MonthlyReportSection";
import { BarChartSimple, LineChartSimple } from "@/components/charts/SimpleCharts";
import {
  LayoutDashboard,
  Stethoscope,
  MapPin,
  FileText,
  CalendarDays,
  CreditCard,
  Users,
  CheckCircle2,
  BadgeCheck,
  Handshake,
  Star,
  FileBarChart,
  Clock,
} from "lucide-react";
import { formatCurrency, formatDateHe, monthOverMonthTrend, buildMonthlyData } from "@/lib/utils";
import { PROVIDER_STATUS_LABELS } from "@/types";
import {
  getNextProviderAction,
  getProviderSetupConfig,
  isSetupReadyToPublish,
  isCatalogComplete,
  isLocationsComplete,
  isAvailabilityComplete,
} from "@/lib/provider-setup";

export default function ProviderDashboardPage() {
  const currentUser = useStore((s) => s.currentUser);
  const provider = useCurrentProvider();
  const upsertProviderProfile = useStore((s) => s.upsertProviderProfile);
  const orders = useStore((s) => s.orders);
  const patients = useStore((s) => s.patients);
  const appointments = useStore((s) => s.appointments);
  const showToast = useStore((s) => s.showToast);

  // Create an empty profile automatically the first time a provider logs in.
  useEffect(() => {
    if (currentUser && currentUser.role === "provider" && !provider) {
      upsertProviderProfile(currentUser.id, {
        display_name: currentUser.full_name,
        specialty: "",
      });
    }
  }, [currentUser, provider, upsertProviderProfile]);

  if (!provider || !currentUser) {
    return (
      <ProviderLayout>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <CardListSkeleton count={3} />
        </div>
      </ProviderLayout>
    );
  }

  const isVerified = provider.status === "approved";
  const myPatients = patients.filter((p) => p.assigned_provider === provider.id);
  const myOrders = orders.filter((o) => o.provider_id === provider.id);
  const completedOrders = myOrders.filter((o) => o.status === "הושלם");
  const completedRevenue = completedOrders.reduce((sum, o) => sum + o.final_price, 0);
  const commissionPaid = completedOrders.reduce((sum, o) => sum + (o.commission_amount ?? 0), 0);
  const netPayout = completedOrders.reduce((sum, o) => sum + (o.provider_payout_amount ?? o.final_price), 0);

  const myAppointments = appointments.filter((a) => a.provider_id === provider.id);
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingAppointments = myAppointments
    .filter((a) => a.status !== "בוטל" && a.date >= todayStr)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 5);

  const patientsTrend = monthOverMonthTrend(myPatients, (p) => p.created_date);
  const revenueTrend = monthOverMonthTrend(completedOrders, (o) => o.created_date, (o) => o.final_price);
  const revenueMonthly = buildMonthlyData(completedOrders, (o) => o.created_date, 6, (o) => o.final_price);
  const appointmentsMonthly = buildMonthlyData(myAppointments, (a) => a.date, 6);

  const setupConfig = getProviderSetupConfig(provider.provider_type);
  const catalogDone = isCatalogComplete(provider);
  const locationsDone = isLocationsComplete(provider);
  const availabilityDone = isAvailabilityComplete(provider);
  const readyToPublish = isSetupReadyToPublish(provider);
  const nextAction = getNextProviderAction(provider);
  const isLive = provider.status === "approved" && provider.is_published;
  const canTogglePublish = provider.status === "approved" && readyToPublish;

  return (
    <ProviderLayout>
      <PageHeader
        title="לוח הבקרה שלי"
        description="ניהול הפרופיל המקצועי, שירותים ופעילות שוטפת"
        actions={
          provider.status === "approved" ? (
            <Button
              variant={isLive ? "outline" : "primary"}
              disabled={!canTogglePublish}
              title={!canTogglePublish ? "יש להשלים קטלוג, מיקומים וזמינות לפני הפרסום" : undefined}
              onClick={() => {
                upsertProviderProfile(currentUser!.id, { is_published: !provider.is_published });
                showToast(provider.is_published ? "הפרופיל הוסר מהפרסום" : "הפרופיל פורסם בהצלחה", {
                  variant: "success",
                });
              }}
            >
              {isLive ? "בטל פרסום" : "פרסם פרופיל"}
            </Button>
          ) : undefined
        }
      />

      <div className="relative mb-6 overflow-hidden rounded-2xl border border-neutral-border bg-gradient-to-l from-white via-white to-accent-bg/40 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar
            name={provider.display_name || currentUser.full_name}
            src={provider.image_url}
            className="h-16 w-16 text-xl ring-4 ring-white shadow-md"
          />
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900">
                {provider.title} {provider.display_name}
              </h2>
              {provider.status === "approved" ? (
                <Badge tone="green">
                  <BadgeCheck className="h-3 w-3" /> מאושר
                </Badge>
              ) : provider.status === "rejected" ? (
                <Badge tone="red">נדחה{provider.rejection_reason ? `: ${provider.rejection_reason}` : ""}</Badge>
              ) : provider.status === "suspended" ? (
                <Badge tone="slate">מושהה</Badge>
              ) : (
                <Badge tone="amber">{PROVIDER_STATUS_LABELS[provider.status]}</Badge>
              )}
              {provider.is_published && <Badge tone="blue">פעיל</Badge>}
            </div>
            <p className="text-sm text-amber-700 font-medium mt-0.5">{provider.specialty || "—"}</p>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {provider.license_number && (
                <p className="text-xs text-slate-400 font-mono">{provider.license_number}</p>
              )}
              {!!provider.rating && (
                <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {provider.rating.toFixed(1)} ({provider.review_count ?? 0} ביקורות)
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-white/70 px-3 py-2 shadow-sm">
              <p className="text-lg font-bold text-slate-900">{provider.consultation_types.length}</p>
              <p className="text-xs text-slate-500">{setupConfig.catalogLabel}</p>
            </div>
            <div className="rounded-xl bg-white/70 px-3 py-2 shadow-sm">
              <p className="text-lg font-bold text-slate-900">{provider.clinic_locations.length}</p>
              <p className="text-xs text-slate-500">{setupConfig.locationLabelPlural}</p>
            </div>
          </div>
        </div>
      </div>

      {nextAction && (
        <div className="mb-6 rounded-lg border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning-text">
          {nextAction}
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="overview" icon={<LayoutDashboard className="h-3.5 w-3.5" />}>סקירה</TabsTrigger>
          {setupConfig.showAgreements && (
            <TabsTrigger value="agreements" icon={<Handshake className="h-3.5 w-3.5" />}>הסדרים</TabsTrigger>
          )}
          <TabsTrigger value="consultations" icon={<Stethoscope className="h-3.5 w-3.5" />}>{setupConfig.catalogLabel}</TabsTrigger>
          <TabsTrigger value="clinics" icon={<MapPin className="h-3.5 w-3.5" />}>{setupConfig.locationLabelPlural}</TabsTrigger>
          <TabsTrigger value="forms" icon={<FileText className="h-3.5 w-3.5" />}>תבניות הפניה</TabsTrigger>
          {setupConfig.showAvailability && (
            <TabsTrigger value="schedule" icon={<CalendarDays className="h-3.5 w-3.5" />}>זמינות</TabsTrigger>
          )}
          <TabsTrigger value="payments" icon={<CreditCard className="h-3.5 w-3.5" />}>תשלומים</TabsTrigger>
          <TabsTrigger value="reports" icon={<FileBarChart className="h-3.5 w-3.5" />}>דוחות</TabsTrigger>
          <TabsTrigger value="crm" icon={<Users className="h-3.5 w-3.5" />}>CRM</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            <StatCard
              label="מטופלים"
              value={myPatients.length}
              icon={<Users className="h-4 w-4" />}
              tone="blue"
              trend={myPatients.length > 0 ? patientsTrend : undefined}
            />
            <StatCard
              label="סטטוס אישור Healson"
              value={PROVIDER_STATUS_LABELS[provider.status]}
              icon={<CheckCircle2 className="h-4 w-4" />}
              tone={isVerified ? "green" : provider.status === "rejected" ? "rose" : "amber"}
            />
            <StatCard
              label="הכנסות (הושלם)"
              value={formatCurrency(completedRevenue)}
              icon={<CreditCard className="h-4 w-4" />}
              tone="purple"
              trend={completedOrders.length > 0 ? revenueTrend : undefined}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <Card>
              <CardHeader>
                <CardTitle>מגמת הכנסות</CardTitle>
                <p className="text-xs text-slate-500">6 חודשים אחרונים</p>
              </CardHeader>
              <CardContent>
                <LineChartSimple data={revenueMonthly} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>תורים לפי חודש</CardTitle>
                <p className="text-xs text-slate-500">6 חודשים אחרונים</p>
              </CardHeader>
              <CardContent>
                <BarChartSimple data={appointmentsMonthly} color="#c8973a" />
              </CardContent>
            </Card>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-slate-400" /> תורים קרובים
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingAppointments.length === 0 ? (
                  <EmptyState title="אין תורים קרובים" />
                ) : (
                  <div className="flex flex-col gap-2">
                    {upcomingAppointments.map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium text-slate-800">{a.client_name}</p>
                          <p className="text-xs text-slate-500">{a.service_name}</p>
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-slate-800">{formatDateHe(a.date)}</p>
                          <p className="text-xs text-slate-500">{a.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>השלמת הפרופיל</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 flex flex-col gap-2">
                <ChecklistItem ok={!!provider.license_number} label="מספר רישיון" />
                <ChecklistItem ok={!!provider.specialty} label="תחום התמחות" />
                {setupConfig.showAgreements && (
                  <ChecklistItem ok={provider.agreements.length > 0} label="הגדרת הסדרי ביטוח (S/K/B/H)" />
                )}
                <ChecklistItem ok={catalogDone} label={`לפחות פריט אחד ב${setupConfig.catalogLabel}`} />
                {setupConfig.locationTypes.length > 0 && (
                  <ChecklistItem ok={locationsDone} label={`לפחות ${setupConfig.locationLabelSingular} אחד/ת`} />
                )}
                {setupConfig.showAvailability && (
                  <ChecklistItem ok={availabilityDone} label="זמינות שבועית הוגדרה" />
                )}
                <ChecklistItem ok={isVerified} label="אושר על ידי צוות Healson" />
                <ChecklistItem ok={provider.is_published} label="פרופיל פורסם" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {setupConfig.showAgreements && (
          <TabsContent value="agreements">
            <AgreementsSection
              providerId={provider.id}
              agreements={provider.agreements}
              onChange={(agreements) => upsertProviderProfile(currentUser!.id, { agreements })}
              kupahArrangements={provider.kupah_arrangements ?? []}
              onKupahArrangementsChange={(kupah_arrangements) =>
                upsertProviderProfile(currentUser!.id, { kupah_arrangements })
              }
              privateInsuranceCompanies={provider.private_insurance_companies ?? []}
              onPrivateInsuranceCompaniesChange={(private_insurance_companies) =>
                upsertProviderProfile(currentUser!.id, { private_insurance_companies })
              }
            />
          </TabsContent>
        )}

        <TabsContent value="consultations">
          <OpenDecisionNote>
            <b>טרם הוחלט:</b> מדיניות תמחור סופית עדיין לא נקבעה ע&quot;י הנהלת Healson — כרגע אתם קובעים בעצמכם את
            המחיר לכל שכבת ביטוח (S/K/B/H).
          </OpenDecisionNote>
          {setupConfig.useSkillTreeCatalog ? (
            <ServiceCatalogSection
              items={provider.consultation_types}
              onChange={(items) => upsertProviderProfile(currentUser!.id, { consultation_types: items })}
              providerId={provider.id}
              itemLabel={setupConfig.catalogItemLabel}
              clinics={provider.clinic_locations}
              providerSpecialty={provider.specialty}
            />
          ) : (
            <PriceListSection
              items={provider.consultation_types as unknown as PriceListEntry[]}
              onChange={(items) => upsertProviderProfile(currentUser!.id, { consultation_types: items as unknown as typeof provider.consultation_types })}
              extraFieldKey={setupConfig.catalogExtraFieldKey}
              extraFieldLabel={setupConfig.catalogExtraFieldLabel}
              extraFieldType={setupConfig.catalogExtraFieldType}
              itemLabel={setupConfig.catalogItemLabel}
              clinics={provider.clinic_locations}
            />
          )}
        </TabsContent>

        <TabsContent value="clinics">
          <ClinicsSection
            clinics={provider.clinic_locations}
            onChange={(clinics) => upsertProviderProfile(currentUser!.id, { clinic_locations: clinics })}
            allowedLocationTypes={setupConfig.locationTypes}
            locationLabelSingular={setupConfig.locationLabelSingular}
            locationLabelPlural={setupConfig.locationLabelPlural}
          />
        </TabsContent>

        <TabsContent value="forms">
          <ReferralFormsSection
            forms={provider.referral_forms}
            onChange={(forms) => upsertProviderProfile(currentUser!.id, { referral_forms: forms })}
          />
        </TabsContent>

        {setupConfig.showAvailability && (
        <TabsContent value="schedule">
          <AvailabilitySection
            clinics={provider.clinic_locations}
            onChange={(clinics) => upsertProviderProfile(currentUser!.id, { clinic_locations: clinics })}
            locationLabelSingular={setupConfig.locationLabelSingular}
            locationLabelPlural={setupConfig.locationLabelPlural}
          />

          <div className="mt-4">
            <BlockedDatesSection
              blockedDates={provider.blocked_dates ?? []}
              onChange={(blocked_dates) => upsertProviderProfile(currentUser!.id, { blocked_dates })}
            />
          </div>
        </TabsContent>
        )}

        <TabsContent value="payments">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard label="הכנסה ברוטו" value={formatCurrency(completedRevenue)} tone="green" />
            <StatCard label="עמלת Healson" value={formatCurrency(commissionPaid)} tone="rose" />
            <StatCard label="תשלום נטו לספק" value={formatCurrency(netPayout)} tone="purple" />
            <StatCard label="עסקאות שהושלמו" value={completedOrders.length} tone="blue" />
          </div>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>הכנסה חודשית</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChartSimple data={revenueMonthly} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>עסקאות אחרונות</CardTitle>
              <p className="text-sm text-slate-500">
                עמלת Healson הנוכחית: {provider.commission_rate ?? 15}% לעסקה
              </p>
            </CardHeader>
            <CardContent>
              {myOrders.length === 0 ? (
                <EmptyState title="אין עסקאות עדיין" />
              ) : (
                <div className="flex flex-col gap-2">
                  {myOrders.slice(0, 10).map((o) => (
                    <div key={o.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="text-slate-700">{o.patient_name} · {o.item_name}</span>
                      <div className="text-left">
                        <span className="font-medium text-slate-900">{formatCurrency(o.final_price)}</span>
                        {o.commission_amount !== undefined && (
                          <p className="text-xs text-slate-400">עמלה {formatCurrency(o.commission_amount)} · נטו {formatCurrency(o.provider_payout_amount ?? 0)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <MonthlyReportSection orders={myOrders} providerName={provider.display_name} />
        </TabsContent>

        <TabsContent value="crm">
          {myPatients.length === 0 ? (
            <EmptyState icon={<Users className="h-10 w-10" />} title="אין מטופלים משויכים" />
          ) : (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2 rtl:space-x-reverse">
                    {myPatients.slice(0, 5).map((p) => (
                      <Avatar key={p.id} name={p.full_name} className="ring-2 ring-white" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">{myPatients.length}</span> מטופלים משויכים אליך
                  </p>
                </div>
                <Link href="/provider/patients">
                  <Button variant="outline" size="sm">
                    לרשימת המטופלים המלאה
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </ProviderLayout>
  );
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 className={`h-4 w-4 ${ok ? "text-emerald-500" : "text-slate-300"}`} />
      <span className={ok ? "text-slate-700" : "text-slate-400"}>{label}</span>
    </div>
  );
}
