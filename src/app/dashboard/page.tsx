"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, StatCard } from "@/components/ui/Misc";
import { StatusBadge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BarChartSimple, LineChartSimple, PieChartSimple } from "@/components/charts/SimpleCharts";
import { buildMonthlyData, formatCurrency, monthOverMonthTrend } from "@/lib/utils";
import {
  Users,
  CalendarDays,
  CreditCard,
  FlaskConical,
  Activity,
  Building2,
  TrendingUp,
  ArrowLeftRight,
  AlertCircle,
  ChevronLeft,
  ShoppingCart,
  UserCheck,
  Rocket,
  History,
} from "lucide-react";

// The same statuses/tones StatusBadge already uses for AppointmentStatus
// (Badge.tsx's APPOINTMENT_TONE) — mirrored here as hex so the status donut on
// this page reads the exact same color for the exact same status as every
// StatusBadge elsewhere, instead of an arbitrary categorical palette that has
// no relation to meaning.
const APPOINTMENT_STATUS_COLOR: Record<string, string> = {
  "ממתין לאישור הפניה": "#4f46e5", // indigo
  "ממתין להתחייבות": "#d97706", // warning
  "ממתין לתשלום מקדמה": "#d97706", // warning
  "מאושר": "#2563eb", // info
  "ממתין לתשלום יתרה": "#ea580c", // orange
  "שולם במלואו": "#9333ea", // purple
  "בוצע": "#059669", // success
  "בוטל": "#dc2626", // danger
  "בוטל — יתרה לא שולמה": "#dc2626", // danger
};

interface ActivityEvent {
  id: string;
  date: string;
  label: string;
  href: string;
  icon: ReactNode;
}

