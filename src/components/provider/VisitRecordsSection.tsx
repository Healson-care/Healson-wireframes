"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Misc";
import { formatDateHe } from "@/lib/utils";
import { VisitRecord } from "@/types";
import { ClipboardList, FileText, Plus, Upload } from "lucide-react";

/** A provider's own visit summaries for a single patient — modeled on the
 * upload pattern in provider/referrals/page.tsx. Callers must already have
 * filtered `records` down to this provider + this patient (see
 * /provider/patients/[id]) — this component doesn't do any scoping itself. */
export function VisitRecordsSection({
  records,
  onAdd,
}: {
  records: VisitRecord[];
  onAdd: (data: { visit_date: string; summary: string; instructions?: string; file?: File }) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState("");
  const [instructions, setInstructions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onAdd({ visit_date: visitDate, summary, instructions: instructions || undefined, file: file ?? undefined });
    setSaving(false);
    setOpen(false);
    setSummary("");
    setInstructions("");
    setFile(null);
    setVisitDate(new Date().toISOString().slice(0, 10));
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> סיכום ביקור חדש
        </Button>
      </div>

      {records.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-10 w-10" />} title="אין סיכומי ביקור עדיין" />
      ) : (
        <div className="flex flex-col gap-3">
          {records.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">{formatDateHe(r.visit_date)}</p>
              </div>
              <p className="text-sm text-slate-700 mt-1.5 whitespace-pre-line">{r.summary}</p>
              {r.instructions && (
                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs font-medium text-slate-500 mb-0.5">הנחיות למטופל</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{r.instructions}</p>
                </div>
              )}
              {r.provider_documents && r.provider_documents.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.provider_documents.map((f, i) => (
                    <a
                      key={i}
                      href={f.data_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-primary hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" /> {f.file_name}
                    </a>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="סיכום ביקור חדש">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm text-slate-700">
            תאריך ביקור
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
            />
          </label>
          <Textarea label="סיכום הביקור" value={summary} onChange={(e) => setSummary(e.target.value)} required />
          <Textarea label="הנחיות למטופל (אופציונלי)" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          <label className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 cursor-pointer hover:border-primary">
            <Upload className="h-4 w-4" />
            {file ? file.name : "צירוף מסמך (PDF / JPG / PNG) — אופציונלי"}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <Button onClick={handleSave} disabled={!summary} loading={saving}>
            שמור סיכום ביקור
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
