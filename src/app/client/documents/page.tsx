"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CalendarDays,
  ClipboardList,
  Download,
  FileText,
  FlaskConical,
  ListChecks,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { FilterDropdown } from "@/components/ui/FilterDropdown";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { fileToDataUrl, validateDocumentFile } from "@/lib/file";
import { formatDateHe, cn } from "@/lib/utils";
import { Appointment, DOCUMENT_CATEGORIES, DocumentCategory, DocumentStatus, LabReferral, PatientDocument } from "@/types";

const DOCUMENT_STATUS_OPTIONS: { value: DocumentStatus; label: string }[] = [
  { value: "ממתין למילוי", label: "ממתין למילוי" },
  { value: "זמין", label: "זמין" },
];

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

function StatusFilter({
  activeStatuses,
  onChange,
}: {
  activeStatuses: DocumentStatus[];
  onChange: (statuses: DocumentStatus[]) => void;
}) {
  return (
    <FilterDropdown
      values={activeStatuses}
      options={DOCUMENT_STATUS_OPTIONS}
      allLabel="כל הסטטוסים"
      onChange={(values) => onChange(values as DocumentStatus[])}
    />
  );
}

// One flat row per document/lab-result. A doc still shows which visit it's
// linked to (if any) as a subtitle, but the list itself is never grouped by
// appointment — that context lives on the appointment card on
// /client/appointments, this page is the patient's own document library.
function DocumentRow({
  item,
  linkedAppointment,
  onFillQuestionnaire,
  onUploadFile,
  onDownload,
  onRename,
  onDelete,
}: {
  item: DisplayItem;
  linkedAppointment?: Appointment;
  onFillQuestionnaire: (docId: string) => void;
  onUploadFile: (docId: string, file: File | null) => void;
  onDownload: () => void;
  onRename: (doc: PatientDocument) => void;
  onDelete: (docId: string) => void;
}) {
  if (item.kind === "doc") {
    const categoryLabel = DOCUMENT_CATEGORIES.find((c) => c.id === item.category)?.label;
    const Icon = CATEGORY_ICON[item.category];
    const isPending = item.data.status === "ממתין למילוי";
    return (
      <div className={cn("flex items-center justify-between gap-3 px-3.5 py-2.5", isPending && "bg-warning-bg")}>
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className={cn("h-4 w-4 shrink-0", isPending ? "text-warning-text" : "text-slate-400")} />
          <div className="min-w-0">
            <p className={cn("text-sm font-medium truncate", isPending ? "text-warning-text" : "text-slate-800")}>
              {item.data.title}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {categoryLabel} · {formatDateHe(item.data.created_date)}
              {linkedAppointment && ` · קשור לתור ${formatDateHe(linkedAppointment.date)}`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
          ) : (
            <>
              {item.data.file && (
                <Button variant="outline" size="sm" onClick={onDownload}>
                  <Download className="h-3.5 w-3.5" /> הורד
                </Button>
              )}
              <button
                onClick={() => onRename(item.data)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                title="שינוי שם"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDelete(item.data.id)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-danger/10 hover:text-danger"
                title="מחיקה"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const isCompleted = item.data.status === "הושלם";
  return (
    <div className="px-3.5 py-2.5">
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
  const deleteDocument = useStore((s) => s.deleteDocument);
  const showToast = useStore((s) => s.showToast);

  const [activeCategories, setActiveCategories] = useState<DocumentCategory[]>([]);
  const [activeStatuses, setActiveStatuses] = useState<DocumentStatus[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [renameDoc, setRenameDoc] = useState<PatientDocument | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

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

  // Status only exists on documents (not lab referrals), so picking a
  // status naturally narrows the list to docs — that matches the intent
  // ("show me what's pending" / "show me what's ready").
  const statusFilteredItems =
    activeStatuses.length === 0
      ? categoryFilteredItems
      : categoryFilteredItems.filter((i) => i.kind === "doc" && activeStatuses.includes(i.data.status ?? "זמין"));

  // "?appointment=" (arriving from the appointment card's "לצפייה מלאה
  // במסמכים" link, or the booking-confirmation receipt link) narrows the
  // same flat list to that visit's docs rather than switching to a
  // different, grouped view.
  const visibleItems = appointmentFilter
    ? statusFilteredItems.filter((i) => i.kind === "doc" && i.data.appointment_id === appointmentFilter)
    : statusFilteredItems;

  const filteredAppointment = appointmentFilter ? appointments.find((a) => a.id === appointmentFilter) : undefined;

  function getLinkedAppointment(item: DisplayItem): Appointment | undefined {
    if (item.kind !== "doc" || !item.data.appointment_id) return undefined;
    return appointments.find((a) => a.id === item.data.appointment_id);
  }

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

  function openRenameDialog(doc: PatientDocument) {
    setRenameDoc(doc);
    setRenameValue(doc.title);
  }

  function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renameDoc || !renameValue.trim()) return;
    updateDocument(renameDoc.id, { title: renameValue.trim() });
    showToast("שם המסמך עודכן", { variant: "success" });
    setRenameDoc(null);
  }

  return (
    <ClientLayout>
      <PageHeader
        title="מסמכים"
        actions={
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4" /> מסמך חדש
          </Button>
        }
      />

      {appointmentFilter && (
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
      )}

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
                <div key={item.id} className="flex items-center justify-between gap-2 rounded-md bg-white/70 px-2 py-1">
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

      <p className="text-xs font-semibold text-slate-400 mb-1.5 px-1">המסמכים שלי</p>
      <div className="mb-3 flex flex-wrap gap-2">
        <CategoryFilter activeCategories={activeCategories} onChange={setActiveCategories} />
        <StatusFilter activeStatuses={activeStatuses} onChange={setActiveStatuses} />
      </div>

      {visibleItems.length === 0 ? (
        <EmptyState icon={<FileText className="h-10 w-10" />} title="אין מסמכים להצגה" />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm divide-y divide-slate-100">
          {visibleItems.map((item) => (
            <DocumentRow
              key={item.id}
              item={item}
              linkedAppointment={getLinkedAppointment(item)}
              onFillQuestionnaire={handleFillQuestionnaire}
              onUploadFile={handleUploadRequiredDoc}
              onDownload={handleDownload}
              onRename={openRenameDialog}
              onDelete={(docId) => setDeleteDocId(docId)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="מסמך חדש"
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

      <Dialog open={!!renameDoc} onClose={() => setRenameDoc(null)} title="שינוי שם מסמך">
        <form onSubmit={handleRename} className="flex flex-col gap-3">
          <Input label="שם המסמך" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} required autoFocus />
          <Button type="submit" className="mt-2">
            שמירה
          </Button>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleteDocId}
        onClose={() => setDeleteDocId(null)}
        title="מחיקת מסמך"
        description="לא ניתן לשחזר את המסמך לאחר המחיקה."
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteDocId) {
            deleteDocument(deleteDocId);
            showToast("המסמך נמחק", { variant: "success" });
          }
        }}
      />
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
