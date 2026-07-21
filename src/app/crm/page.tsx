"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, Avatar, StatCard } from "@/components/ui/Misc";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { PatientForm, PatientFormValues } from "@/components/admin/PatientForm";
import { LeadForm, LeadFormValues } from "@/components/admin/LeadForm";
import { KUPOT, LEAD_STATUSES, PATIENT_STATUSES, Patient, Lead, LeadStatus } from "@/types";
import { cn } from "@/lib/utils";
import { Plus, Search, Users, X, Pencil, Trash2, ArrowLeftRight, FolderOpen, LayoutGrid, List, Phone } from "lucide-react";

function CrmPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "leads" ? "leads" : "patients";

  const patients = useStore((s) => s.patients);
  const leads = useStore((s) => s.leads);
  const addPatient = useStore((s) => s.addPatient);
  const updatePatient = useStore((s) => s.updatePatient);
  const deletePatient = useStore((s) => s.deletePatient);
  const addLead = useStore((s) => s.addLead);
  const updateLead = useStore((s) => s.updateLead);
  const deleteLead = useStore((s) => s.deleteLead);
  const convertLead = useStore((s) => s.convertLead);
  const showToast = useStore((s) => s.showToast);
  const appointments = useStore((s) => s.appointments);
  const labReferrals = useStore((s) => s.labReferrals);

  const newLeads = leads.filter((l) => (l.status || "חדש") === "חדש").length;

  return (
    <AppLayout>
      <PageHeader
        title="CRM"
        description="ניהול מטופלים ולידים"
        actions={
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>{patients.length} מטופלים</span>
            <span>·</span>
            <span>{leads.length} לידים</span>
            {newLeads > 0 && <Badge tone="blue">{newLeads} לידים חדשים</Badge>}
          </div>
        }
      />

      <Tabs defaultValue={initialTab} onValueChange={(v) => router.replace(`/crm?tab=${v}`)}>
        <TabsList className="mb-5 max-w-xs">
          <TabsTrigger value="patients" icon={<Users className="h-3.5 w-3.5" />}>מטופלים</TabsTrigger>
          <TabsTrigger value="leads" icon={<ArrowLeftRight className="h-3.5 w-3.5" />}>לידים</TabsTrigger>
        </TabsList>

        <TabsContent value="patients">
          <PatientsTab
            patients={patients}
            appointments={appointments}
            labReferrals={labReferrals}
            addPatient={addPatient}
            updatePatient={updatePatient}
            deletePatient={deletePatient}
            showToast={showToast}
          />
        </TabsContent>

        <TabsContent value="leads">
          <LeadsTab
            leads={leads}
            addLead={addLead}
            updateLead={updateLead}
            deleteLead={deleteLead}
            convertLead={convertLead}
            showToast={showToast}
          />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

export default function CrmPage() {
  return (
    <Suspense fallback={<AppLayout>{null}</AppLayout>}>
      <CrmPageContent />
    </Suspense>
  );
}

function PatientsTab({
  patients,
  appointments,
  labReferrals,
  addPatient,
  updatePatient,
  deletePatient,
  showToast,
}: {
  patients: Patient[];
  appointments: ReturnType<typeof useStore.getState>["appointments"];
  labReferrals: ReturnType<typeof useStore.getState>["labReferrals"];
  addPatient: ReturnType<typeof useStore.getState>["addPatient"];
  updatePatient: ReturnType<typeof useStore.getState>["updatePatient"];
  deletePatient: ReturnType<typeof useStore.getState>["deletePatient"];
  showToast: ReturnType<typeof useStore.getState>["showToast"];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [kupahFilter, setKupahFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editPatient, setEditPatient] = useState<Patient | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const now = new Date();
  const activeCount = patients.filter((p) => (p.status || "פעיל") === "פעיל").length;
  const newThisMonth = patients.filter((p) => {
    if (!p.created_date) return false;
    const d = new Date(p.created_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const filtered = useMemo(() => {
    return patients.filter((p) => {
      if (kupahFilter && p.kupah !== kupahFilter) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (!query) return true;
      const q = query.trim();
      return (
        p.full_name.includes(q) ||
        (p.id_number ?? "").includes(q) ||
        (p.phone ?? "").includes(q) ||
        (p.parent_name ?? "").includes(q)
      );
    });
  }, [patients, query, kupahFilter, statusFilter]);

  function apptCount(id: string) {
    return appointments.filter((a) => a.created_by_id === id).length;
  }
  function referralCount(id: string) {
    return labReferrals.filter((r) => r.patient_id === id).length;
  }

  function handleSubmit(values: PatientFormValues) {
    const patch = {
      ...values,
      gender: values.gender || undefined,
      k_level: values.k_level || undefined,
      b_insurance_company: values.has_b_insurance ? values.b_insurance_company : undefined,
      b_policy_number: values.has_b_insurance ? values.b_policy_number : undefined,
      address: values.address || undefined,
    };
    if (editPatient) {
      updatePatient(editPatient.id, patch);
      showToast("פרטי המטופל עודכנו", { variant: "success" });
    } else {
      addPatient(patch);
      showToast("המטופל נוסף בהצלחה", { variant: "success" });
    }
    setFormOpen(false);
    setEditPatient(null);
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-5 max-w-lg">
        <StatCard label="סה״כ" value={patients.length} tone="blue" />
        <StatCard label="פעילים" value={activeCount} tone="green" />
        <StatCard label="חדשים החודש" value={newThisMonth} tone="amber" />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Input
          placeholder="חיפוש לפי שם, ת.ז, טלפון..."
          icon={<Search className="h-4 w-4" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-1.5 flex-wrap">
          {KUPOT.map((k) => (
            <FilterChip key={k} active={kupahFilter === k} onClick={() => setKupahFilter(kupahFilter === k ? null : k)}>
              {k}
            </FilterChip>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {PATIENT_STATUSES.map((s) => (
            <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(statusFilter === s ? null : s)}>
              {s}
            </FilterChip>
          ))}
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditPatient(null);
            setFormOpen(true);
          }}
          className="mr-auto"
        >
          <Plus className="h-4 w-4" /> מטופל חדש
        </Button>
      </div>

      <DataTable<Patient>
        rows={filtered}
        rowKey={(p) => p.id}
        emptyIcon={<Users className="h-10 w-10" />}
        emptyTitle="אין מטופלים"
        emptyDescription="הוסף מטופל חדש או שנה את הסינון"
        selectable
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        bulkActions={(ids, clear) => (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              setBulkDeleteIds(ids);
              clear();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> מחק נבחרים
          </Button>
        )}
        columns={
          [
            {
              key: "name",
              header: "מטופל",
              sortable: true,
              sortValue: (p) => p.full_name,
              render: (p) => (
                <div className="flex items-center gap-3">
                  <Avatar name={p.full_name} />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-slate-900">{p.full_name}</p>
                      {p.processing_restricted && <Badge tone="red">עיבוד מוגבל</Badge>}
                    </div>
                    <p className="text-xs text-slate-400">{p.id_number}</p>
                  </div>
                </div>
              ),
            },
            {
              key: "contact",
              header: "פרטי קשר",
              render: (p) => (
                <div>
                  <p className="text-slate-700">{p.phone}</p>
                  <p className="text-xs text-slate-400">{p.email}</p>
                </div>
              ),
            },
            {
              key: "kupah",
              header: "קופה",
              sortable: true,
              sortValue: (p) => p.kupah,
              render: (p) => <Badge tone="slate">{p.kupah}</Badge>,
            },
            {
              key: "status",
              header: "סטטוס",
              sortable: true,
              sortValue: (p) => p.status,
              render: (p) => <StatusBadge status={p.status} kind="patient" />,
            },
            {
              key: "activity",
              header: "פעילות",
              render: (p) => (
                <div className="flex gap-3 text-xs text-slate-500">
                  <span>{apptCount(p.id)} תורים</span>
                  <span>{referralCount(p.id)} הפניות</span>
                </div>
              ),
            },
          ] satisfies DataTableColumn<Patient>[]
        }
        rowActions={(p) => (
          <>
            <button
              onClick={() => router.push(`/crm/${p.id}`)}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
              title="תיק מטופל"
            >
              <FolderOpen className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setEditPatient(p);
                setFormOpen(true);
              }}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      />

      <PatientForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        initial={
          editPatient
            ? {
                full_name: editPatient.full_name,
                email: editPatient.email ?? "",
                phone: editPatient.phone ?? "",
                id_number: editPatient.id_number ?? "",
                id_document_type: editPatient.id_document_type ?? "id",
                date_of_birth: editPatient.date_of_birth ?? "",
                gender: editPatient.gender ?? "",
                parent_name: editPatient.parent_name ?? "",
                kupah: editPatient.kupah,
                k_level: editPatient.k_level ?? "",
                has_b_insurance: editPatient.has_b_insurance ?? false,
                b_insurance_company: editPatient.b_insurance_company ?? "",
                b_policy_number: editPatient.b_policy_number ?? "",
                address: editPatient.address ?? "",
                status: editPatient.status,
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="מחיקת מטופל"
        description="פעולה זו אינה הפיכה."
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteId) {
            deletePatient(deleteId);
            showToast("המטופל נמחק", { variant: "success" });
          }
        }}
      />

      <ConfirmDialog
        open={!!bulkDeleteIds}
        onClose={() => setBulkDeleteIds(null)}
        title={`מחיקת ${bulkDeleteIds?.length ?? 0} מטופלים`}
        description="פעולה זו אינה הפיכה."
        destructive
        confirmLabel="מחק נבחרים"
        onConfirm={() => {
          bulkDeleteIds?.forEach((id) => deletePatient(id));
          showToast("המטופלים הנבחרים נמחקו", { variant: "success" });
          setSelectedIds(new Set());
        }}
      />
    </div>
  );
}

function LeadsTab({
  leads,
  addLead,
  updateLead,
  deleteLead,
  convertLead,
  showToast,
}: {
  leads: ReturnType<typeof useStore.getState>["leads"];
  addLead: ReturnType<typeof useStore.getState>["addLead"];
  updateLead: ReturnType<typeof useStore.getState>["updateLead"];
  deleteLead: ReturnType<typeof useStore.getState>["deleteLead"];
  convertLead: ReturnType<typeof useStore.getState>["convertLead"];
  showToast: ReturnType<typeof useStore.getState>["showToast"];
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editLead, setEditLead] = useState<(typeof leads)[number] | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"table" | "kanban">("table");

  const filtered = leads.filter((l) => {
    if (statusFilter && l.status !== statusFilter) return false;
    if (!query) return true;
    return l.full_name.includes(query);
  });

  function handleSubmit(values: LeadFormValues) {
    if (editLead) {
      updateLead(editLead.id, values);
      showToast("הליד עודכן", { variant: "success" });
    } else {
      addLead(values);
      showToast("הליד נוסף בהצלחה", { variant: "success" });
    }
    setFormOpen(false);
    setEditLead(null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Input
          placeholder="חיפוש לפי שם..."
          icon={<Search className="h-4 w-4" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-1.5 flex-wrap">
          {LEAD_STATUSES.map((s) => (
            <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(statusFilter === s ? null : s)}>
              {s}
            </FilterChip>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 mr-auto">
          <button
            onClick={() => setView("table")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              view === "table" ? "bg-primary text-white" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <List className="h-3.5 w-3.5" /> טבלה
          </button>
          <button
            onClick={() => setView("kanban")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              view === "kanban" ? "bg-primary text-white" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> פייפליין
          </button>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditLead(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> ליד חדש
        </Button>
      </div>

      {view === "kanban" ? (
        <LeadKanban
          leads={filtered}
          onStatusChange={(id, status) => {
            updateLead(id, { status });
            showToast("סטטוס הליד עודכן", { variant: "success" });
          }}
          onEdit={(l) => {
            setEditLead(l);
            setFormOpen(true);
          }}
        />
      ) : (
      <DataTable<Lead>
        rows={filtered}
        rowKey={(l) => l.id}
        emptyTitle="אין לידים"
        selectable
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        bulkActions={(ids, clear) => (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                ids.forEach((id) => convertLead(id));
                showToast("הלידים הנבחרים הומרו למטופלים", { variant: "success" });
                clear();
              }}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" /> המר נבחרים
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                setBulkDeleteIds(ids);
                clear();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> מחק נבחרים
            </Button>
          </>
        )}
        columns={
          [
            {
              key: "name",
              header: "ליד",
              sortable: true,
              sortValue: (l) => l.full_name,
              render: (l) => (
                <div className="flex items-center gap-3">
                  <Avatar name={l.full_name} />
                  <p className="font-medium text-slate-900">{l.full_name}</p>
                </div>
              ),
            },
            {
              key: "contact",
              header: "פרטי קשר",
              render: (l) => (
                <div>
                  <p className="text-slate-700">{l.phone}</p>
                  <p className="text-xs text-slate-400">{l.source}</p>
                </div>
              ),
            },
            {
              key: "status",
              header: "סטטוס",
              sortable: true,
              sortValue: (l) => l.status,
              render: (l) => <StatusBadge status={l.status} kind="lead" />,
            },
          ] satisfies DataTableColumn<Lead>[]
        }
        rowActions={(l) => (
          <>
            {l.status !== "הומר" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  convertLead(l.id);
                  showToast("הליד הומר למטופל", { variant: "success" });
                }}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" /> המר
              </Button>
            )}
            <button
              onClick={() => {
                setEditLead(l);
                setFormOpen(true);
              }}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setDeleteId(l.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      />
      )}

      <LeadForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        initial={
          editLead
            ? {
                full_name: editLead.full_name,
                email: editLead.email ?? "",
                phone: editLead.phone ?? "",
                source: editLead.source,
                notes: editLead.notes ?? "",
                status: editLead.status,
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="מחיקת ליד"
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteId) {
            deleteLead(deleteId);
            showToast("הליד נמחק", { variant: "success" });
          }
        }}
      />

      <ConfirmDialog
        open={!!bulkDeleteIds}
        onClose={() => setBulkDeleteIds(null)}
        title={`מחיקת ${bulkDeleteIds?.length ?? 0} לידים`}
        destructive
        confirmLabel="מחק נבחרים"
        onConfirm={() => {
          bulkDeleteIds?.forEach((id) => deleteLead(id));
          showToast("הלידים הנבחרים נמחקו", { variant: "success" });
          setSelectedIds(new Set());
        }}
      />
    </div>
  );
}

function LeadKanban({
  leads,
  onStatusChange,
  onEdit,
}: {
  leads: Lead[];
  onStatusChange: (id: string, status: LeadStatus) => void;
  onEdit: (lead: Lead) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {LEAD_STATUSES.map((status) => {
        const columnLeads = leads.filter((l) => l.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStatus(status);
            }}
            onDragLeave={() => setDragOverStatus((s) => (s === status ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedId) onStatusChange(draggedId, status);
              setDraggedId(null);
              setDragOverStatus(null);
            }}
            className={cn(
              "flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 min-h-[120px] transition-colors",
              dragOverStatus === status && "border-primary bg-primary/5"
            )}
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-slate-600">{status}</span>
              <Badge tone="slate">{columnLeads.length}</Badge>
            </div>
            {columnLeads.map((l) => (
              <div
                key={l.id}
                draggable
                onDragStart={() => setDraggedId(l.id)}
                onDragEnd={() => setDraggedId(null)}
                onClick={() => onEdit(l)}
                className="cursor-grab rounded-lg border border-slate-200 bg-white p-2.5 text-sm shadow-sm active:cursor-grabbing hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2">
                  <Avatar name={l.full_name} className="h-7 w-7 text-xs" />
                  <p className="font-medium text-slate-900 truncate">{l.full_name}</p>
                </div>
                {l.phone && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
                    <Phone className="h-3 w-3" /> {l.phone}
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-0.5">{l.source}</p>
              </div>
            ))}
            {columnLeads.length === 0 && (
              <p className="text-xs text-slate-300 text-center py-4">אין לידים</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
      )}
    >
      {children}
      {active && <X className="h-3 w-3" />}
    </button>
  );
}
