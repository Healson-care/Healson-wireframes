"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Misc";
import { generateId } from "@/lib/utils";
import { ReferralFormField, ReferralFormTemplate } from "@/types";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";

const FIELD_TYPES: ReferralFormField["type"][] = ["text", "textarea", "date", "number"];

export function ReferralFormsSection({
  forms,
  onChange,
}: {
  forms: ReferralFormTemplate[];
  onChange: (forms: ReferralFormTemplate[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [fields, setFields] = useState<ReferralFormField[]>([]);

  function openCreate() {
    setEditingId(null);
    setName("");
    setFields([]);
    setOpen(true);
  }

  function openEdit(form: ReferralFormTemplate) {
    setEditingId(form.id);
    setName(form.name);
    setFields(form.fields);
    setOpen(true);
  }

  function addField() {
    setFields([...fields, { id: generateId("field"), name: "", type: "text", required: false }]);
  }

  function handleSave() {
    const record: ReferralFormTemplate = { id: editingId ?? generateId("form"), name, fields };
    if (editingId) {
      onChange(forms.map((f) => (f.id === editingId ? record : f)));
    } else {
      onChange([...forms, record]);
    }
    setOpen(false);
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> תבנית הפניה חדשה
        </Button>
      </div>

      {forms.length === 0 ? (
        <EmptyState icon={<FileText className="h-10 w-10" />} title="אין תבניות הפניה" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {forms.map((f) => (
            <Card key={f.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-slate-900">{f.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{f.fields.length} שדות</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(f)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleteId(f.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <ul className="mt-2 text-xs text-slate-500 list-disc pr-4">
                {f.fields.map((field) => (
                  <li key={field.id}>
                    {field.name} ({field.type}) {field.required && "*"}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={editingId ? "עריכת תבנית" : "תבנית חדשה"} className="max-w-xl">
        <div className="flex flex-col gap-3">
          <Input label="שם התבנית" value={name} onChange={(e) => setName(e.target.value)} required />
          <p className="text-sm font-medium text-slate-700">שדות מותאמים</p>
          {fields.map((field, idx) => (
            <div key={field.id} className="flex items-end gap-2">
              <Input
                placeholder="שם שדה"
                value={field.name}
                onChange={(e) => {
                  const next = [...fields];
                  next[idx] = { ...field, name: e.target.value };
                  setFields(next);
                }}
              />
              <Select
                value={field.type}
                onChange={(e) => {
                  const next = [...fields];
                  next[idx] = { ...field, type: e.target.value as ReferralFormField["type"] };
                  setFields(next);
                }}
                className="w-32"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => {
                    const next = [...fields];
                    next[idx] = { ...field, required: e.target.checked };
                    setFields(next);
                  }}
                  className="h-4 w-4 rounded border-slate-300 accent-primary"
                />
                חובה
              </label>
              <button
                type="button"
                onClick={() => setFields(fields.filter((f) => f.id !== field.id))}
                className="p-2 text-red-500 hover:bg-red-50 rounded-md"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addField} type="button">
            <Plus className="h-3.5 w-3.5" /> הוסף שדה
          </Button>
          <Button onClick={handleSave}>שמור תבנית</Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="מחיקת תבנית"
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteId) onChange(forms.filter((f) => f.id !== deleteId));
        }}
      />
    </div>
  );
}
