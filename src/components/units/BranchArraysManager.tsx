"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import {
  OrganizationBranch,
  ServiceArray,
  ServiceArrayType,
  SERVICE_ARRAY_TYPES,
  SERVICE_ARRAY_TYPE_LABELS,
} from "@/types";
import { Layers, Plus, Pencil, Trash2 } from "lucide-react";

// מערכים (service lines) inside a single branch — the shared CRUD used both in
// the admin org view and in the unit's own provider portal. A מערך is a
// first-class service line chosen from the predefined SERVICE_ARRAY_TYPES
// catalog; the unit then assigns each resource (מכשיר/נותן שירות) to one.
export function BranchArraysManager({ branch }: { branch: OrganizationBranch }) {
  const serviceArrays = useStore((s) => s.serviceArrays);
  const addServiceArray = useStore((s) => s.addServiceArray);
  const updateServiceArray = useStore((s) => s.updateServiceArray);
  const deleteServiceArray = useStore((s) => s.deleteServiceArray);
  const showToast = useStore((s) => s.showToast);
  const arrays = serviceArrays.filter((a) => a.branch_id === branch.id);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceArray | null>(null);
  const [type, setType] = useState<ServiceArrayType>("imaging");
  const [name, setName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openAdd = () => {
    setEditing(null);
    setType("imaging");
    setName("");
    setDialogOpen(true);
  };
  const openEdit = (a: ServiceArray) => {
    setEditing(a);
    setType(a.type);
    setName(a.name);
    setDialogOpen(true);
  };
  const save = () => {
    if (editing) {
      updateServiceArray(editing.id, { type, name: name.trim() || undefined });
      showToast("המערך עודכן", { variant: "success" });
    } else {
      const r = addServiceArray(branch.id, { type, name: name.trim() || undefined });
      if (!r.ok) {
        showToast(r.error ?? "הוספת המערך נכשלה", { variant: "destructive" });
        return;
      }
      showToast("המערך נוסף לסניף", { variant: "success" });
    }
    setDialogOpen(false);
  };

  return (
    <div className="mt-2 border-t border-slate-100 pt-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
          <Layers className="h-3 w-3 text-primary" /> מערכים ({arrays.length})
        </p>
        <button
          onClick={openAdd}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/5"
        >
          <Plus className="h-3 w-3" /> מערך
        </button>
      </div>
      {arrays.length === 0 ? (
        <p className="mt-1 text-[11px] text-slate-400">אין עדיין מערכים בסניף זה</p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {arrays.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-1 pr-2 text-[11px] text-slate-700"
            >
              <Layers className="h-3 w-3 text-slate-400" />
              {a.name}
              <span className="text-slate-400">· {SERVICE_ARRAY_TYPE_LABELS[a.type]}</span>
              <button
                onClick={() => openEdit(a)}
                className="rounded p-0.5 text-slate-400 hover:text-slate-600"
                title="עריכת מערך"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={() => setDeleteId(a.id)}
                className="rounded p-0.5 text-slate-400 hover:text-red-500"
                title="מחיקת מערך"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "עריכת מערך" : "מערך חדש בסניף"}
        description={editing ? undefined : "מערך = קו שירות בתוך הסניף, נבחר מקטלוג מוגדר מראש."}
      >
        <div className="flex flex-col gap-3">
          <Select label="סוג המערך" value={type} onChange={(e) => setType(e.target.value as ServiceArrayType)}>
            {SERVICE_ARRAY_TYPES.map((t) => (
              <option key={t} value={t}>
                {SERVICE_ARRAY_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <Input
            label="שם תצוגה (לא חובה)"
            placeholder={SERVICE_ARRAY_TYPE_LABELS[type]}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button onClick={save}>{editing ? "שמור" : "הוסף מערך"}</Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="מחיקת מערך"
        description="המערך יימחק, ומשאבים ששויכו אליו יחזרו ל'ללא מערך'."
        destructive
        confirmLabel="מחק מערך"
        onConfirm={() => {
          if (deleteId) {
            deleteServiceArray(deleteId);
            showToast("המערך נמחק", { variant: "success" });
          }
          setDeleteId(null);
        }}
      />
    </div>
  );
}
