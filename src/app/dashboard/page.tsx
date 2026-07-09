"use client";

import Link from "next/link";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, StatCard } from "@/components/ui/Misc";
import { StatusBadge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BarChartSimple, LineChartSimple } from "@/components/charts/SimpleCharts";
import { buildMonthlyData, formatCurrency, monthOverMonthTrend } from "@/lib/utils";
import { Users, CalendarDays, CreditCard, FlaskConical, Activity, Building2, TrendingUp, ArrowLeftRight } from "lucide-react";

export default function AdminDashboardHome() {
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

  const patientMonthly = buildMonthlyData(patients, (p) => p.created_date);
  const apptMonthly = buildMonthlyData(appointments, (a) => a.date);

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

  return (
    <AppLayout>
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="שירותים שיצאו לפועל"
          value={completedOrders.length}
          subtitle="North Star Metric — §1.2"
          icon={<TrendingUp className="h-4 w-4" />}
          tone="success"
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
        />
        <StatCard
          label="תורים ממתינים"
          value={pendingAppts}
          subtitle={`${appointments.length} תורים סה״כ`}
          icon={<CalendarDays className="h-4 w-4" />}
          tone="amber"
          trend={apptTrend}
        />
        <StatCard
          label="הכנסות (₪)"
          value={formatCurrency(totalRevenue)}
          subtitle={`${orders.length} הזמנות סה״כ`}
          icon={<CreditCard className="h-4 w-4" />}
          tone="green"
          trend={revenueTrend}
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

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
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
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex items-center justify-between flex-row">
            <CardTitle>תורים אחרונים</CardTitle>
            <Link href="/appointments" className="text-xs text-primary hover:underline">הכל</Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recentAppointments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{a.client_name}</p>
                  <p className="text-xs text-slate-500">{a.provider_name} · {a.date}</p>
                </div>
                <StatusBadge status={a.status} kind="appointment" />
              </div>
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
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{p.full_name}</p>
                  <p className="text-xs text-slate-500">{p.kupah}</p>
                </div>
                <StatusBadge status={p.status} kind="patient" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
