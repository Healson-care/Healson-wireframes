"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ProviderLayout } from "@/components/layouts/ProviderLayout";
import { useStore } from "@/lib/store";
import { useCurrentProvider } from "@/lib/useCurrentPatient";
import { Dialog } from "@/components/ui/Dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProviderStatusBadge, ProviderPublishedBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar, EmptyState, SectionHeading, StatCard } from "@/components/ui/Misc";
import { CardListSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { OnboardingProgress } from "@/components/provider/OnboardingProgress";
import { RegistrationProgress } from "@/components/provider/RegistrationProgress";
import { ProviderApplicationSummary } from "@/components/provider/ProviderApplicationSummary";
import {
  Users,
  Star,
  Clock,
  AlertTriangle,
  ChevronLeft,
  CalendarDays,
  CreditCard,
  Network,
  ShoppingCart,
} from "lucide-react";
import { isCancelledAppointment } from "@/types";
import { formatCurrency, formatDateHe, monthOverMonthTrend, buildMonthlyData } from "@/lib/utils";
import { getProviderSetupConfig, isSetupReadyToPublish, isAvailabilityComplete } from "@/lib/provider-setup";

export default function ProviderDashboardPage() {
  const currentUser = useStore((s) => s.currentUser);
  const provider = useCurrentProvider();
  const upsertProviderProfile = useStore((s) => s.upsertProviderProfile);
  const orders = useStore((s) => s.orders);
  const patients = useStore((s) => s.patients);
  const appointments = useStore((s) => s.appointments);
  const providers = useStore((s) => s.providers);
  const showToast = useStore((s) => s.showToast);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

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

  const setupConfig = getProviderSetupConfig(provider.provider_type);
  const parentOrganization = provider.parent_organization_id
    ? providers.find((p) => p.id === provider.parent_organization_id)
    : undefined;
  const isPendingReview = provider.status === "pending_review";
  const applicationSubmitted = !!provider.application_submitted_at;
  // Brand-new account: RegistrationProgress renders its own welcome hero (which is
  // the greeting), so the operational header would just repeat it.
  const showWelcomeHero = isPendingReview && !provider.provider_type;
  const isOnboarding = provider.status === "onboarding";
  const isApproved = provider.status === "approved";
  const isLive = provider.status === "approved" && provider.is_published;
  const readyToPublish = isSetupReadyToPublish(provider);
  const availabilityDone = isAvailabilityComplete(provider);
  const canTogglePublish = isApproved && readyToPublish;

  const myPatients = patients.filter((p) => p.assigned_provider === provider.id);
  const myOrders = orders.filter((o) => o.provider_id === provider.id);
  const completedOrders = myOrders.filter((o) => o.status === "הושלם");
  const completedRevenue = completedOrders.reduce((sum, o) => sum + o.final_price, 0);

  const myAppointments = appointments.filter((a) => a.provider_id === provider.id);
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingAppointments = myAppointments
    .filter((a) => !isCancelledAppointment(a.status) && a.date >= todayStr)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 5);

  const patientsTrend = monthOverMonthTrend(myPatients, (p) => p.created_date);
  const revenueTrend = monthOverMonthTrend(completedOrders, (o) => o.created_date, (o) => o.final_price);
  const revenueMonthly = buildMonthlyData(completedOrders, (o) => o.created_date, 6, (o) => o.final_price);
  const appointmentsMonthly = buildMonthlyData(myAppointments, (a) => a.date, 6);
  const patientsMonthly = buildMonthlyData(myPatients, (p) => p.created_date, 6);

  // Alerts — things that need attention now.
  const alerts: { id: string; tone: "danger" | "warning" | "info"; label: string; href?: string }[] = [];
  if (isApproved && !provider.is_published) {
    alerts.push({
      id: "unpublished",
      tone: "info",
      label: readyToPublish
        ? "הפרופיל שלך אינו מפורסם — פרסם כדי להופיע בחיפוש ולקבל הזמנות"
        : "הפרופיל שלך אינו מפורסם — השלם קטלוג, מיקומים וזמינות כדי לפרסם",
      href: !readyToPublish ? "/provider/profile" : undefined,
    });
  }
  if (setupConfig.showAvailability && !availabilityDone && isApproved) {
    alerts.push({
      id: "availability",
      tone: "danger",
      label: "לא הוגדרה זמינות שבועית פעילה — מטופלים לא יכולים לקבוע תור חדש",
      href: "/provider/profile/availability",
    });
  }
  if (isApproved && !provider.bank_account?.verified_at) {
    alerts.push({
      id: "bank",
      tone: "warning",
      label: "פרטי חשבון הבנק טרם אומתו — השלמת הפרטים נדרשת לקבלת תשלומים",
      href: "/provider/profile/payments",
    });
  }

  // Recent activity — a merged, most-recent-first feed of orders + appointments.
  const activity = [
    ...myOrders.map((o) => ({
      id: o.id,
      kind: "order" as const,
      sortKey: o.created_date,
      title: `${o.patient_name} · ${o.item_name}`,
      meta: formatCurrency(o.final_price),
    })),
    ...myAppointments.map((a) => ({
      id: a.id,
      kind: "appt" as const,
      sortKey: `${a.date}T${a.time}`,
      title: `${a.client_name} · ${a.service_name}`,
      meta: formatDateHe(a.date),
    })),
  ]
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    .slice(0, 6);

  const upcomingCard = (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-slate-400" /> תורים קרובים
        </CardTitle>
        {upcomingAppointments.length > 0 && (
          <Link href="/provider/appointments" className="text-xs font-medium text-primary hover:underline">
            כל התורים
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {upcomingAppointments.length === 0 ? (
          <EmptyState
            title="אין תורים קרובים"
            description={isLive ? "תורים חדשים יופיעו כאן ברגע שמטופלים יזמינו." : undefined}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {upcomingAppointments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <Avatar name={a.client_name} className="h-9 w-9 text-xs" />
                  <div>
                    <p className="font-medium text-slate-800">{a.client_name}</p>
                    <p className="text-xs text-slate-500">{a.service_name}</p>
                  </div>
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
  );

  return (
    <ProviderLayout>
      {/* Greeting / operational header — identity, status and the primary
          publish action. Profile configuration lives under the פרופיל menu. */}
      <div
        className={`animate-fade-slide-in mb-6 flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/15 bg-gradient-to-l from-primary/[0.06] via-white to-accent-bg/40 p-5 shadow-sm ${
          showWelcomeHero ? "hidden" : "flex"
        }`}
      >
        <div className="flex items-center gap-3">
          <Avatar
            name={provider.display_name || currentUser.full_name}
            src={provider.image_url}
            className="h-14 w-14 text-lg ring-4 ring-white shadow-md"
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                שלום, {provider.title} {provider.display_name || currentUser.full_name}
              </h1>
              {/* A pending_review provider who hasn't sent the application yet
                  is a DRAFT, not something waiting on Healson — the generic
                  "ממתין לבדיקת רישיון" label would be wrong there. */}
              {isPendingReview && !applicationSubmitted ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  בקשה בהכנה
                </span>
              ) : (
                <ProviderStatusBadge
                  status={provider.status}
                  title={provider.status === "rejected" ? provider.rejection_reason : undefined}
                />
              )}
              {provider.is_published && <ProviderPublishedBadge />}
            </div>
            {/* Which organization this unit belongs to — stated, not implied. */}
            {parentOrganization && (
              <p className="mt-1 flex items-center gap-1.5 text-sm">
                <Network className="h-3.5 w-3.5 text-primary" />
                <span className="text-slate-500">יחידה רפואית תחת</span>
                <span className="font-semibold text-slate-900">{parentOrganization.display_name}</span>
              </p>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-3">
              <p className="text-sm text-slate-500">{provider.specialty || "לוח הבקרה שלך"}</p>
              {!!provider.rating && (
                <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {provider.rating.toFixed(1)} ({provider.review_count ?? 0})
                </span>
              )}
            </div>
          </div>
        </div>
        {isApproved && (
          <Button
            variant={isLive ? "outline" : "primary"}
            disabled={!canTogglePublish}
            title={!canTogglePublish ? "יש להשלים קטלוג, מיקומים וזמינות לפני הפרסום" : undefined}
            onClick={() => setPublishDialogOpen(true)}
          >
            {isLive ? "בטל פרסום" : "פרסם פרופיל"}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {/* The two phases (see src/lib/provider-phases.ts). RegistrationProgress
            is phase 1 (רישום) and only ever appears on the solo path; once the
            license is verified — or immediately, for an Ops-created unit —
            OnboardingProgress takes over as phase 2 (הקמה). Both vanish once
            approved and the operational home takes over. */}
        {/* Rejection reason as visible text — previously it lived only in the
            status badge's hover tooltip, invisible on touch devices. */}
        {provider.status === "rejected" && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger-border bg-danger-bg p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <div className="text-sm text-danger-text">
              <p className="font-semibold">הבקשה נדחתה</p>
              <p className="mt-0.5 leading-relaxed">
                {provider.rejection_reason || "לא צוינה סיבה. לפרטים נוספים ניתן לפנות לצוות Healson."}
              </p>
            </div>
          </div>
        )}
        {isPendingReview && (
          <RegistrationProgress provider={provider} displayName={provider.display_name || currentUser.full_name} />
        )}
        {isOnboarding && <OnboardingProgress provider={provider} />}
        {(isOnboarding || (isPendingReview && applicationSubmitted)) && (
          // Same navy/gold token remap as the two phase panels above it, so the
          // whole onboarding journey reads in one brand voice (not teal-next-to-navy).
          <div
            style={
              {
                "--color-primary": "var(--brand-navy)",
                "--color-primary-dark": "var(--brand-navy-900)",
                "--color-accent": "var(--brand-gold)",
              } as CSSProperties
            }
          >
            <ProviderApplicationSummary provider={provider} />
          </div>
        )}

        {/* Alerts & notifications. */}
        {alerts.length > 0 && (
          <div className="flex flex-col gap-2">
            {alerts.map((alert) => {
              const toneClass =
                alert.tone === "danger"
                  ? "border-danger-border bg-danger-bg text-danger-text"
                  : alert.tone === "info"
                  ? "border-info-border bg-info-bg text-info-text"
                  : "border-warning-border bg-warning-bg text-warning-text";
              const content = (
                <div className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm ${toneClass}`}>
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{alert.label}</span>
                  {alert.href && <ChevronLeft className="h-4 w-4 shrink-0" />}
                </div>
              );
              return alert.href ? (
                <Link key={alert.id} href={alert.href} className="transition-opacity hover:opacity-80">
                  {content}
                </Link>
              ) : (
                <div key={alert.id}>{content}</div>
              );
            })}
          </div>
        )}

        {/* Operational content — shown once approved (nothing to operate on
            during onboarding, where the progress meter is the whole screen). */}
        {isApproved && (
          <>
            {/* When live, upcoming appointments are the primary content. */}
            {isLive && upcomingCard}

            {/* KPIs — cards enter with a slight stagger so the dashboard
                builds up instead of popping in as one block. */}
            <section>
              <SectionHeading>מדדים עיקריים</SectionHeading>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    <StatCard
                      key="patients"
                      label="מטופלים"
                      value={myPatients.length}
                      icon={<Users className="h-4 w-4" />}
                      tone="blue"
                      trend={myPatients.length > 0 ? patientsTrend : undefined}
                      sparklineData={patientsMonthly}
                    />,
                    <StatCard
                      key="appointments"
                      label="תורים סה״כ"
                      value={myAppointments.length}
                      icon={<CalendarDays className="h-4 w-4" />}
                      tone="amber"
                      sparklineData={appointmentsMonthly}
                    />,
                    <StatCard
                      key="revenue"
                      label="הכנסות (הושלם)"
                      value={formatCurrency(completedRevenue)}
                      icon={<CreditCard className="h-4 w-4" />}
                      tone="purple"
                      trend={completedOrders.length > 0 ? revenueTrend : undefined}
                      sparklineData={revenueMonthly}
                    />,
                  ] as const
                ).map((card, i) => (
                  <div
                    key={card.key}
                    className="animate-fade-slide-in"
                    style={{ animationDelay: `${80 + i * 70}ms`, animationFillMode: "backwards" }}
                  >
                    {card}
                  </div>
                ))}
              </div>
            </section>

            {/* When not live, appointments are secondary — below the KPIs. */}
            {!isLive && upcomingCard}

            {/* Recent activity. */}
            <section className="animate-fade-slide-in" style={{ animationDelay: "220ms", animationFillMode: "backwards" }}>
              <SectionHeading>פעילות אחרונה</SectionHeading>
              <Card>
                <CardContent className="pt-4">
                  {activity.length === 0 ? (
                    <EmptyState title="אין פעילות עדיין" description="תורים והזמנות חדשים יופיעו כאן." />
                  ) : (
                    <div className="flex flex-col divide-y divide-slate-100">
                      {activity.map((item) => (
                        <div key={`${item.kind}-${item.id}`} className="flex items-center gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                          <span
                            className={
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full " +
                              (item.kind === "order" ? "bg-purple-50 text-purple-600" : "bg-info-bg text-info")
                            }
                          >
                            {item.kind === "order" ? <ShoppingCart className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                          </span>
                          <span className="flex-1 text-slate-700">{item.title}</span>
                          <span className="text-xs font-medium text-slate-500">{item.meta}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </div>

      <Dialog
        open={publishDialogOpen}
        onClose={() => setPublishDialogOpen(false)}
        title={isLive ? "ביטול פרסום הפרופיל" : "פרסום הפרופיל"}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            {isLive
              ? "הפרופיל שלך יוסר מתוצאות החיפוש ולקוחות לא יוכלו לקבוע תורים או להזמין שירותים חדשים. תורים והזמנות קיימים לא יבוטלו. ניתן לפרסם מחדש בכל עת."
              : "הפרופיל שלך יופיע בתוצאות החיפוש, ולקוחות יוכלו לקבוע תורים ולהזמין שירותים לפי הקטלוג והזמינות שהגדרת."}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>
              ביטול
            </Button>
            <Button
              variant={isLive ? "destructive" : "primary"}
              onClick={() => {
                upsertProviderProfile(currentUser!.id, { is_published: !provider.is_published });
                showToast(provider.is_published ? "הפרופיל הוסר מהפרסום" : "הפרופיל פורסם בהצלחה", {
                  variant: "success",
                });
                setPublishDialogOpen(false);
              }}
            >
              {isLive ? "בטל פרסום" : "פרסם פרופיל"}
            </Button>
          </div>
        </div>
      </Dialog>
    </ProviderLayout>
  );
}