export default function AdminDashboardHome() {
  const currentUser = useStore((s) => s.currentUser);
  const patients = useStore((s) => s.patients);
  const appointments = useStore((s) => s.appointments);
  const orders = useStore((s) => s.orders);
  const providers = useStore((s) => s.providers);
  const branches = useStore((s) => s.branches);
  const labReferrals = useStore((s) => s.labReferrals);
  const leads = useStore((s) => s.leads);

  const activePatients = patients.filter((p) => p.status === "פעיל").length;
  const pendingAppts = appointments.filter((a) => a.status === "ממתין לתשלום מקדמה").length;
  const completedOrders = orders.filter((o) => o.status === "הושלם");
  const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.final_price || 0), 0);
  const pendingReferrals = labReferrals.filter((r) => r.status === "ממתין לעיבוד").length;
  const convertedLeads = leads.filter((l) => l.status === "הומר").length;
  const conversionRate = leads.length > 0 ? Math.round((convertedLeads / leads.length) * 100) : 0;

  const newLeads = leads.filter((l) => (l.status || "חדש") === "חדש").length;
  const providersPendingReview = providers.filter((p) => p.status === "pending_review").length;
  const goLiveRequests = providers.filter((p) => p.status === "onboarding" && p.go_live_requested_at).length;
  const pendingOrders = orders.filter((o) => o.status === "ממתין").length;

  const actionQueue: { label: string; count: number; href: string; icon: ReactNode }[] = [
    { label: "לידים חדשים ללא מעקב", count: newLeads, href: "/crm?tab=leads", icon: <ArrowLeftRight className="h-4 w-4" /> },
    { label: "תורים ממתינים לאישור", count: pendingAppts, href: "/appointments", icon: <CalendarDays className="h-4 w-4" /> },
    { label: "ספקים ממתינים לבדיקה", count: providersPendingReview, href: "/providers", icon: <UserCheck className="h-4 w-4" /> },
    { label: "בקשות Go-Live ממתינות", count: goLiveRequests, href: "/providers", icon: <Rocket className="h-4 w-4" /> },
    { label: "הזמנות ממתינות", count: pendingOrders, href: "/orders?status=ממתין", icon: <ShoppingCart className="h-4 w-4" /> },
    { label: "הפניות מעבדה ממתינות", count: pendingReferrals, href: "/crm", icon: <FlaskConical className="h-4 w-4" /> },
  ].filter((item) => item.count > 0);

  const appointmentStatusBreakdown = Object.entries(
    appointments.reduce<Record<string, number>>((acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([label, count]) => ({ label, count }));
  const appointmentStatusColors = appointmentStatusBreakdown.map((d) => APPOINTMENT_STATUS_COLOR[d.label] ?? "#64748b");

  const patientMonthly = buildMonthlyData(patients, (p) => p.created_date);
  const apptMonthly = buildMonthlyData(appointments, (a) => a.date);
  const completedOrdersMonthly = buildMonthlyData(completedOrders, (o) => o.created_date);
  const revenueMonthly = buildMonthlyData(completedOrders, (o) => o.created_date, 6, (o) => o.final_price);

  const patientTrend = monthOverMonthTrend(patients, (p) => p.created_date);
  const apptTrend = monthOverMonthTrend(appointments, (a) => a.date);
  const revenueTrend = monthOverMonthTrend(
    orders.filter((o) => o.status === "הושלם"),
    (o) => o.created_date,
    (o) => o.final_price
  );

  const recentAppointments = [...appointments]
    .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1))
    .slice(0, 6);
  const recentPatients = [...patients]
    .sort((a, b) => (a.created_date < b.created_date ? 1 : -1))
    .slice(0, 6);

  // Purely derived from data that already exists in the store (orders, providers,
  // leads) — no new persisted field. Provider events pick whichever lifecycle
  // timestamp on the profile is most recent, so the label always matches what
  // actually last happened to that provider.
  const orderEvents: ActivityEvent[] = orders
    .filter((o) => !!o.created_date)
    .map((o) => ({
      id: `order-${o.id}`,
      date: o.created_date,
      label: `הזמנה חדשה — ${o.item_name} עבור ${o.patient_name} (${o.status})`,
      href: "/orders",
      icon: <ShoppingCart className="h-3.5 w-3.5" />,
    }));

  const leadEvents: ActivityEvent[] = leads
    .filter((l) => !!l.created_date)
    .map((l) => ({
      id: `lead-${l.id}`,
      date: l.created_date,
      label: `ליד חדש — ${l.full_name} (${l.source})`,
      href: "/crm?tab=leads",
      icon: <ArrowLeftRight className="h-3.5 w-3.5" />,
    }));

  const providerEvents: ActivityEvent[] = providers.flatMap((p) => {
    const candidates = [
      { date: p.go_live_requested_at, label: `${p.display_name} ביקש/ה אישור Go-Live` },
      { date: p.agreement_signed_at, label: `${p.display_name} חתם/ה על ההסכם עם Healson` },
      { date: p.license_verified_at, label: `רישיון אומת — ${p.display_name}` },
      { date: p.application_submitted_at, label: `בקשת הצטרפות חדשה — ${p.display_name}` },
    ].filter((c): c is { date: string; label: string } => !!c.date);
    if (candidates.length === 0) return [];
    const latest = candidates.reduce((a, b) => (a.date > b.date ? a : b));
    return [{ id: `provider-${p.id}`, date: latest.date, label: latest.label, href: "/providers", icon: <UserCheck className="h-3.5 w-3.5" /> }];
  });

  const activityFeed = [...orderEvents, ...leadEvents, ...providerEvents]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8);

  const greetingName = currentUser?.full_name?.split(" ")[0];
  const todayLabel = new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });

  return (
    <AppLayout>
      <div className="mb-1">
        <p className="text-lg font-bold text-slate-900">
          {greetingName ? `בוקר טוב, ${greetingName} 👋` : "בוקר טוב 👋"}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {todayLabel}
          {actionQueue.length > 0 && ` · ${actionQueue.reduce((s, i) => s + i.count, 0)} פעולות ממתינות לתשומת לבך`}
        </p>
      </div>

      <PageHeader
        title="לוח בקרה"
        description="סקירה כללית של המערכת"
        actions={
          <>
            <Link href="/crm">
              <Button variant="outline" size="sm">CRM ומטופלים</Button>
            </Link>
            <Link href="/admin">
              <Button variant="outline" size="sm">ניהול</Button>
            </Link>
          </>
        }
      />

      {actionQueue.length > 0 && (
        <Card className="mb-6 border-warning-border bg-warning-bg/40">
          <CardHeader className="flex items-center gap-2 flex-row">
            <AlertCircle className="h-4 w-4 text-warning" />
            <CardTitle>פעולות נדרשות</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {actionQueue.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 rounded-xl border border-warning-border bg-white px-3.5 py-3 text-sm shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-bg text-warning-text">
                  {item.icon}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs text-slate-500 truncate">{item.label}</span>
                  <span className="block text-lg font-bold text-slate-900 tabular-nums">{item.count}</span>
                </span>
                <ChevronLeft className="h-4 w-4 text-slate-300 shrink-0" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="פריטים שמומשו"
          value={completedOrders.length}
          subtitle="North Star Metric — §1.2"
          icon={<TrendingUp className="h-4 w-4" />}
          tone="success"
          sparklineData={completedOrdersMonthly}
        />
        <StatCard
          label="המרת ליד ללקוח"
          value={`${conversionRate}%`}
          subtitle={`${convertedLeads} מתוך ${leads.length} לידים`}
          icon={<ArrowLeftRight className="h-4 w-4" />}
          tone="indigo"
        />
        <StatCard
          label="מטופלים פעילים"
          value={activePatients}
          subtitle={`מתוך ${patients.length} סה״כ`}
          icon={<Users className="h-4 w-4" />}
          tone="blue"
          trend={patientTrend}
          sparklineData={patientMonthly}
        />
        <StatCard
          label="תורים ממתינים"
          value={pendingAppts}
          subtitle={`${appointments.length} תורים סה״כ`}
          icon={<CalendarDays className="h-4 w-4" />}
          tone="amber"
          trend={apptTrend}
          sparklineData={apptMonthly}
        />
        <StatCard
          label="הכנסות (₪)"
          value={formatCurrency(totalRevenue)}
          subtitle={`${orders.length} הזמנות סה״כ`}
          icon={<CreditCard className="h-4 w-4" />}
          tone="green"
          trend={revenueTrend}
          sparklineData={revenueMonthly}
        />
        <StatCard
          label="הפניות ממתינות"
          value={pendingReferrals}
          subtitle={`${labReferrals.length} סה״כ`}
          icon={<FlaskConical className="h-4 w-4" />}
          tone="purple"
        />
        <StatCard
          label="ספקים"
          value={providers.length}
          subtitle="רשומים במערכת"
          icon={<Activity className="h-4 w-4" />}
          tone="indigo"
        />
        <StatCard
          label="סניפים"
          value={branches.length}
          subtitle="פעילים"
          icon={<Building2 className="h-4 w-4" />}
          tone="rose"
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>מטופלים חדשים לפי חודש</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartSimple data={patientMonthly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>תורים לפי חודש</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChartSimple data={apptMonthly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>התפלגות סטטוס תורים</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChartSimple data={appointmentStatusBreakdown} colors={appointmentStatusColors} />
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-1">
          <CardHeader className="flex items-center gap-2 flex-row">
            <History className="h-4 w-4 text-slate-400" />
            <CardTitle>פעילות אחרונה במערכת</CardTitle>
          </CardHeader>
          <CardContent>
            {activityFeed.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">אין פעילות להצגה עדיין</p>
            ) : (
              <div className="relative pr-4">
                <div className="absolute right-[5px] top-1 bottom-1 w-px bg-slate-200" />
                <div className="flex flex-col gap-4">
                  {activityFeed.map((event) => (
                    <Link key={event.id} href={event.href} className="relative flex items-start gap-2.5 group">
                      <span className="absolute right-[-16px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary ring-1 ring-primary/30" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs text-slate-400 font-mono tabular-nums">
                          {new Date(event.date).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })}
                        </span>
                        <span className="block text-sm text-slate-700 group-hover:text-primary transition-colors leading-snug">
                          {event.label}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex items-center justify-between flex-row">
              <CardTitle>תורים אחרונים</CardTitle>
              <Link href="/appointments" className="text-xs text-primary hover:underline">הכל</Link>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {recentAppointments.map((a) => (
                <Link
                  key={a.id}
                  href={`/appointments?appointment=${a.id}&date=${a.date}`}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm transition-colors hover:bg-slate-100"
                >
                  <div>
                    <p className="font-medium text-slate-800">{a.client_name}</p>
                    <p className="text-xs text-slate-500">{a.provider_name} · {a.date}</p>
                  </div>
                  <StatusBadge status={a.status} kind="appointment" />
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex items-center justify-between flex-row">
              <CardTitle>מטופלים אחרונים</CardTitle>
              <Link href="/crm" className="text-xs text-primary hover:underline">הכל</Link>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {recentPatients.map((p) => (
                <Link
                  key={p.id}
                  href={`/crm/${p.id}`}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm transition-colors hover:bg-slate-100"
                >
                  <div>
                    <p className="font-medium text-slate-800">{p.full_name}</p>
                    <p className="text-xs text-slate-500">{p.kupah ?? "תייר"}</p>
                  </div>
                  <StatusBadge status={p.status} kind="patient" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
