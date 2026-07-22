"use client";

import { Suspense, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, Avatar, EmptyState, StatCard } from "@/components/ui/Misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { PatientForm, PatientFormValues } from "@/components/admin/PatientForm";
import { AppointmentForm, AppointmentFormValues } from "@/components/admin/AppointmentForm";
import { fileToDataUrl } from "@/lib/file";
import { cn, formatDateHe } from "@/lib/utils";
import { findSchedulingConflict, isoDate, suggestNextFreeSlot } from "@/lib/calendar";
import { Appointment, DOCUMENT_CATEGORIES, DocumentCategory, PatientDocument } from "@/types";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Check,
  ClipboardList,
  Copy,
  CreditCard,
  Download,
  FileDown,
  FileText,
  FlaskConical,
  Mail,
  Pencil,
  Phone,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Upload,
  X,
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


function AdminPatientChartPageContent() {
  const params = useParams<{ id: string }>();
  const patientId = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentFilter = searchParams.get("appointment");

  const patients = useStore((s) => s.patients);
  const appointments = useStore((s) => s.appointments);
  const documents = useStore((s) => s.documents);
  const labReferrals = useStore((s) => s.labReferrals);
  const visitRecords = useStore((s) => s.visitRecords);
  const providers = useStore((s) => s.providers);
  const updatePatient = useStore((s) => s.updatePatient);
  const updateAppointment = useStore((s) => s.updateAppointment);
  const addAppointment = useStore((s) => s.addAppointment);
  const addDocument = useStore((s) => s.addDocument);
  const exportPatientData = useStore((s) => s.exportPatientData);
  const showToast = useStore((s) => s.showToast);

  const [editOpen, setEditOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>("referral_personal");
  const [uploadApptId, setUploadApptId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cancelApptId, setCancelApptId] = useState<string | null>(null);
  const [editApptId, setEditApptId] = useState<string | null>(null);
  const [editApptForm, setEditApptForm] = useState({ date: "", time: "", duration_minutes: 30, notes: "" });
  const [noteDraft, setNoteDraft] = useState("");
  const [noteLoadedFor, setNoteLoadedFor] = useState<string | null>(null);

  const patient = patients.find((p) => p.id === patientId);

  if (patient && noteLoadedFor !== patient.id) {
    setNoteLoadedFor(patient.id);
    setNoteDraft(patient.notes ?? "");
  }

  const patientAppointments = useMemo(
    () => appointments.filter((a) => a.created_by_id === patientId).sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1)),
    [appointments, patientId]
  );
  const patientDocuments = useMemo(
    () => documents.filter((d) => d.patient_id === patientId).sort((a, b) => (a.created_date < b.created_date ? 1 : -1)),
    [documents, patientId]
  );
  const patientReferrals = useMemo(
    () => labReferrals.filter((r) => r.patient_id === patientId),
    [labReferrals, patientId]
  );
  const patientVisitRecords = useMemo(
    () =>
      visitRecords
        .filter((v) => v.patient_id === patientId)
        .sort((a, b) => (a.visit_date < b.visit_date ? 1 : -1)),
    [visitRecords, patientId]
  );

  const documentGroups = useMemo(() => {
    const byAppointment = new Map<string, PatientDocument[]>();
    for (const d of patientDocuments) {
      if (!d.appointment_id) continue;
      const list = byAppointment.get(d.appointment_id) ?? [];
      list.push(d);
      byAppointment.set(d.appointment_id, list);
    }
    const result: { appointment: Appointment; items: PatientDocument[] }[] = [];
    for (const [apptId, items] of byAppointment) {
      const appt = patientAppointments.find((a) => a.id === apptId);
      if (appt) result.push({ appointment: appt, items });
    }
    result.sort((a, b) => (a.appointment.date + a.appointment.time < b.appointment.date + b.appointment.time ? 1 : -1));
    return result;
  }, [patientDocuments, patientAppointments]);

  const generalDocuments = useMemo(() => patientDocuments.filter((d) => !d.appointment_id), [patientDocuments]);

  const upcomingAppointment = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    return patientAppointments
      .filter((a) => a.date >= todayIso && a.status !== "בוטל")
      .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))[0];
  }, [patientAppointments]);

  const pendingDocumentsCount = useMemo(
    () => patientDocuments.filter((d) => d.status === "ממתין למילוי").length,
    [patientDocuments]
  );

  const overdueBalanceCount = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    return patientAppointments.filter((a) => a.status === "מאושר" && a.date <= todayIso).length;
  }, [patientAppointments]);

  if (!patient) {
    return (
      <AppLayout>
        <PageHeader title="תיק מטופל" />
        <EmptyState title="מטופל לא נמצא" description="ייתכן שהמטופל נמחק" />
      </AppLayout>
    );
  }

  const age = calculateAge(patient.date_of_birth);
  const contextAppointment = appointmentFilter ? patientAppointments.find((a) => a.id === appointmentFilter) : undefined;

  function copyToClipboard(value: string, label: string) {
    navigator.clipboard.writeText(value);
    showToast(`${label} הועתק`, { variant: "success" });
  }

  function handleDownload() {
    showToast("הקובץ הורד (מצב הדגמה)", { variant: "success" });
  }

  function openEditAppt(id: string) {
    const appt = appointments.find((a) => a.id === id);
    if (!appt) return;
    setEditApptId(id);
    setEditApptForm({ date: appt.date, time: appt.time, duration_minutes: appt.duration_minutes, notes: appt.notes ?? "" });
  }

  const editingAppointment = editApptId ? appointments.find((a) => a.id === editApptId) : undefined;
  const editApptConflict = editingAppointment
    ? findSchedulingConflict(
        appointments,
        editingAppointment.provider_id ?? "",
        editApptForm.date,
        editApptForm.time,
        editApptForm.duration_minutes,
        editApptId ?? undefined
      )
    : undefined;
  const editApptSuggestedSlot =
    editApptConflict && editingAppointment
      ? suggestNextFreeSlot(
          appointments,
          editingAppointment.provider_id ?? "",
          editApptForm.date,
          editApptForm.time,
          editApptForm.duration_minutes,
          editApptId ?? undefined
        )
      : undefined;

  function handleCollectBalance(a: Appointment) {
    if (!patient) return;
    updateAppointment(a.id, { status: "שולם במלואו" });
    addDocument({
      patient_id: patient.id,
      category: "receipt",
      title: `קבלה על יתרה - ${a.service_name}`,
      uploaded_by: "system",
      appointment_id: a.id,
      file: { file_name: "קבלה.pdf", uploaded_at: new Date().toISOString(), data_url: "data:application/pdf;base64," },
    });
    showToast("היתרה נגבתה בהצלחה", { variant: "success" });
  }

  function handleBookAppointment(values: AppointmentFormValues) {
    const provider = providers.find((p) => p.id === values.provider_id);
    if (!provider || !patient) return;
    addAppointment({
      client_name: patient.full_name,
      client_phone: patient.phone,
      provider_id: provider.id,
      provider_name: provider.display_name,
      service_name: values.service_name,
      date: values.date,
      time: values.time,
      duration_minutes: values.duration_minutes,
      status: values.status,
      price: values.price ? Number(values.price) : undefined,
      kupah: patient.kupah,
      notes: values.notes || undefined,
      created_by_id: patient.id,
    });
    showToast("התור נקבע בהצלחה", { variant: "success" });
    setBookOpen(false);
  }

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patient || !uploadTitle.trim()) return;
    setUploading(true);
    try {
      addDocument({
        patient_id: patient.id,
        category: uploadCategory,
        title: uploadTitle.trim(),
        uploaded_by: "system",
        appointment_id: uploadApptId || undefined,
        file: uploadFile
          ? { file_name: uploadFile.name, uploaded_at: new Date().toISOString(), data_url: await fileToDataUrl(uploadFile) }
          : undefined,
      });
      showToast("המסמך הועלה בהצלחה", { variant: "success" });
      setUploadOpen(false);
      setUploadTitle("");
      setUploadCategory("referral_personal");
      setUploadApptId("");
      setUploadFile(null);
    } catch (err) {
      showToast("שגיאה בהעלאת הקובץ", { description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function handleExport() {
    if (!patient) return;
    const data = exportPatientData(patient.id);
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `healson-${patient.full_name}-${patient.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("תיק המטופל יוצא בהצלחה", { variant: "success" });
  }

  return (
    <AppLayout>
      <PageHeader
        title={patient.full_name}
        description="תיק מטופל"
        actions={
          <>
            <Button size="sm" variant="outline" onClick={handleExport}>
              <FileDown className="h-4 w-4" /> ייצוא תיק
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> ערוך פרטים
            </Button>
            <Button size="sm" variant="outline" onClick={() => router.back()}>
              <ArrowRight className="h-4 w-4" /> חזרה
            </Button>
          </>
        }
      />

      {contextAppointment && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5 mb-4 text-sm">
          <span className="flex flex-wrap items-center gap-1.5 text-primary">
            <CalendarDays className="h-4 w-4" />
            מציג תיק בהקשר לתור · {contextAppointment.service_name} · {formatDateHe(contextAppointment.date)} · {contextAppointment.time}
            <StatusBadge status={contextAppointment.status} kind="appointment" />
          </span>
          <button
            onClick={() => router.push(`/crm/${patientId}`)}
            className="flex items-center gap-1 rounded-full p-1 text-primary hover:bg-primary/10 shrink-0"
            title="הצג תיק מלא"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <StatCard label="סה״כ תורים" value={patientAppointments.length} icon={<CalendarDays className="h-4 w-4" />} tone="blue" />
        <StatCard
          label="התור הקרוב"
          value={upcomingAppointment ? formatDateHe(upcomingAppointment.date) : "אין"}
          subtitle={upcomingAppointment ? `${upcomingAppointment.time} · ${upcomingAppointment.service_name}` : undefined}
          icon={<CalendarClock className="h-4 w-4" />}
          tone="green"
        />
        <StatCard
          label="יתרה לגבייה"
          value={overdueBalanceCount}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={overdueBalanceCount > 0 ? "danger" : "slate"}
        />
        <StatCard
          label="מסמכים ממתינים"
          value={pendingDocumentsCount}
          icon={<FileText className="h-4 w-4" />}
          tone={pendingDocumentsCount > 0 ? "amber" : "slate"}
        />
        <StatCard label="סיכומי ביקור" value={patientVisitRecords.length} icon={<ClipboardList className="h-4 w-4" />} tone="purple" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 flex flex-col gap-5">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Avatar name={patient.full_name} className="h-12 w-12" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-slate-900">{patient.full_name}</p>
                    {patient.processing_restricted && <Badge tone="red">עיבוד מוגבל</Badge>}
                  </div>
                  <StatusBadge status={patient.status} kind="patient" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <InfoRow label="גיל" value={age !== null ? `${age}` : "—"} />
              {patient.gender && <InfoRow label="מגדר" value={patient.gender} />}
              <ContactRow
                label="ת.ז"
                value={patient.id_number || "—"}
                onCopy={patient.id_number ? () => copyToClipboard(patient.id_number!, "מספר ת.ז") : undefined}
              />
              <ContactRow
                label="טלפון"
                value={patient.phone || "—"}
                href={patient.phone ? `tel:${patient.phone}` : undefined}
                icon={patient.phone ? <Phone className="h-3.5 w-3.5" /> : undefined}
                onCopy={patient.phone ? () => copyToClipboard(patient.phone!, "מספר הטלפון") : undefined}
              />
              <ContactRow
                label="אימייל"
                value={patient.email || "—"}
                href={patient.email ? `mailto:${patient.email}` : undefined}
                icon={patient.email ? <Mail className="h-3.5 w-3.5" /> : undefined}
              />
              <InfoRow label="קופת חולים" value={patient.kupah ?? "ללא קופה (תייר)"} />
              {patient.k_level && <InfoRow label="מסלול השב״ן" value={patient.k_level} />}
              <InfoRow label="ביטוח פרטי (שכבה B)" value={patient.has_b_insurance ? patient.b_insurance_company || "כן" : "אין"} />
              <InfoRow label="כתובת" value={patient.address || "—"} />
              {patient.parent_name && <InfoRow label="שם הורה/אפוטרופוס" value={patient.parent_name} />}
              {patient.id_document_photo && (
                <a
                  href={patient.id_document_photo.data_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-primary hover:underline mt-1"
                >
                  <FileText className="h-3.5 w-3.5" /> צפייה בתעודה שהועלתה
                </a>
              )}

              <div className="mt-2 pt-2 border-t border-slate-100">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  title="חוסם קביעת תורים והזמנות חדשות עבור המטופל (זכויות נושאי מידע / פרטיות) — לא מוחק נתונים קיימים"
                  onClick={() => {
                    const restricted = !patient.processing_restricted;
                    updatePatient(patient.id, { processing_restricted: restricted });
                    showToast(restricted ? "עיבוד הנתונים של המטופל נחסם" : "חסימת עיבוד הנתונים בוטלה", { variant: "success" });
                  }}
                >
                  {patient.processing_restricted ? (
                    <>
                      <ShieldCheck className="h-4 w-4" /> בטל חסימת עיבוד נתונים
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-4 w-4" /> חסום עיבוד נתונים
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">הערות פנימיות (לא מוצג למטופל)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="לדוגמה: מעדיף תורים בבוקר, נגיש בוואטסאפ בלבד..."
                rows={3}
              />
              <Button
                size="sm"
                variant="outline"
                className="self-start"
                disabled={(patient.notes ?? "") === noteDraft}
                onClick={() => {
                  updatePatient(patient.id, { notes: noteDraft });
                  showToast("ההערה נשמרה", { variant: "success" });
                }}
              >
                שמור הערה
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4 text-slate-400" /> הפניות למעבדה
              </CardTitle>
            </CardHeader>
            <CardContent>
              {patientReferrals.length === 0 ? (
                <EmptyState title="לא הוזמנו בדיקות" />
              ) : (
                <div className="flex flex-col gap-2">
                  {patientReferrals.map((r) => (
                    <div key={r.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-700">{r.test_types.join(", ")}</span>
                        <StatusBadge status={r.status} kind="referral" />
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{r.provider_name} · {formatDateHe(r.created_date)}</p>
                      {r.results && <p className="text-xs text-slate-600 mt-1">{r.results}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="appointments">
            <TabsList className="mb-4">
              <TabsTrigger value="appointments" icon={<CalendarDays className="h-3.5 w-3.5" />}>
                תורים {patientAppointments.length > 0 && `(${patientAppointments.length})`}
              </TabsTrigger>
              <TabsTrigger value="documents" icon={<FileText className="h-3.5 w-3.5" />}>
                מסמכים {patientDocuments.length > 0 && `(${patientDocuments.length})`}
              </TabsTrigger>
              <TabsTrigger value="visits" icon={<ClipboardList className="h-3.5 w-3.5" />}>
                סיכומי ביקור {patientVisitRecords.length > 0 && `(${patientVisitRecords.length})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="appointments">
              <Card>
                <CardHeader className="flex items-center justify-between flex-row">
                  <CardTitle className="text-sm">תורים</CardTitle>
                  <Button size="sm" onClick={() => setBookOpen(true)}>
                    <Plus className="h-4 w-4" /> קביעת תור חדש
                  </Button>
                </CardHeader>
                <CardContent>
                  <DataTable<Appointment>
                    rows={patientAppointments}
                    rowKey={(a) => a.id}
                    emptyIcon={<CalendarDays className="h-10 w-10" />}
                    emptyTitle="אין תורים"
                    columns={
                      [
                        { key: "service", header: "שירות", render: (a) => <span className="font-medium text-slate-900">{a.service_name}</span> },
                        { key: "provider", header: "ספק", render: (a) => <span className="text-slate-600">{a.provider_name}</span> },
                        {
                          key: "date",
                          header: "תאריך",
                          sortable: true,
                          sortValue: (a) => a.date + a.time,
                          render: (a) => (
                            <span className={cn("text-slate-600", a.id === appointmentFilter && "font-semibold text-primary")}>
                              {formatDateHe(a.date)} · {a.time}
                            </span>
                          ),
                        },
                        {
                          key: "status",
                          header: "סטטוס",
                          render: (a) => (
                            <div className="flex items-center gap-1.5">
                              <StatusBadge status={a.status} kind="appointment" />
                              {a.status === "מאושר" && a.date <= isoDate(new Date()) && (
                                <Badge tone="red" title="התאריך הגיע והיתרה טרם שולמה">
                                  <AlertTriangle className="h-3 w-3" /> יתרה
                                </Badge>
                              )}
                            </div>
                          ),
                        },
                      ] satisfies DataTableColumn<Appointment>[]
                    }
                    rowActions={(a) => (
                      <div className="flex items-center gap-1">
                        {a.status === "ממתין לתשלום מקדמה" && (
                          <button
                            onClick={() => {
                              updateAppointment(a.id, { status: "מאושר" });
                              showToast("התור אושר", { variant: "success" });
                            }}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
                            title="אשר"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {a.status === "מאושר" && (
                          <button
                            onClick={() => handleCollectBalance(a)}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
                            title="גבה יתרה (טלפונית)"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={() => openEditAppt(a.id)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500" title="עריכה">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {a.status !== "בוטל" && a.status !== "בוצע" && (
                          <button
                            onClick={() => setCancelApptId(a.id)}
                            className="p-1.5 rounded-md hover:bg-red-50 text-red-500"
                            title="בטל תור"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/appointments?appointment=${a.id}&date=${a.date}`)}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
                          title="הצג ביומן"
                        >
                          <CalendarDays className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="flex flex-col gap-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setUploadOpen(true)}>
                  <Upload className="h-4 w-4" /> העלאת מסמך
                </Button>
              </div>

              {documentGroups.length === 0 && generalDocuments.length === 0 ? (
                <Card>
                  <CardContent>
                    <EmptyState icon={<FileText className="h-10 w-10" />} title="אין מסמכים" />
                  </CardContent>
                </Card>
              ) : (
                <>
                  {documentGroups.map((group) => (
                    <Card key={group.appointment.id} className="overflow-hidden p-0">
                      <div className="flex items-center justify-between gap-2 bg-slate-50 px-4 py-3">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                          <CalendarDays className="h-4 w-4 text-primary" /> {formatDateHe(group.appointment.date)}
                          <span className="font-normal text-slate-500">
                            · {group.appointment.service_name} · {group.appointment.provider_name}
                          </span>
                        </p>
                        <StatusBadge status={group.appointment.status} kind="appointment" />
                      </div>
                      <div className="divide-y divide-slate-100">
                        {group.items.map((d) => (
                          <DocumentRow key={d.id} doc={d} onDownload={handleDownload} />
                        ))}
                      </div>
                    </Card>
                  ))}

                  {generalDocuments.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">מסמכים כלליים</CardTitle>
                      </CardHeader>
                      <div className="divide-y divide-slate-100">
                        {generalDocuments.map((d) => (
                          <DocumentRow key={d.id} doc={d} onDownload={handleDownload} />
                        ))}
                      </div>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="visits">
              <Card>
                <CardContent>
                  {patientVisitRecords.length === 0 ? (
                    <EmptyState icon={<ClipboardList className="h-10 w-10" />} title="אין סיכומי ביקור עדיין" />
                  ) : (
                    <div className="flex flex-col gap-3">
                      {patientVisitRecords.map((r) => (
                        <div key={r.id} className="rounded-lg border border-slate-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-medium text-slate-900">{formatDateHe(r.visit_date)}</p>
                            <span className="text-xs text-slate-400">{r.provider_name}</span>
                          </div>
                          <p className="text-sm text-slate-700 mt-1.5 whitespace-pre-line">{r.summary}</p>
                          {r.instructions && (
                            <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                              <p className="text-xs font-medium text-slate-500 mb-0.5">הנחיות למטופל</p>
                              <p className="text-sm text-slate-700 whitespace-pre-line">{r.instructions}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <PatientForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={(values: PatientFormValues) => {
          updatePatient(patient.id, {
            ...values,
            gender: values.gender || undefined,
            k_level: values.k_level || undefined,
            b_insurance_company: values.has_b_insurance ? values.b_insurance_company : undefined,
            b_policy_number: values.has_b_insurance ? values.b_policy_number : undefined,
            address: values.address || undefined,
          });
          showToast("פרטי המטופל עודכנו", { variant: "success" });
          setEditOpen(false);
        }}
        initial={{
          full_name: patient.full_name,
          email: patient.email ?? "",
          phone: patient.phone ?? "",
          id_number: patient.id_number ?? "",
          id_document_type: patient.id_document_type ?? "id",
          date_of_birth: patient.date_of_birth ?? "",
          gender: patient.gender ?? "",
          parent_name: patient.parent_name ?? "",
          kupah: patient.kupah ?? "",
          k_level: patient.k_level ?? "",
          has_b_insurance: patient.has_b_insurance ?? false,
          b_insurance_company: patient.b_insurance_company ?? "",
          b_policy_number: patient.b_policy_number ?? "",
          address: patient.address ?? "",
          status: patient.status,
        }}
      />

      <AppointmentForm
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        onSubmit={handleBookAppointment}
        providers={providers}
        patientKupah={patient.kupah ?? "ללא קופה (תייר)"}
        appointments={appointments}
      />

      <ConfirmDialog
        open={!!cancelApptId}
        onClose={() => setCancelApptId(null)}
        title="ביטול תור"
        destructive
        confirmLabel="בטל תור"
        onConfirm={() => {
          if (cancelApptId) {
            updateAppointment(cancelApptId, { status: "בוטל" });
            showToast("התור בוטל", { variant: "success" });
          }
        }}
      />

      <Dialog open={!!editApptId} onClose={() => setEditApptId(null)} title="עריכת תור">
        <div className="flex flex-col gap-3">
          <Input
            type="date"
            label="תאריך"
            value={editApptForm.date}
            onChange={(e) => setEditApptForm({ ...editApptForm, date: e.target.value })}
          />
          <Input
            type="time"
            label="שעה"
            value={editApptForm.time}
            onChange={(e) => setEditApptForm({ ...editApptForm, time: e.target.value })}
          />
          <Input
            type="number"
            label="משך (דקות)"
            value={editApptForm.duration_minutes}
            onChange={(e) => setEditApptForm({ ...editApptForm, duration_minutes: Number(e.target.value) })}
          />
          {editApptConflict && (
            <div className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-bg px-3 py-2.5 text-sm text-danger-text">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p>לספק כבר יש תור ב-{editApptConflict.time} ({editApptConflict.client_name})</p>
                {editApptSuggestedSlot ? (
                  <button
                    type="button"
                    onClick={() => setEditApptForm({ ...editApptForm, time: editApptSuggestedSlot })}
                    className="mt-1 font-medium hover:underline"
                  >
                    בחר את השעה הפנויה הבאה — {editApptSuggestedSlot}
                  </button>
                ) : (
                  <p className="mt-1 text-xs">אין שעה פנויה נוספת ליום זה</p>
                )}
              </div>
            </div>
          )}
          <Textarea
            label="הערות"
            value={editApptForm.notes}
            onChange={(e) => setEditApptForm({ ...editApptForm, notes: e.target.value })}
          />
          <Button
            onClick={() => {
              if (editApptId) {
                updateAppointment(editApptId, editApptForm);
                showToast("התור עודכן", { variant: "success" });
              }
              setEditApptId(null);
            }}
          >
            שמור שינויים
          </Button>
        </div>
      </Dialog>

      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} title="העלאת מסמך" description="מטעם המשרד — עבור המטופל">
        <form onSubmit={handleUploadSubmit} className="flex flex-col gap-3">
          <Input label="שם המסמך" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} required />
          <Select label="סוג מסמך" value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
          <Select label="תור מקושר (אופציונלי)" value={uploadApptId} onChange={(e) => setUploadApptId(e.target.value)}>
            <option value="">ללא תור מקושר</option>
            {patientAppointments.map((a) => (
              <option key={a.id} value={a.id}>
                {formatDateHe(a.date)} · {a.service_name}
              </option>
            ))}
          </Select>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">קובץ</label>
            <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} className="text-sm" />
          </div>
          <Button type="submit" loading={uploading} className="mt-2">
            <Upload className="h-4 w-4" /> העלה
          </Button>
        </form>
      </Dialog>
    </AppLayout>
  );
}

function ContactRow({
  label,
  value,
  href,
  icon,
  onCopy,
}: {
  label: string;
  value: string;
  href?: string;
  icon?: React.ReactNode;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="flex items-center gap-1.5">
        {href ? (
          <a href={href} className="font-medium text-primary hover:underline flex items-center gap-1">
            {icon}
            {value}
          </a>
        ) : (
          <span className="font-medium text-slate-800">{value}</span>
        )}
        {onCopy && (
          <button onClick={onCopy} className="p-1 rounded-md hover:bg-slate-100 text-slate-400" title="העתק">
            <Copy className="h-3 w-3" />
          </button>
        )}
      </span>
    </div>
  );
}

function DocumentRow({ doc, onDownload }: { doc: PatientDocument; onDownload: () => void }) {
  const categoryLabel = DOCUMENT_CATEGORIES.find((c) => c.id === doc.category)?.label;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{doc.title}</p>
        <p className="text-xs text-slate-400">
          {categoryLabel} · {formatDateHe(doc.created_date)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {doc.status && <Badge tone={doc.status === "ממתין למילוי" ? "warning" : "success"}>{doc.status}</Badge>}
        {doc.file && (
          <Button size="sm" variant="outline" onClick={onDownload}>
            <Download className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AdminPatientChartPage() {
  return (
    <Suspense fallback={<AppLayout>{null}</AppLayout>}>
      <AdminPatientChartPageContent />
    </Suspense>
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
