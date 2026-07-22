"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/ui/Misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { SkillDomain, SkillSubdomain } from "@/types";
import { Plus, Pencil, Trash2 } from "lucide-react";

/** Taxonomy management (ADM-03) — the medical domains / sub-domains both item
 * catalogs hang off. Separated from /catalog so the price-list work and the
 * taxonomy work don't share one crowded screen. */
export default function MedicalTreePage() {
  return (
    <AppLayout>
      <PageHeader
        title="תחומים רפואיים"
        description="ניהול הטקסונומיה — תחומים ותתי-תחומים שאליהם משויכים הפריטים בקטלוג מב״ר ובקטלוג הילסון"
      />
      <div className="flex flex-col gap-5">
        <DomainsManager />
        <SubdomainsManager />
      </div>
    </AppLayout>
  );
}

function DomainsManager() {
  const skillDomains = useStore((s) => s.skillDomains);
  const skillSubdomains = useStore((s) => s.skillSubdomains);
  const catalog = useStore((s) => s.catalog);
  const addSkillDomain = useStore((s) => s.addSkillDomain);
  const updateSkillDomain = useStore((s) => s.updateSkillDomain);
  const deleteSkillDomain = useStore((s) => s.deleteSkillDomain);
  const showToast = useStore((s) => s.showToast);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SkillDomain | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name_he: "", emoji: "", slug: "" });

  const deleteImpact = deleteId
    ? {
        subdomains: skillSubdomains.filter((sd) => sd.domain_id === deleteId).length,
        items: catalog.filter((c) => c.skill_domain_id === deleteId).length,
      }
    : null;

  function openCreate() {
    setEditing(null);
    setForm({ name_he: "", emoji: "", slug: "" });
    setOpen(true);
  }
  function openEdit(d: SkillDomain) {
    setEditing(d);
    setForm({ name_he: d.name_he, emoji: d.emoji ?? "", slug: d.slug });
    setOpen(true);
  }
  function handleSave() {
    if (editing) {
      updateSkillDomain(editing.id, form);
      showToast("התחום עודכן", { variant: "success" });
    } else {
      addSkillDomain(form);
      showToast("תחום חדש נוסף", { variant: "success" });
    }
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between flex-row">
        <CardTitle>תחומים רפואיים (Domains)</CardTitle>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> תחום חדש
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable<SkillDomain>
          rows={skillDomains}
          rowKey={(d) => d.id}
          emptyTitle="אין תחומים מוגדרים"
          columns={
            [
              { key: "emoji", header: "", render: (d) => <span className="text-lg">{d.emoji}</span> },
              { key: "name", header: "שם", render: (d) => <span className="font-medium text-slate-900">{d.name_he}</span> },
              { key: "slug", header: "מזהה", render: (d) => <span className="text-xs text-slate-400 font-mono">{d.slug}</span> },
            ] satisfies DataTableColumn<SkillDomain>[]
          }
          rowActions={(d) => (
            <>
              <button onClick={() => openEdit(d)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setDeleteId(d.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        />
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "עריכת תחום" : "תחום חדש"}>
        <div className="flex flex-col gap-3">
          <Input label="שם התחום" value={form.name_he} onChange={(e) => setForm({ ...form, name_he: e.target.value })} required />
          <Input label="אימוג'י" value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} />
          <Input label="מזהה (slug)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
          <Button onClick={handleSave}>שמור</Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="מחיקת תחום"
        description={
          deleteImpact && (deleteImpact.subdomains > 0 || deleteImpact.items > 0)
            ? `יימחקו גם ${deleteImpact.subdomains} תתי-תחומים ו-${deleteImpact.items} פריטי קטלוג המשויכים לתחום זה.`
            : "אין תתי-תחומים או פריטי קטלוג המשויכים לתחום זה."
        }
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteId) {
            deleteSkillDomain(deleteId);
            showToast("התחום נמחק", { variant: "success" });
          }
        }}
      />
    </Card>
  );
}

function SubdomainsManager() {
  const skillDomains = useStore((s) => s.skillDomains);
  const skillSubdomains = useStore((s) => s.skillSubdomains);
  const catalog = useStore((s) => s.catalog);
  const addSkillSubdomain = useStore((s) => s.addSkillSubdomain);
  const updateSkillSubdomain = useStore((s) => s.updateSkillSubdomain);
  const deleteSkillSubdomain = useStore((s) => s.deleteSkillSubdomain);
  const showToast = useStore((s) => s.showToast);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SkillSubdomain | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name_he: "", slug: "", domain_id: skillDomains[0]?.id ?? "" });

  const deleteItemCount = deleteId ? catalog.filter((c) => c.skill_subdomain_id === deleteId).length : 0;

  function openCreate() {
    setEditing(null);
    setForm({ name_he: "", slug: "", domain_id: skillDomains[0]?.id ?? "" });
    setOpen(true);
  }
  function openEdit(sd: SkillSubdomain) {
    setEditing(sd);
    setForm({ name_he: sd.name_he, slug: sd.slug, domain_id: sd.domain_id });
    setOpen(true);
  }
  function handleSave() {
    if (editing) {
      updateSkillSubdomain(editing.id, form);
      showToast("תת-התחום עודכן", { variant: "success" });
    } else {
      addSkillSubdomain(form);
      showToast("תת-תחום חדש נוסף", { variant: "success" });
    }
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between flex-row">
        <CardTitle>תתי-תחומים (Sub-domains)</CardTitle>
        <Button size="sm" onClick={openCreate} disabled={skillDomains.length === 0}>
          <Plus className="h-4 w-4" /> תת-תחום חדש
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable<SkillSubdomain>
          rows={skillSubdomains}
          rowKey={(sd) => sd.id}
          emptyTitle="אין תתי-תחומים מוגדרים"
          columns={
            [
              { key: "name", header: "שם", render: (sd) => <span className="font-medium text-slate-900">{sd.name_he}</span> },
              {
                key: "domain",
                header: "תחום",
                render: (sd) => (
                  <span className="text-slate-600">{skillDomains.find((d) => d.id === sd.domain_id)?.name_he ?? "—"}</span>
                ),
              },
              { key: "slug", header: "מזהה", render: (sd) => <span className="text-xs text-slate-400 font-mono">{sd.slug}</span> },
            ] satisfies DataTableColumn<SkillSubdomain>[]
          }
          rowActions={(sd) => (
            <>
              <button onClick={() => openEdit(sd)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setDeleteId(sd.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        />
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "עריכת תת-תחום" : "תת-תחום חדש"}>
        <div className="flex flex-col gap-3">
          <Select label="תחום" value={form.domain_id} onChange={(e) => setForm({ ...form, domain_id: e.target.value })} required>
            {skillDomains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name_he}
              </option>
            ))}
          </Select>
          <Input label="שם תת-התחום" value={form.name_he} onChange={(e) => setForm({ ...form, name_he: e.target.value })} required />
          <Input label="מזהה (slug)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
          <Button onClick={handleSave}>שמור</Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="מחיקת תת-תחום"
        description={
          deleteItemCount > 0
            ? `יימחקו גם ${deleteItemCount} פריטי קטלוג המשויכים לתת-תחום זה.`
            : "אין פריטי קטלוג המשויכים לתת-תחום זה."
        }
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteId) {
            deleteSkillSubdomain(deleteId);
            showToast("תת-התחום נמחק", { variant: "success" });
          }
        }}
      />
    </Card>
  );
}
