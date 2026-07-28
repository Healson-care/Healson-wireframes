"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { useStore } from "@/lib/store";
import { fileToDataUrl } from "@/lib/file";
import { formatDateHe } from "@/lib/utils";
import { DocumentCategory } from "@/types";

/** Shared "upload a document" dialog — used both for the patient's general
 * "מסמך חדש" (no appointment preselected) and for "הוספת מסמך אחר" opened
 * from a specific appointment card (that appointment preselected, but still
 * editable: the patient can also link additional appointments, or uncheck it
 * for a general document). */
export function DocumentUploadDialog({
  open,
  onClose,
  patientId,
  category = "other",
  dialogTitle = "מסמך חדש",
  description,
  defaultAppointmentIds = [],
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
  category?: DocumentCategory;
  dialogTitle?: string;
  description?: string;
  defaultAppointmentIds?: string[];
}) {
  const appointments = useStore((s) => s.appointments);
  const addDocument = useStore((s) => s.addDocument);
  const showToast = useStore((s) => s.showToast);

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultAppointmentIds);
  const [submitting, setSubmitting] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  // Re-seed the form (including the preselected appointment(s) for *this*
  // open) each time the dialog opens, without remounting the component.
  if (open && !wasOpen) {
    setWasOpen(true);
    setTitle("");
    setFile(null);
    setSelectedIds(defaultAppointmentIds);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const patientAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.created_by_id === patientId)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [appointments, patientId]
  );

  function toggleAppointment(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    addDocument({
      patient_id: patientId,
      category,
      title: title.trim(),
      uploaded_by: "patient",
      appointment_ids: selectedIds.length > 0 ? selectedIds : undefined,
      file: file
        ? { file_name: file.name, uploaded_at: new Date().toISOString(), data_url: await fileToDataUrl(file) }
        : undefined,
    });
    setSubmitting(false);
    onClose();
    showToast("המסמך הועלה בהצלחה", { variant: "success" });
  }

  return (
    <Dialog open={open} onClose={onClose} title={dialogTitle} description={description}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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

        {patientAppointments.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">שיוך לתורים (אופציונלי)</label>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
              {patientAppointments.map((appt) => (
                <label
                  key={appt.id}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(appt.id)}
                    onChange={() => toggleAppointment(appt.id)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 accent-primary"
                  />
                  <span className="truncate text-slate-700">
                    {appt.service_name} · {appt.date ? formatDateHe(appt.date) : "כל מועד פנוי"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <Button type="submit" loading={submitting} className="mt-2">
          <Upload className="h-4 w-4" /> העלה
        </Button>
      </form>
    </Dialog>
  );
}
