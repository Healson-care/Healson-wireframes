"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/Misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { isoDate } from "@/lib/calendar";
import { formatDateHe } from "@/lib/utils";
import { DSR_REQUEST_TYPE_LABELS, DsrRequestStatus } from "@/types";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CalendarDays,
  Check,
  CreditCard,
  FileText,
  FolderOpen,
  ShieldAlert,
} from "lucide-react";

const DSR_SLA_DAYS = 30;
const DSR_WARNING_DAYS = 23; // flag ~1 week before SLA breach
const OPEN_DSR_STATUSES: DsrRequestStatus[] = ["ממתין", "בטיפול"];

export default function TodayPage() {
  const router = useRouter();
  const appointments = useStore((s) => s.appointments);
  const patients = useStore((s) => s.patients);
  const documents = useStore((s) => s.documents);
  const dsrRequests = useStore((s) => s.dsrRequests);
  const updateAppointment = useStore((s) => s.updateAppointment);
  const addDocument = useStore((s) => s.addDocument);
  const showToast = useStore((s) => s.showToast);

  const todayIso = isoDate(new Date());

  const todayAppointments = useMemo(
    () => appointments.filter((a) => a.date === todayIso).sort((a, b) => a.time.localeCompare(b.time)),
    [appointments, todayIso]
  );

  const pendingDepositToday = useMemo(
    () => todayAppointments.filter((a) => a.status === "ממתין לתשלום מקדמה"),
    [todayAppointments]
  );

  const overdueBalance = useMemo(
    () => appointments.filter((a) => a.status === "מאושר" && a.date <= todayIso),
    [appointments, todayIso]
  );

  const pendingDocuments = useMemo(() => documents.filter((d) => d.status === "ממתין למילוי"), [documents]);

  const dsrNearSla = useMemo(() => {
    const now = new Date().getTime();
    return dsrRequests
      .filter((r) => OPEN_DSR_STATUSES.includes(r.status))
      .map((r) => ({ ...r, daysOpen: (now - new Date(r.requested_at).getTime()) / (1000 * 60 * 60 * 24) }))
      .filter((r) => r.daysOpen >= DSR_WARNING_DAYS)
      .sort((a, b) => b.daysOpen - a.daysOpen);
  }, [dsrRequests]);

  const actionItemsCount = pendingDepositToday.length + overdueBalance.length + pendingDocuments.length + dsrNearSla.length;

  function patientName(patientId?: string) {
    if (!patientId) return "—";
    return patients.find((p) => p.id === patientId)?.full_name ?? "—";
  }

  function handleCollectBalance(a: (typeof appointments)[number]) {
    updateAppointment(a.id, { status: "שולם במלואו" });
    if (a.created_by_id) {
      addDocument({
        patient_id: a.created_by_id,
        category: "receipt",
        title: `קבלה על יתרה - ${a.service_name}`,
        uploaded_by: "system",
        appointment_id: a.id,
        file: { file_name: "קבלה.pdf", uploaded_at: new Date().toISOString(), data_url: "data:application/pdf;base64," },
      });
    }
    showToast("היתרה נגבתה בהצלחה", { variant: "success" });
  }

  function handleConfirmDeposit(a: (typeof appointments)[number]) {
    updateAppointment(a.id, { status: "מאושר" });
    showToast("התור אושר", { variant: "success" });
  }

  return (
    <AppLayout>
      <PageHeader
        title="היום שלי"
        description={new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="תורים היום" value={todayAppointments.length} icon={<CalendarIcon className="h-4 w-4" />} tone="blue" />
        <StatCard
          label="טרם שולמה מקדמה"
          value={pendingDepositToday.length}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={pendingDepositToday.length > 0 ? "amber" : "slate"}
        />
        <StatCard
          label="יתרה לגבייה"
          value={overdueBalance.length}
          icon={<CreditCard className="h-4 w-4" />}
          tone={overdueBalance.length > 0 ? "danger" : "slate"}
        />
        <StatCard
          label="מסמכים ממתינים"
          value={pendingDocuments.length}
          icon={<FileText className="h-4 w-4" />}
          tone={pendingDocuments.length > 0 ? "amber" : "slate"}
        />
        <StatCard
          label="DSR קרוב ל-SLA"
          value={dsrNearSla.length}
          icon={<ShieldAlert className="h-4 w-4" />}
          tone={dsrNearSla.length > 0 ? "danger" : "slate"}
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>פעולות נדרשות {actionItemsCount > 0 && `(${actionItemsCount})`}</CardTitle>
          <p className="text-sm text-slate-500">כל מה שדורש טיפול שלך היום, במקום אחד</p>
        </CardHeader>
        <CardContent>
          {actionItemsCount === 0 ? (
            <EmptyState icon={<Check className="h-10 w-10" />} title="הכל מטופל — אין פעולות ממתינות" />
          ) : (
            <div className="flex flex-col gap-2">
              {pendingDepositToday.map((a) => (
                <div key={`dep-${a.id}`} className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{a.client_name} — טרם שולמה מקדמה</p>
                      <p className="text-xs text-slate-500">{a.service_name} · {a.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" onClick={() => handleConfirmDeposit(a)}>
                      <Check className="h-3.5 w-3.5" /> סמן ששולמה
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => router.push(`/appointments?appointment=${a.id}&date=${a.date}`)}>
                      <CalendarDays className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}

              {overdueBalance.map((a) => (
                <div key={`bal-${a.id}`} className="flex items-center justify-between gap-3 rounded-lg bg-danger-bg border border-danger-border px-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CreditCard className="h-4 w-4 text-danger-text shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{a.client_name} — יתרה לא שולמה</p>
                      <p className="text-xs text-slate-500">{a.service_name} · {formatDateHe(a.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => handleCollectBalance(a)}>
                      <CreditCard className="h-3.5 w-3.5" /> גבה יתרה
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => router.push(`/appointments?appointment=${a.id}&date=${a.date}`)}>
                      <CalendarDays className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}

              {pendingDocuments.map((d) => (
                <div key={`doc-${d.id}`} className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="h-4 w-4 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{patientName(d.patient_id)} — {d.title}</p>
                      <p className="text-xs text-slate-500">ממתין למילוי</p>
                    </div>
                  </div>
                  {d.patient_id && (
                    <Button size="sm" variant="outline" onClick={() => router.push(`/crm/${d.patient_id}`)}>
                      <FolderOpen className="h-3.5 w-3.5" /> תיק מטופל
                    </Button>
                  )}
                </div>
              ))}

              {dsrNearSla.map((r) => (
                <div key={`dsr-${r.id}`} className="flex items-center justify-between gap-3 rounded-lg bg-danger-bg border border-danger-border px-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ShieldAlert className="h-4 w-4 text-danger-text shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {patientName(r.patient_id)} — {DSR_REQUEST_TYPE_LABELS[r.type]}
                      </p>
                      <p className="text-xs text-slate-500">
                        {Math.floor(r.daysOpen)} ימים פתוח מתוך {DSR_SLA_DAYS} · {r.daysOpen > DSR_SLA_DAYS ? "בחריגת SLA" : "מתקרב לחריגה"}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => router.push("/admin")}>
                    <ShieldAlert className="h-3.5 w-3.5" /> טיפול
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>לוח התורים של היום</CardTitle>
        </CardHeader>
        <CardContent>
          {todayAppointments.length === 0 ? (
            <EmptyState icon={<CalendarIcon className="h-10 w-10" />} title="אין תורים היום" />
          ) : (
            <div className="flex flex-col gap-2">
              {todayAppointments.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{a.time} · {a.client_name}</p>
                    <p className="text-xs text-slate-500">{a.service_name} · {a.provider_name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={a.status} kind="appointment" />
                    {a.status === "מאושר" && a.date <= todayIso && (
                      <Badge tone="red">
                        <AlertTriangle className="h-3 w-3" /> יתרה
                      </Badge>
                    )}
                    {a.created_by_id && (
                      <Button size="sm" variant="outline" onClick={() => router.push(`/crm/${a.created_by_id}?appointment=${a.id}`)}>
                        <FolderOpen className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => router.push(`/appointments?appointment=${a.id}&date=${a.date}`)}>
                      <CalendarDays className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
