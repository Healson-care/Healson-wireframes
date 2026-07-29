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
  MoreVertical,
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
import { Popover } from "@/components/ui/Popover";
import { DocumentUploadDialog } from "@/components/patient/DocumentUploadDialog";
import { RequiredDocumentUploadDialog } from "@/components/patient/RequiredDocumentUploadDialog";
import { formatDateHe } from "@/lib/utils";
import {
  Appointment,
  documentAppointmentIds,
  DOCUMENT_CATEGORIES,
  DocumentCategory,
  LabReferral,
  PatientDocument,
} from "@/types";

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

// One flat row per document/lab-result. A doc still shows which visit it's
// linked to (if any) as a subtitle, but the list itself is never grouped by
// appointment — that context lives on the appointment card on
// /client/appointments, this page is the patient's own document library.
function DocumentRow({
  item,
  linkedAppointments,
  onDownload,
  onRename,
  onDelete,
  onGoToAppointment,
}: {
  item: DisplayItem;
  linkedAppointments: Appointment[];
  onDownload: () => void;
  onRename: (doc: PatientDocument) => void;
  onDelete: (docId: string) => void;
  onGoToAppointment: (appointmentId: string) => void;
}) {
  if (item.kind === "doc") {
    const categoryLabel = DOCUMENT_CATEGORIES.find((c) => c.id === item.category)?.label;
    const Icon = CATEGORY_ICON[item.category];
    return (
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{item.data.title}</p>
            <p className="text-xs text-slate-400 truncate">
              {categoryLabel} · {formatDateHe(item.data.created_date)}
            </p>
            {linkedAppointments.length === 1 && (
              <button
                type="button"
                onClick={() => onGoToAppointment(linkedAppointments[0].id)}
                className="truncate text-xs text-primary hover:underline"
              >
                קשור לתור {formatDateHe(linkedAppointments[0].date)}
              </button>
            )}
            {linkedAppointments.length > 1 && (
              <p className="truncate text-xs text-slate-400">קשור ל-{linkedAppointments.length} תורים</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {linkedAppointments.length > 1 && (
            <Popover
              align="end"
              trigger={
                <span
                  className="flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary"
                  title="תורים מקושרים"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                </span>
              }
            >
              {(close) => (
                <div className="flex flex-col gap-0.5">
                  <p className="mb-1 px-2 text-xs font-semibold text-slate-400">תורים מקושרים</p>
                  {linkedAppointments.map((appt) => (
                    <button
                      key={appt.id}
                      type="button"
                      onClick={() => {
                        close();
                        onGoToAppointment(appt.id);
                      }}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-right text-sm text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <span className="truncate">{appt.service_name}</span>
                      <span className="shrink-0 text-xs text-slate-400">{formatDateHe(appt.date)}</span>
                    </button>
                  ))}
                </div>
              )}
            </Popover>
          )}
          {item.data.file && (
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="h-3.5 w-3.5" /> הורד
            </Button>
          )}
          <Popover
            align="end"
            trigger={
              <span
                className="flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                title="עוד פעולות"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </span>
            }
          >
            {(close) => (
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onRename(item.data);
                  }}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-right text-sm text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" /> שינוי שם
                </button>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onDelete(item.data.id);
                  }}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-right text-sm text-danger transition-colors hover:bg-danger/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> מחיקה
                </button>
              </div>
            )}
          </Popover>
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
  const updateDocument = useStore((s) => s.updateDocument);
  const deleteDocument = useStore((s) => s.deleteDocument);
  const showToast = useStore((s) => s.showToast);

  const [activeCategories, setActiveCategories] = useState<DocumentCategory[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [requiredUploadDoc, setRequiredUploadDoc] = useState<PatientDocument | null>(null);
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

  // Pending items live exclusively in the banner above (pendingItems) — once
  // resolved they naturally lose that status and "graduate" into this list,
  // so nothing here duplicates a CTA already shown up top.
  const availableItems = useMemo(
    () => items.filter((i) => !(i.kind === "doc" && i.data.status === "ממתין למילוי")),
    [items]
  );

  const categoryFilteredItems =
    activeCategories.length === 0 ? availableItems : availableItems.filter((i) => activeCategories.includes(i.category));

  // "?appointment=" (arriving from the appointment card's "לצפייה מלאה
  // במסמכים" link, or the booking-confirmation receipt link) narrows the
  // same flat list to that visit's docs rather than switching to a
  // different, grouped view.
  const visibleItems = appointmentFilter
    ? categoryFilteredItems.filter((i) => i.kind === "doc" && documentAppointmentIds(i.data).includes(appointmentFilter))
    : categoryFilteredItems;

  const filteredAppointment = appointmentFilter ? appointments.find((a) => a.id === appointmentFilter) : undefined;

  function getLinkedAppointments(item: DisplayItem): Appointment[] {
    if (item.kind !== "doc") return [];
    return documentAppointmentIds(item.data)
      .map((id) => appointments.find((a) => a.id === id))
      .filter((a): a is Appointment => !!a);
  }

  function handleFillQuestionnaire(docId: string) {
    updateDocument(docId, { status: "זמין" });
    showToast("השאלון מולא בהצלחה", { variant: "success" });
  }

  function handleDownload() {
    showToast("הקובץ הורד (מצב הדגמה)", { variant: "success" });
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
                      <button
                        type="button"
                        onClick={() => router.push(`/client/appointments?appointment=${appt.id}`)}
                        className="truncate text-[11px] text-warning-text/70 hover:underline"
                      >
                        {appt.service_name} · {formatDateHe(appt.date)}
                      </button>
                    )}
                  </div>
                  {item.category === "questionnaire" ? (
                    <Button size="sm" className="shrink-0" onClick={() => handleFillQuestionnaire(item.data.id)}>
                      מלא עכשיו
                    </Button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRequiredUploadDoc(item.data)}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-warning-text/40 bg-white px-2.5 py-1 text-[11px] font-medium text-warning-text transition-colors hover:bg-warning-text hover:text-white"
                    >
                      <Upload className="h-3 w-3" /> העלאה
                    </button>
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
      </div>

      {visibleItems.length === 0 ? (
        <EmptyState icon={<FileText className="h-10 w-10" />} title="אין מסמכים להצגה" />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
          {visibleItems.map((item) => (
            <DocumentRow
              key={item.id}
              item={item}
              linkedAppointments={getLinkedAppointments(item)}
              onDownload={handleDownload}
              onRename={openRenameDialog}
              onDelete={(docId) => setDeleteDocId(docId)}
              onGoToAppointment={(appointmentId) => router.push(`/client/appointments?appointment=${appointmentId}`)}
            />
          ))}
        </div>
      )}

      <DocumentUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        patientId={patient?.id ?? ""}
        category="referral_personal"
        dialogTitle="מסמך חדש"
        description="הפניה או טופס אישי (למשל צילום ת&quot;ז)"
      />

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

      <RequiredDocumentUploadDialog
        open={!!requiredUploadDoc}
        onClose={() => setRequiredUploadDoc(null)}
        docId={requiredUploadDoc?.id ?? null}
        docTitle={requiredUploadDoc?.title}
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
