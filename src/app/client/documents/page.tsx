"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { FileText, Download, Plus, Upload, CalendarDays, Clock, Stethoscope, X } from "lucide-react";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Popover } from "@/components/ui/Popover";
import { fileToDataUrl } from "@/lib/file";
import { formatDateHe, cn } from "@/lib/utils";
import { DOCUMENT_CATEGORIES, DocumentCategory, LabReferral, PatientDocument } from "@/types";

type DisplayItem =
  | { kind: "doc"; id: string; category: DocumentCategory; created_date: string; data: PatientDocument }
  | { kind: "lab"; id: string; category: "lab_result"; created_date: string; data: LabReferral };

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
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

  const [activeCategory, setActiveCategory] = useState<DocumentCategory | "all">("all");
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

  // A link clicked from an appointment's card takes priority over the
  // category chips — it's a narrower, more specific view ("just the
  // documents for this visit").
  const filteredItems = appointmentFilter
    ? items.filter((i) => i.kind === "doc" && i.data.appointment_id === appointmentFilter)
    : activeCategory === "all"
    ? items
    : items.filter((i) => i.category === activeCategory);

  const filteredAppointment = appointmentFilter
    ? appointments.find((a) => a.id === appointmentFilter)
    : undefined;

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
        description="הפניות, טפסים אישיים, קבלות, סיכומי ביקור, שאלונים ותוצאות מעבדה — במקום אחד"
        actions={
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4" /> העלאת מסמך
          </Button>
        }
      />

      {appointmentFilter ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5 mb-4 text-sm">
          <span className="flex items-center gap-1.5 text-primary">
            <CalendarDays className="h-4 w-4" />
            מציג מסמכים לתור{filteredAppointment ? ` · ${filteredAppointment.service_name} · ${formatDateHe(filteredAppointment.date)}` : ""}
          </span>
          <button
            onClick={() => router.push("/client/documents")}
            className="flex items-center gap-1 rounded-full p-1 text-primary hover:bg-primary/10"
            title="הצג את כל המסמכים"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
          <FilterChip active={activeCategory === "all"} onClick={() => setActiveCategory("all")}>
            הכל
          </FilterChip>
          {DOCUMENT_CATEGORIES.map((c) => (
            <FilterChip key={c.id} active={activeCategory === c.id} onClick={() => setActiveCategory(c.id)}>
              {c.label}
            </FilterChip>
          ))}
        </div>
      )}

      {filteredItems.length === 0 ? (
        <EmptyState icon={<FileText className="h-10 w-10" />} title="אין מסמכים להצגה" />
      ) : (
        <div className="flex flex-col gap-3">
          {filteredItems.map((item, i) => {
            const categoryLabel = DOCUMENT_CATEGORIES.find((c) => c.id === item.category)?.label;
            const linkedAppointment =
              item.kind === "doc" && item.data.appointment_id
                ? appointments.find((a) => a.id === item.data.appointment_id)
                : undefined;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: i * 0.04 }}
              >
                <Card className="p-4">
                  {item.kind === "doc" ? (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900">{item.data.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{categoryLabel}</p>
                          {linkedAppointment && (
                            <Popover
                              trigger={
                                <span className="flex items-center gap-1 text-xs text-primary hover:underline mt-0.5">
                                  <CalendarDays className="h-3 w-3" />
                                  קשור לתור: {linkedAppointment.service_name} · {formatDateHe(linkedAppointment.date)}
                                </span>
                              }
                            >
                              {(close) => (
                                <div className="flex flex-col gap-2 text-sm">
                                  <p className="font-semibold text-slate-900">{linkedAppointment.service_name}</p>
                                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <Stethoscope className="h-3.5 w-3.5" /> {linkedAppointment.provider_name}
                                  </p>
                                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <CalendarDays className="h-3.5 w-3.5" /> {formatDateHe(linkedAppointment.date)}
                                    <Clock className="h-3.5 w-3.5" /> {linkedAppointment.time}
                                  </p>
                                  <div>
                                    <StatusBadge status={linkedAppointment.status} kind="appointment" />
                                  </div>
                                  <Button
                                    size="sm"
                                    className="mt-1 w-full"
                                    onClick={() => {
                                      close();
                                      router.push(`/client/appointments?appointment=${linkedAppointment.id}`);
                                    }}
                                  >
                                    לצפייה מלאה בתור
                                  </Button>
                                </div>
                              )}
                            </Popover>
                          )}
                          <p className="text-xs text-slate-400 mt-0.5">{formatDateHe(item.data.created_date)}</p>
                        </div>
                        {item.data.status && (
                          <Badge tone={item.data.status === "ממתין למילוי" ? "warning" : "success"}>
                            {item.data.status}
                          </Badge>
                        )}
                      </div>

                      {item.data.status === "ממתין למילוי" ? (
                        <div className="mt-3 flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => {
                              updateDocument(item.data.id, { status: "זמין" });
                              showToast("השאלון מולא בהצלחה", { variant: "success" });
                            }}
                          >
                            מלא עכשיו
                          </Button>
                        </div>
                      ) : item.data.file ? (
                        <div className="mt-3 flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => showToast("הקובץ הורד (מצב הדגמה)", { variant: "success" })}
                          >
                            <Download className="h-3.5 w-3.5" /> הורד
                          </Button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900">{item.data.test_types.join(", ")}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{item.data.provider_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{formatDateHe(item.data.created_date)}</p>
                        </div>
                        <StatusBadge status={item.data.status} kind="referral" />
                      </div>
                      {item.data.status === "הושלם" && (
                        <>
                          <p className="text-sm text-slate-600 mt-3 rounded-lg bg-slate-50 p-3">{item.data.results}</p>
                          <div className="mt-3 flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => showToast("הקובץ הורד (מצב הדגמה)", { variant: "success" })}
                            >
                              <Download className="h-3.5 w-3.5" /> הורד PDF
                            </Button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
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
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
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
