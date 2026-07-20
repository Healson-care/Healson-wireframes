"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Clock,
  Download,
  FileText,
  FlaskConical,
  ListChecks,
  Plus,
  Receipt,
  Upload,
  X,
} from "lucide-react";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { FilterDropdown } from "@/components/ui/FilterDropdown";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { fileToDataUrl, validateDocumentFile } from "@/lib/file";
import { formatDateHe, cn } from "@/lib/utils";
import { Appointment, DOCUMENT_CATEGORIES, DocumentCategory, LabReferral, PatientDocument } from "@/types";

type DocItem = { kind: "doc"; id: string; category: DocumentCategory; created_date: string; data: PatientDocument };
type LabItem = { kind: "lab"; id: string; category: "lab_result"; created_date: string; data: LabReferral };
type DisplayItem = DocItem | LabItem;

const CATEGORY_ICON: Record<DocumentCategory, typeof FileText> = {
  referral_personal: FileText,
  receipt: Receipt,
  visit_summary: ClipboardList,
  questionnaire: ListChecks,
  lab_result: FlaskConical,
  other: FileText,
};

function CategoryFilter({
  activeCategories,
  onChange,
}: {
  activeCategories: DocumentCategory[];
  onChange: (categories: DocumentCategory[]) => void;
}) {
  return (
    <FilterDropdown
      values={activeCategories}
      options={DOCUMENT_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
      allLabel="כל הקטגוריות"
      onChange={(values) => onChange(values as DocumentCategory[])}
    />
  );
}

// A single, compact row used inside an appointment's document group — dense
// on purpose, since a visit can have 2-3 linked documents and the group
// header already carries the visit context (date/provider/status).
// Pending rows are this visit's checklist: a questionnaire is "filled" in
// place (no file), anything else is fulfilled by actually attaching a file —
// mirrors the same distinction on /client/appointments.
function DocRow({
  item,
  onFill,
  onUploadFile,
  onDownload,
}: {
  item: DocItem;
  onFill: () => void;
  onUploadFile: (file: File | null) => void;
  onDownload: () => void;
}) {
  const categoryLabel = DOCUMENT_CATEGORIES.find((c) => c.id === item.category)?.label;
  const Icon = CATEGORY_ICON[item.category];
  const isPending = item.data.status === "ממתין למילוי";

  return (
    <div className={cn("flex items-center justify-between gap-3 px-3.5 py-2", isPending && "bg-warning-bg")}>
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className={cn("h-4 w-4 shrink-0", isPending ? "text-warning-text" : "text-slate-400")} />
        <div className="min-w-0">
          <p className={cn("text-sm font-medium truncate", isPending ? "text-warning-text" : "text-slate-800")}>
            {item.data.title}
          </p>
          <p className="text-xs text-slate-400">
            {categoryLabel} · {formatDateHe(item.created_date)}
          </p>
        </div>
      </div>
      <div className="shrink-0">
        {isPending ? (
          item.category === "questionnaire" ? (
            <Button size="sm" onClick={onFill}>
              מלא עכשיו
            </Button>
          ) : (
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-primary hover:text-primary">
              <Upload className="h-3.5 w-3.5" /> העלאה
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => onUploadFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )
        ) : item.data.file ? (
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download className="h-3.5 w-3.5" /> הורד
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// A compact row for a document/lab-result not tied to any visit — same slim
// style as DocRow, so "מסמכים כלליים" reads as one consistent list instead
// of a second, heavier card style.
function GeneralItemRow({
  item,
  onFillQuestionnaire,
  onUploadFile,
  onDownload,
}: {
  item: DisplayItem;
  onFillQuestionnaire: (docId: string) => void;
  onUploadFile: (docId: string, file: File | null) => void;
  onDownload: () => void;
}) {
  if (item.kind === "doc") {
    const categoryLabel = DOCUMENT_CATEGORIES.find((c) => c.id === item.category)?.label;
    const Icon = CATEGORY_ICON[item.category];
    const isPending = item.data.status === "ממתין למילוי";
    return (
      <div className={cn("flex items-center justify-between gap-3 px-3.5 py-2", isPending && "bg-warning-bg")}>
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className={cn("h-4 w-4 shrink-0", isPending ? "text-warning-text" : "text-slate-400")} />
          <div className="min-w-0">
            <p className={cn("text-sm font-medium truncate", isPending ? "text-warning-text" : "text-slate-800")}>
              {item.data.title}
            </p>
            <p className="text-xs text-slate-400">
              {categoryLabel} · {formatDateHe(item.data.created_date)}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          {isPending ? (
            item.category === "questionnaire" ? (
              <Button size="sm" onClick={() => onFillQuestionnaire(item.data.id)}>
                מלא עכשיו
              </Button>
            ) : (
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-primary hover:text-primary">
                <Upload className="h-3.5 w-3.5" /> העלאה
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => onUploadFile(item.data.id, e.target.files?.[0] ?? null)}
                />
              </label>
            )
          ) : item.data.file ? (
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="h-3.5 w-3.5" /> הורד
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const isCompleted = item.data.status === "הושלם";
  return (
    <div className="px-3.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <FlaskConical className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{item.data.test_types.join(", ")}</p>
            <p className="text-xs text-slate-400 truncate">
              {item.data.provider_name} · {formatDateHe(item.data.created_date)}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <StatusBadge status={item.data.status} kind="referral" />
        </div>
      </div>
      {isCompleted && (
        <div className="mt-2">
          <p className="text-xs text-slate-600 rounded-lg bg-slate-50 p-2.5">{item.data.results}</p>
          <div className="mt-2 flex justify-end">
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="h-3.5 w-3.5" /> הורד PDF
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// One "visit" — the appointment plus every document tied to it — so the
// patient sees the whole journey of that visit (before/during/after) at a
// glance, instead of hunting the same information across a flat list.
function AppointmentGroupCard({
  appointment,
  items,
  onFillQuestionnaire,
  onUploadFile,
  onDownload,
  onViewAppointment,
}: {
  appointment: Appointment;
  items: DocItem[];
  onFillQuestionnaire: (docId: string) => void;
  onUploadFile: (docId: string, file: File | null) => void;
  onDownload: () => void;
  onViewAppointment: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <button
        onClick={onViewAppointment}
        className="flex w-full flex-wrap items-center justify-between gap-2 bg-slate-50 px-3.5 py-2.5 text-right hover:bg-slate-100 transition-colors"
      >
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-900">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" /> {formatDateHe(appointment.date)}
            <span className="flex items-center gap-1 font-normal text-slate-400">
              <Clock className="h-3.5 w-3.5" /> {appointment.time}
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {appointment.service_name} · {appointment.provider_name}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={appointment.status} kind="appointment" />
          <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
        </div>
      </button>
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <DocRow
            key={item.id}
            item={item}
            onFill={() => onFillQuestionnaire(item.data.id)}
            onUploadFile={(file) => onUploadFile(item.data.id, file)}
            onDownload={onDownload}
          />
        ))}
      </div>
    </div>
  );
}

function ClientDocumentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentFilter = searchParams.get("appointment");

  const patient = useCurrentPatient();
  const documents = useStore((s) => s.documents);
  const labReferrals = useStore((s) => s.labReferrals);
  const appointments = useStore((s) => s.appointments);
  const addDocument = useStore((s) => s.addDocument);
  const updateDocument = useStore((s) => s.updateDocument);
  const showToast = useStore((s) => s.showToast);

  const [activeCategories, setActiveCategories] = useState<DocumentCategory[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const items: DisplayItem[] = useMemo(() => {
    const docItems: DisplayItem[] = documents
      .filter((d) => d.patient_id === patient?.id)
      .map((d) => ({ kind: "doc", id: d.id, category: d.category, created_date: d.created_date, data: d }));
    const labItems: DisplayItem[] = labReferrals
      .filter((r) => r.patient_id === patient?.id)
      .map((r) => ({ kind: "lab", id: r.id, category: "lab_result", created_date: r.created_date, data: r }));
    return [...docItems, ...labItems].sort((a, b) => (a.created_date < b.created_date ? 1 : -1));
  }, [documents, labReferrals, patient]);

  // Surfaced up top regardless of the active category filter — this is the
  // "what still needs my attention" view, not a browse-by-type one.
  const pendingItems = useMemo(
    () => items.filter((i): i is DocItem => i.kind === "doc" && i.data.status === "ממתין למילוי"),
    [items]
  );

  const categoryFilteredItems =
    activeCategories.length === 0 ? items : items.filter((i) => activeCategories.includes(i.category));

  // Primary grouping axis is the visit (appointment), not the category —
  // matches how patient portals like MyChart organize records, and answers
  // "what's related to what" directly instead of via a separate lookup.
  const groups = useMemo(() => {
    const byAppointment = new Map<string, DocItem[]>();
    for (const item of categoryFilteredItems) {
      if (item.kind !== "doc" || !item.data.appointment_id) continue;
      const list = byAppointment.get(item.data.appointment_id) ?? [];
      list.push(item);
      byAppointment.set(item.data.appointment_id, list);
    }
    const result: { appointment: Appointment; items: DocItem[] }[] = [];
    for (const [appointmentId, groupItems] of byAppointment) {
      const appointment = appointments.find((a) => a.id === appointmentId);
      if (appointment) result.push({ appointment, items: groupItems });
    }
    result.sort((a, b) => (a.appointment.date + a.appointment.time < b.appointment.date + b.appointment.time ? 1 : -1));
    return result;
  }, [categoryFilteredItems, appointments]);

  // Anything not tied to a specific visit — personal forms, lab results —
  // lives in its own section below the visit groups.
  const generalItems = useMemo(
    () => categoryFilteredItems.filter((item) => item.kind === "lab" || !item.data.appointment_id),
    [categoryFilteredItems]
  );

  const filteredGroup = appointmentFilter ? groups.find((g) => g.appointment.id === appointmentFilter) : undefined;
  const filteredAppointment = appointmentFilter
    ? filteredGroup?.appointment ?? appointments.find((a) => a.id === appointmentFilter)
    : undefined;

  function handleFillQuestionnaire(docId: string) {
    updateDocument(docId, { status: "זמין" });
    showToast("השאלון מולא בהצלחה", { variant: "success" });
  }

  // Fulfils a non-questionnaire checklist item by attaching the uploaded
  // file directly to its existing placeholder record.
  async function handleUploadRequiredDoc(docId: string, file: File | null) {
    if (!file) return;
    const validationError = validateDocumentFile(file);
    if (validationError) {
      showToast(validationError, { variant: "destructive" });
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    updateDocument(docId, {
      status: "זמין",
      file: { file_name: file.name, uploaded_at: new Date().toISOString(), data_url: dataUrl },
    });
    showToast("המסמך הועלה בהצלחה", { variant: "success" });
  }

  function handleDownload() {
    showToast("הקובץ הורד (מצב הדגמה)", { variant: "success" });
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!patient || !title.trim()) return;
    setUploading(true);
    addDocument({
      patient_id: patient.id,
      category: "referral_personal",
      title: title.trim(),
      uploaded_by: "patient",
      file: file
        ? { file_name: file.name, uploaded_at: new Date().toISOString(), data_url: await fileToDataUrl(file) }
        : undefined,
    });
    setUploading(false);
    setUploadOpen(false);
    setTitle("");
    setFile(null);
    showToast("המסמך הועלה בהצלחה", { variant: "success" });
  }

  return (
    <ClientLayout>
      <PageHeader
        title="מסמכים"
        actions={
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4" /> העלאת מסמך
          </Button>
        }
      />

      {appointmentFilter ? (
        <>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5 mb-3 text-sm">
            <span className="flex min-w-0 items-center gap-1.5 text-primary">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span className="truncate">
                מציג מסמכים לתור
                {filteredAppointment ? ` · ${filteredAppointment.service_name} · ${formatDateHe(filteredAppointment.date)}` : ""}
              </span>
            </span>
            <button
              onClick={() => router.push("/client/documents")}
              className="flex shrink-0 items-center gap-1 rounded-full p-1 text-primary hover:bg-primary/10"
              title="הצג את כל המסמכים"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {filteredGroup ? (
            <AppointmentGroupCard
              appointment={filteredGroup.appointment}
              items={filteredGroup.items}
              onFillQuestionnaire={handleFillQuestionnaire}
              onUploadFile={handleUploadRequiredDoc}
              onDownload={handleDownload}
              onViewAppointment={() => router.push(`/client/appointments?appointment=${filteredGroup.appointment.id}`)}
            />
          ) : (
            <EmptyState icon={<FileText className="h-10 w-10" />} title="אין מסמכים לתור זה" />
          )}
        </>
      ) : (
        <>
          {pendingItems.length > 0 && (
            <div className="mb-3 rounded-lg border border-warning-border bg-warning-bg p-2.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-warning-text mb-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> פעולות נדרשות ({pendingItems.length})
              </p>
              <div className="flex flex-col gap-1">
                {pendingItems.map((item) => {
                  const appt = item.data.appointment_id
                    ? appointments.find((a) => a.id === item.data.appointment_id)
                    : undefined;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-white/70 px-2 py-1"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-warning-text truncate">{item.data.title}</p>
                        {appt && (
                          <p className="text-[11px] text-warning-text/70 truncate">
                            {appt.service_name} · {formatDateHe(appt.date)}
                          </p>
                        )}
                      </div>
                      {item.category === "questionnaire" ? (
                        <Button size="sm" className="shrink-0" onClick={() => handleFillQuestionnaire(item.data.id)}>
                          מלא עכשיו
                        </Button>
                      ) : (
                        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-warning-text/40 bg-white px-2.5 py-1 text-[11px] font-medium text-warning-text transition-colors hover:bg-warning-text hover:text-white">
                          <Upload className="h-3 w-3" /> העלאה
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => handleUploadRequiredDoc(item.data.id, e.target.files?.[0] ?? null)}
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-3">
            <CategoryFilter activeCategories={activeCategories} onChange={setActiveCategories} />
          </div>

          {groups.length === 0 && generalItems.length === 0 ? (
            <EmptyState icon={<FileText className="h-10 w-10" />} title="אין מסמכים להצגה" />
          ) : (
            <div className="flex flex-col gap-3">
              {groups.map((group) => (
                <AppointmentGroupCard
                  key={group.appointment.id}
                  appointment={group.appointment}
                  items={group.items}
                  onFillQuestionnaire={handleFillQuestionnaire}
                  onUploadFile={handleUploadRequiredDoc}
                  onDownload={handleDownload}
                  onViewAppointment={() => router.push(`/client/appointments?appointment=${group.appointment.id}`)}
                />
              ))}

              {generalItems.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-1.5 px-1">מסמכים כלליים</p>
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm divide-y divide-slate-100">
                    {generalItems.map((item) => (
                      <GeneralItemRow
                        key={item.id}
                        item={item}
                        onFillQuestionnaire={handleFillQuestionnaire}
                        onUploadFile={handleUploadRequiredDoc}
                        onDownload={handleDownload}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Dialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="העלאת מסמך"
        description="הפניה או טופס אישי (למשל צילום ת&quot;ז)"
      >
        <form onSubmit={handleUpload} className="flex flex-col gap-3">
          <Input
            label="שם המסמך"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='לדוגמה: "הפניה לרופא עיניים"'
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">קובץ</label>
            <FileDropzone file={file} onFileChange={setFile} />
          </div>
          <Button type="submit" loading={uploading} className="mt-2">
            <Upload className="h-4 w-4" /> העלה
          </Button>
        </form>
      </Dialog>
    </ClientLayout>
  );
}

export default function ClientDocumentsPage() {
  return (
    <Suspense fallback={<ClientLayout>{null}</ClientLayout>}>
      <ClientDocumentsPageContent />
    </Suspense>
  );
}
