"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { useStore } from "@/lib/store";
import { fileToDataUrl } from "@/lib/file";

/** Fulfils one specific "ממתין למילוי" checklist item (a required document or
 * lab-referral-style upload) by attaching a file directly to its existing
 * placeholder record — used both from the "פעולות נדרשות" banner on
 * /client/documents and the per-appointment checklist on /client/appointments.
 * Deliberately has no appointment-linking picker like DocumentUploadDialog:
 * the record being fulfilled is already tied to its appointment/context, so
 * there's nothing to choose. */
export function RequiredDocumentUploadDialog({
  open,
  onClose,
  docId,
  docTitle,
}: {
  open: boolean;
  onClose: () => void;
  docId: string | null;
  docTitle?: string;
}) {
  const updateDocument = useStore((s) => s.updateDocument);
  const showToast = useStore((s) => s.showToast);

  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  // Reset the picked file each time the dialog opens for a (possibly
  // different) checklist item, without remounting the component.
  if (open && !wasOpen) {
    setWasOpen(true);
    setFile(null);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !docId) return;
    setSubmitting(true);
    updateDocument(docId, {
      status: "זמין",
      file: { file_name: file.name, uploaded_at: new Date().toISOString(), data_url: await fileToDataUrl(file) },
    });
    setSubmitting(false);
    onClose();
    showToast("המסמך הועלה בהצלחה", { variant: "success" });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={docTitle ? `העלאת ${docTitle}` : "העלאת מסמך"}
      description="המסמך יקושר אוטומטית לתור הרלוונטי"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">קובץ</label>
          <FileDropzone file={file} onFileChange={setFile} />
        </div>
        <Button type="submit" loading={submitting} disabled={!file} className="mt-2">
          <Upload className="h-4 w-4" /> העלה
        </Button>
      </form>
    </Dialog>
  );
}
