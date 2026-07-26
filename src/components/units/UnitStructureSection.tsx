"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/Misc";
import { BranchArraysManager } from "@/components/units/BranchArraysManager";
import { OrganizationBranch } from "@/types";
import { Layers, MapPinned, Network, Pencil, Plus, Trash2 } from "lucide-react";

// The unit's own structure screen in the provider portal (§PRV-08): the unit
// creates and manages its סניפים and, within each, its מערכים (service lines).
// Resources (מכשירים / נותני שירות) are then assigned to a מערך on their own
// screens. Mirrors the admin OrganizationUnitsTab, but scoped to one unit.
export function UnitStructureSection({ unitId }: { unitId: string }) {
  const organizationBranches = useStore((s) => s.organizationBranches);
  const serviceArrays = useStore((s) => s.serviceArrays);
  const addOrganizationBranch = useStore((s) => s.addOrganizationBranch);
  const updateOrganizationBranch = useStore((s) => s.updateOrganizationBranch);
  const deleteOrganizationBranch = useStore((s) => s.deleteOrganizationBranch);
  const showToast = useStore((s) => s.showToast);
  const branches = organizationBranches.filter((b) => b.unit_id === unitId);
  const arrayCount = serviceArrays.filter((a) => branches.some((b) => b.id === a.branch_id)).length;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationBranch | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openAdd = () => {
    setEditing(null);
    setName("");
    setCity("");
    setAddress("");
    setPhone("");
    setDialogOpen(true);
  };
  const openEdit = (b: OrganizationBranch) => {
    setEditing(b);
    setName(b.name);
    setCity(b.city ?? "");
    setAddress(b.address ?? "");
    setPhone(b.contact_phone ?? "");
    setDialogOpen(true);
  };
  const save = () => {
    const data = {
      name,
      city: city || undefined,
      address: address || undefined,
      contact_phone: phone || undefined,
    };
    if (editing) {
      updateOrganizationBranch(editing.id, data);
      showToast("פרטי הסניף עודכנו", { variant: "success" });
    } else {
      const r = addOrganizationBranch(unitId, data);
      if (!r.ok) {
        showToast(r.error ?? "הוספת הסניף נכשלה", { variant: "destructive" });
        return;
      }
      showToast("הסניף נוסף", { variant: "success" });
    }
    setDialogOpen(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-slate-400" />
          <div>
            <p className="text-sm font-medium text-slate-900">מבנה היחידה</p>
            <p className="text-xs text-slate-500">
              {branches.length} סניפים · {arrayCount} מערכים
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" /> הוספת סניף
        </Button>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-info-border bg-info-bg px-3 py-2.5 text-xs leading-relaxed text-info-text">
        <Layers className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          המבנה: <b>יחידה</b> → <b>סניפים</b> (אתרים פיזיים) → <b>מערכים</b> (קווי שירות: הדמיה, ייעוצים, בדיקות…) →{" "}
          <b>עמדות</b>. כאן מנהלים את הסניפים; המערכים והעמדות שבתוכם מנוהלים בלשונית{" "}
          <Link href="/provider/profile/arrays" className="font-semibold underline">
            מערכים
          </Link>
          .
        </span>
      </div>

      {branches.length === 0 ? (
        <EmptyState
          icon={<MapPinned className="h-10 w-10" />}
          title="אין עדיין סניפים"
          description="הוסיפו סניף (אתר פיזי של היחידה), ואז הגדירו בו מערכים."
          action={
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4" /> הוספת סניף
            </Button>
          }
        />
      ) : (
        // Two columns: a branch card holds a name, an address and a short list
        // of its מערכים — full-width rows left most of the screen empty.
        <div className="grid gap-3 lg:grid-cols-2">
          {branches.map((b) => (
            <Card key={b.id} className="flex flex-col p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <MapPinned className="h-4.5 w-4.5" />
                    </span>
                    {b.name}
                  </p>
                  {(b.city || b.address || b.contact_phone) && (
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                      {[b.city, b.address].filter(Boolean).join(" · ")}
                      {b.contact_phone && (
                        <>
                          <br />
                          {b.contact_phone}
                        </>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => openEdit(b)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    title="עריכת סניף"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteId(b.id)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    title="מחיקת סניף"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <BranchArraysManager branch={b} />
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "עריכת סניף" : "סניף חדש"}
        description={editing ? undefined : "סניף הוא אתר פיזי של היחידה."}
      >
        <div className="flex flex-col gap-3">
          <Input
            label="שם הסניף"
            placeholder="לדוגמה: סניף תל אביב"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="עיר (לא חובה)" value={city} onChange={(e) => setCity(e.target.value)} />
            <Input label="כתובת (לא חובה)" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <Input label="טלפון (לא חובה)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button onClick={save} disabled={!name.trim()}>
            {editing ? "שמור" : "הוסף סניף"}
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="מחיקת סניף"
        description="הסניף יימחק, ואיתו המערכים שהוגדרו בו. משאבים ששויכו יחזרו ל'ללא מערך'."
        destructive
        confirmLabel="מחק סניף"
        onConfirm={() => {
          if (deleteId) {
            const r = deleteOrganizationBranch(deleteId);
            if (!r.ok) showToast(r.error ?? "מחיקת הסניף נכשלה", { variant: "destructive" });
            else showToast("הסניף נמחק", { variant: "success" });
          }
          setDeleteId(null);
        }}
      />
    </div>
  );
}
