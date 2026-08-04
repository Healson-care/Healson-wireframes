"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProviderLayout } from "@/components/layouts/ProviderLayout";
import { useStore } from "@/lib/store";
import { useCurrentProvider } from "@/lib/useCurrentPatient";
import { PageHeader, Avatar, EmptyState } from "@/components/ui/Misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { VisitRecordsSection } from "@/components/provider/VisitRecordsSection";
import {
  AppointmentPaymentPanel,
  PaymentStateBadge,
  ReferralReviewPanel,
} from "@/components/provider/AppointmentReferralPanel";
import { Dialog } from "@/components/ui/Dialog";
import { fileToDataUrl } from "@/lib/file";
import { formatDateHe } from "@/lib/utils";
import { Appointment } from "@/types";
import Link from "next/link";
import {
  ShieldCheck,
  CalendarDays,
  FlaskConical,
  FileText,
  FileCheck2,
  ChevronRight,
} from "lucide-react";

function calculateAge(dateOfBirth?: string): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

export default function ProviderPatientChartPage() {
  const params = useParams<{ id: string }>();
  const patientId = params.id;
  const router = useRouter();
  const provider = useCurrentProvider();
  const patients = useStore((s) => s.patients);
  const appointments = useStore((s) => s.appointments);
  const labReferrals = useStore((s) => s.labReferrals);
  const visitRecords = useStore((s) => s.visitRecords);
  const addVisitRecord = useStore((s) => s.addVisitRecord);
  const showToast = useStore((s) => s.showToast);

  const patient = patients.find((p) => p.id === patientId);

  // §PRV-10 — a visit this provider PERSONALLY delivered inside a unit is part
  // of their history with the patient just as much as one booked in their own
  // clinic, so the chart (and the access guard below) keys on either axis.
  const myAppointments = useMemo(
    () =>
      appointments.filter(
        (a) =>
          a.created_by_id === patientId &&
          (a.provider_id === provider?.id || a.practitioner_id === provider?.id)
      ),
    [appointments, patientId, provider]
  );
  const myReferrals = useMemo(
    () => labReferrals.filter((r) => r.patient_id === patientId && r.provider_id === provider?.id),
    [labReferrals, patientId, provider]
  );
  // Every referral / commitment (טופס 17) this patient filed with this
  // provider, newest first. The document belongs to the booking, but clinically
  // it is part of the chart — so it is readable here without going back to the
  // diary (payments meeting §7, extended to the chart).
  const myDocumentedAppointments = useMemo(
    () =>
      myAppointments
        .filter((a) => a.referral_document || a.commitment_document)
        .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1)),
    [myAppointments]
  );
  const [openAppointmentId, setOpenAppointmentId] = useState<string | null>(null);
  const openAppointment = myAppointments.find((a) => a.id === openAppointmentId);

  const myVisitRecords = useMemo(
    () =>
      visitRecords
        .filter((v) => v.patient_id === patientId && v.provider_id === provider?.id)
        .sort((a, b) => (a.visit_date < b.visit_date ? 1 : -1)),
    [visitRecords, patientId, provider]
  );

  // Access guard (INV-SCOPE-GATE-02): a provider may only open a patient's
  // chart if they have some relationship to that patient — assigned to them,
  // or with at least one appointment (in their own diary OR delivered by them
  // inside a unit) / referral tying the two together.
  const hasRelationship =
    !!provider &&
    !!patient &&
    (patient.assigned_provider === provider.id ||
      myAppointments.length > 0 ||
      labReferrals.some((r) => r.patient_id === patientId && r.provider_id === provider.id));

  useEffect(() => {
    if (provider && (!patient || !hasRelationship)) {
      showToast("אין לך גישה לתיק מטופל זה", { variant: "destructive" });
      router.replace("/provider/patients");
    }
  }, [provider, patient, hasRelationship, router, showToast]);

  if (!provider || !patient || !hasRelationship) {
    return <DashboardSkeleton />;
  }

  const age = calculateAge(patient.date_of_birth);

  return (
    <ProviderLayout>
      <Link
        href="/provider/patients"
        className="focus-ring mb-2 inline-flex w-fit items-center gap-1 rounded-md text-sm font-medium text-slate-500 hover:text-primary"
      >
        <ChevronRight className="h-4 w-4" />
        חזרה למטופלים
      </Link>
      <PageHeader title={patient.full_name} description="תיק מטופל" />

      <Card className="mb-5 border-info-border bg-info-bg">
        <CardContent className="flex items-start gap-3 text-info-text">
          <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="text-sm">
            מוצג כאן רק ההיסטוריה שלך עם מטופל/ת זה. אם המטופל/ת טופל/ה גם אצל ספקים אחרים ב-Healson, הרשומות שלהם
            <span className="font-semibold"> אינן גלויות כאן</span> — כל ספק רואה אך ורק את מה שתיעד בעצמו.
          </p>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 flex flex-col gap-5">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Avatar name={patient.full_name} className="h-12 w-12" />
                <div>
                  <p className="font-medium text-slate-900">{patient.full_name}</p>
                  <StatusBadge status={patient.status} kind="patient" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <InfoRow label="גיל" value={age !== null ? `${age}` : "—"} />
              <InfoRow label="טלפון" value={patient.phone || "—"} />
              <InfoRow label="קופת חולים" value={patient.kupah ?? "ללא קופה (תייר)"} />
              {patient.k_level && <InfoRow label="מסלול השב״ן" value={patient.k_level} />}
              <InfoRow
                label="ביטוח פרטי (שכבה B)"
                value={patient.b_insurances?.length ? patient.b_insurances.map((ins) => ins.company || "כן").join(", ") : "אין"}
              />
              <InfoRow label="כתובת" value={patient.address || "—"} />
              {patient.parent_name && <InfoRow label="שם האב" value={patient.parent_name} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <FileCheck2 className="h-4 w-4 text-slate-400" /> הפניות והתחייבויות
              </CardTitle>
              <p className="text-xs text-slate-500">
                המסמכים שהמטופל/ת צירפ/ה לתורים אצלך — הפניה רפואית וטופס התחייבות (טופס 17).
              </p>
            </CardHeader>
            <CardContent>
              {myDocumentedAppointments.length === 0 ? (
                <EmptyState title="לא צורפו מסמכים" description="הפניות והתחייבויות שיצורפו לתורים יופיעו כאן." />
              ) : (
                <div className="flex flex-col gap-2">
                  {myDocumentedAppointments.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setOpenAppointmentId(a.id)}
                      className="focus-ring rounded-lg bg-slate-50 px-3 py-2 text-right transition-colors hover:bg-slate-100"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm text-slate-700">{a.service_name}</span>
                        <StatusBadge status={a.status} kind="appointment" />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {formatDateHe(a.date)} · {a.time}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                        {a.referral_document && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" /> הפניה
                          </span>
                        )}
                        {a.commitment_document && (
                          <span className="flex items-center gap-1">
                            <FileCheck2 className="h-3 w-3" /> התחייבות
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4 text-slate-400" /> בדיקות שהוזמנו על ידך
              </CardTitle>
            </CardHeader>
            <CardContent>
              {myReferrals.length === 0 ? (
                <EmptyState title="לא הוזמנו בדיקות" />
              ) : (
                <div className="flex flex-col gap-2">
                  {myReferrals.map((r) => (
                    <div key={r.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-700">{r.test_types.join(", ")}</span>
                        <StatusBadge status={r.status} kind="referral" />
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDateHe(r.created_date)}</p>
                      {r.results && <p className="text-xs text-slate-600 mt-1">{r.results}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-slate-400" /> תורים אצלך
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable<Appointment>
                rows={myAppointments}
                rowKey={(a) => a.id}
                emptyIcon={<CalendarDays className="h-10 w-10" />}
                emptyTitle="אין תורים קודמים"
                emptyDescription="תורים של המטופל/ת אצלך יופיעו כאן."
                // Opens the same referral + payment panels the diary uses, so a
                // referral can be read (and approved) without leaving the chart.
                onRowClick={(a) => setOpenAppointmentId(a.id)}
                columns={
                  [
                    { key: "service", header: "פריט", render: (a) => <span className="font-medium text-slate-900">{a.service_name}</span> },
                    {
                      key: "date",
                      header: "תאריך",
                      sortable: true,
                      sortValue: (a) => a.date + a.time,
                      render: (a) => (
                        <span className="text-slate-600">
                          {formatDateHe(a.date)} · {a.time}
                        </span>
                      ),
                    },
                    { key: "status", header: "סטטוס", render: (a) => <StatusBadge status={a.status} kind="appointment" /> },
                    { key: "payment", header: "תשלום", render: (a) => <PaymentStateBadge appointment={a} /> },
                  ] satisfies DataTableColumn<Appointment>[]
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-slate-400" /> סיכומי ביקור
              </CardTitle>
            </CardHeader>
            <CardContent>
              <VisitRecordsSection
                records={myVisitRecords}
                onAdd={async ({ visit_date, summary, instructions, file }) => {
                  try {
                    const provider_documents = file
                      ? [{ file_name: file.name, uploaded_at: new Date().toISOString(), data_url: await fileToDataUrl(file) }]
                      : undefined;
                    addVisitRecord({
                      provider_id: provider.id,
                      provider_name: provider.display_name,
                      patient_id: patient.id,
                      visit_date,
                      summary,
                      instructions,
                      provider_documents,
                    });
                    showToast("סיכום הביקור נשמר", { variant: "success" });
                  } catch (err) {
                    showToast("שגיאה בהעלאת הקובץ", { description: err instanceof Error ? err.message : undefined, variant: "destructive" });
                  }
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={!!openAppointment}
        onClose={() => setOpenAppointmentId(null)}
        title="מסמכים ותשלום"
        description={openAppointment ? `${openAppointment.service_name} · ${formatDateHe(openAppointment.date)}` : undefined}
      >
        {openAppointment && (
          <div className="flex flex-col gap-3">
            <ReferralReviewPanel appointment={openAppointment} />
            <AppointmentPaymentPanel appointment={openAppointment} />
          </div>
        )}
      </Dialog>
    </ProviderLayout>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 text-left">{value}</span>
    </div>
  );
}
