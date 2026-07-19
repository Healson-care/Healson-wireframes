"use client";

import { useRef, useState } from "react";
import { AlertCircle, FileText, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateDocumentFile } from "@/lib/file";

const DEFAULT_ACCEPT = ".pdf,.jpg,.jpeg,.png";

/** Drag-and-drop (or tap-to-browse) file picker — shared by every "upload a
 * document" dialog in the app instead of each one hand-rolling a bare
 * <input type="file">. Validates type/size up front (see validateDocumentFile)
 * so the limits are visible and enforced before the user even submits. */
export function FileDropzone({
  file,
  onFileChange,
  accept = DEFAULT_ACCEPT,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(selected: File | null) {
    if (!selected) {
      setError(null);
      onFileChange(null);
      return;
    }
    const validationError = validateDocumentFile(selected);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onFileChange(selected);
  }

  if (file) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-700">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">{file.name}</span>
        </span>
        <button
          type="button"
          onClick={() => handleFile(null)}
          className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        handleFile(e.dataTransfer.files?.[0] ?? null);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
        error
          ? "border-danger-border bg-danger-bg"
          : dragActive
          ? "border-primary bg-primary/5"
          : "border-slate-300 bg-slate-50 hover:border-primary hover:bg-primary/5"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full",
          error ? "bg-danger-bg text-danger-text" : "bg-primary/10 text-primary"
        )}
      >
        {error ? <AlertCircle className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      </span>
      <span className={cn("text-sm font-medium", error ? "text-danger-text" : "text-slate-600")}>
        {error ?? "גררו קובץ לכאן או לחצו להעלאה"}
      </span>
      {!error && <span className="text-xs text-slate-400">PDF, JPG או PNG · עד 4MB</span>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
