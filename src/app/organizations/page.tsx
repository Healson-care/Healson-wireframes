"use client";

import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, Avatar, EmptyState } from "@/components/ui/Misc";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge, ProviderStatusBadge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { OrganizationUnitsTab } from "@/components/admin/AdminProviderProfile";
import { formatDateHe } from "@/lib/utils";
import { PROVIDER_TYPE_LABELS, ProviderProfile } from "@/types";
import { Network, Plus, Search, KeyRound, Building2, Rocket, Pencil, LayoutDashboard } from "lucide-react";

function KpiTile({ label, value, tone }: { label: string; value: number; tone?: "warning" | "success" }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          tone === "warning" ? "text-warning-text" : tone === "success" ? "text-success-text" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </Card>
  );
}

/** Back-office view of every organization (רשת) Healson manages: which
 * medical units operate under each one, which units already have a login
 * user, and the org's contact details — the ops-side "single pane" the
 * providers queue is too provider-centric for. */
export default function OrganizationsPage() {
  const providers = useStore((s) => s.providers);
  const organizationBranches = useStore((s) => s.organizationBranches);
  const createOrganization = useStore((s) => s.createOrganization);
  const updateProviderById = useStore((s) => s.updateProviderById);
  const showToast = useStore((s) => s.showToast);

  const [query, setQuery] = useState("");
  const [manageId, setManageId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", contact: "", phone: "", email: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", contact: "", phone: "", email: "" });

  const organizations = useMemo(() => providers.filter((p) => p.is_organization), [providers]);
  const allUnits = useMemo(() => providers.filter((p) => p.parent_organization_id), [providers]);
  const unitsOf = (orgId: string) => allUnits.filter((u) => u.parent_organization_id === orgId);
  // Branches belong to units now (ארגון → יחידה → סניף), so an org's branches
  // are the branches of all its units.
  const branchesOf = (orgId: string) => {
    const unitIds = new Set(unitsOf(orgId).map((u) => u.id));
    return organizationBranches.filter((b) => unitIds.has(b.unit_id));
  };
  const manageOrg = manageId ? providers.find((p) => p.id === manageId) : undefined;

  const kpis = useMemo(() => {
    const withoutUser = allUnits.filter((u) => !u.user_id).length;
    return {
      orgs: organizations.length,
      branches: organizationBranches.length,
      units: allUnits.length,
      withoutUser,
      live: allUnits.filter((u) => u.is_published).length,
    };
  }, [organizations, allUnits, organizationBranches]);

  const filtered = useMemo(
    () =>
      organizations.filter(
        (o) =>
          !query ||
          o.display_name.includes(query) ||
          (o.contact_name ?? "").includes(query) ||
          unitsOf(o.id).some((u) => u.display_name.includes(query))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organizations, allUnits, query]
  );

  function handleCreate() {
    const org = createOrganization({
      display_name: createForm.name.trim(),
      contact_name: createForm.contact.trim() || undefined,
      contact_phone: createForm.phone.trim() || undefined,
      contact_email: createForm.email.trim() || undefined,
    });
    showToast("הארגון נוצר — הוסיפו לו יחידות רפואיות ומשתמשי כניסה", { variant: "success" });
    setCreateOpen(false);
    setCreateForm({ name: "", contact: "", phone: "", email: "" });
    setManageId(org.id);
  }

  function openEdit(org: ProviderProfile) {
    setEditForm({
      name: org.display_name,
      contact: org.contact_name ?? "",
      phone: org.contact_phone ?? "",
      email: org.contact_email ?? "",
    });
    setEditOpen(true);
  }

  function handleEditSave() {
    if (!manageOrg) return;
    updateProviderById(manageOrg.id, {
      display_name: editForm.name.trim() || manageOrg.display_name,
      contact_name: editForm.contact.trim() || undefined,
      contact_phone: editForm.phone.trim() || undefined,
      contact_email: editForm.email.trim() || undefined,
    });
    showToast("פרטי הארגון עודכנו", { variant: "success" });
    setEditOpen(false);
  }

  return (
    <AppLayout>
      <PageHeader
        title="ניהול ארגונים"
        description="כל הרשתות והארגונים במקום אחד — יחידות רפואיות, משתמשי כניסה וסטטוס הפעלה"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> ארגון חדש
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiTile label="ארגונים" value={kpis.orgs} />
        <KpiTile label="סניפים" value={kpis.branches} />
        <KpiTile label="יחידות רפואיות" value={kpis.units} />
        <KpiTile label="יחידות ללא משתמש כניסה" value={kpis.withoutUser} tone={kpis.withoutUser > 0 ? "warning" : undefined} />
        <KpiTile label="יחידות חיות (מפורסמות)" value={kpis.live} tone="success" />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Input
          placeholder="חיפוש ארגון, איש קשר או יחידה..."
          icon={<Search className="h-4 w-4" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <span className="ms-auto text-sm text-slate-500">{filtered.length} ארגונים</span>
      </div>

      {organizations.length === 0 ? (
        <EmptyState
          icon={<Network className="h-10 w-10" />}
          title="אין עדיין ארגונים"
          description="צרו את הארגון הראשון — ואז הוסיפו לו יחידות רפואיות ומשתמש כניסה לכל יחידה"
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> ארגון חדש
            </Button>
          }
        />
      ) : (
        <DataTable<ProviderProfile>
          rows={filtered}
          rowKey={(o) => o.id}
          onRowClick={(o) => setManageId(o.id)}
          emptyIcon={<Network className="h-10 w-10" />}
          emptyTitle="לא נמצאו ארגונים"
          columns={
            [
              {
                key: "name",
                header: "ארגון",
                sortable: true,
                sortValue: (o) => o.display_name,
                render: (o) => (
                  <div className="flex items-center gap-3">
                    <Avatar name={o.display_name || "?"} src={o.image_url} />
                    <div>
                      <p className="font-medium text-slate-900">{o.display_name}</p>
                      <p className="text-xs text-slate-500">
                        {o.contact_name || "—"}
                        {o.contact_phone ? ` · ${o.contact_phone}` : ""}
                      </p>
                    </div>
                  </div>
                ),
              },
              {
                key: "branches",
                header: "סניפים",
                sortable: true,
                sortValue: (o) => branchesOf(o.id).length,
                render: (o) => {
                  const list = branchesOf(o.id);
                  if (list.length === 0) return <span className="text-xs text-slate-300">אין סניפים</span>;
                  return (
                    <span className="flex items-center gap-1 text-sm text-slate-700">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      {list.length}
                    </span>
                  );
                },
              },
              {
                key: "units",
                header: "יחידות",
                sortable: true,
                sortValue: (o) => unitsOf(o.id).length,
                render: (o) => {
                  const units = unitsOf(o.id);
                  if (units.length === 0) return <span className="text-xs text-slate-300">אין יחידות</span>;
                  const types = [...new Set(units.map((u) => u.provider_type).filter(Boolean))];
                  return (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="slate">{units.length} יחידות</Badge>
                      {types.slice(0, 3).map((t) => (
                        <span key={t} className="text-[11px] text-slate-500">
                          {PROVIDER_TYPE_LABELS[t!]}
                        </span>
                      ))}
                      {types.length > 3 && <span className="text-[11px] text-slate-400">+{types.length - 3}</span>}
                    </div>
                  );
                },
              },
              {
                key: "users",
                header: "משתמשי כניסה",
                sortable: true,
                sortValue: (o) => unitsOf(o.id).filter((u) => u.user_id).length,
                render: (o) => {
                  const units = unitsOf(o.id);
                  const withUser = units.filter((u) => u.user_id).length;
                  if (units.length === 0) return <span className="text-xs text-slate-300">—</span>;
                  return (
                    <span
                      className={`flex items-center gap-1 text-sm ${
                        withUser < units.length ? "text-warning-text" : "text-slate-700"
                      }`}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      {withUser}/{units.length}
                    </span>
                  );
                },
              },
              {
                key: "live",
                header: "חיות",
                sortable: true,
                sortValue: (o) => unitsOf(o.id).filter((u) => u.is_published).length,
                render: (o) => {
                  const live = unitsOf(o.id).filter((u) => u.is_published).length;
                  return live > 0 ? (
                    <span className="flex items-center gap-1 text-sm text-success-text">
                      <Rocket className="h-3.5 w-3.5" /> {live}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  );
                },
              },
              {
                key: "created",
                header: "נוצר",
                sortable: true,
                sortValue: (o) => o.created_date,
                render: (o) => <span className="text-xs text-slate-500">{formatDateHe(o.created_date)}</span>,
              },
            ] satisfies DataTableColumn<ProviderProfile>[]
          }
          rowActions={(o) => (
            <Button variant="outline" size="sm" onClick={() => setManageId(o.id)}>
              <Building2 className="h-3.5 w-3.5" /> ניהול
            </Button>
          )}
        />
      )}

      {/* ---- Manage-organization dialog ---- */}
      <Dialog
        open={!!manageOrg}
        onClose={() => setManageId(null)}
        title={manageOrg ? `ניהול ארגון — ${manageOrg.display_name}` : ""}
        className="max-w-2xl"
      >
        {manageOrg && (
          <Tabs defaultValue="units">
            <TabsList>
              <TabsTrigger value="units" icon={<Network className="h-3.5 w-3.5" />}>יחידות ומשתמשים</TabsTrigger>
              <TabsTrigger value="details" icon={<LayoutDashboard className="h-3.5 w-3.5" />}>פרטי הארגון</TabsTrigger>
            </TabsList>
            <TabsContent value="units" className="mt-4">
              <OrganizationUnitsTab organization={manageOrg} />
            </TabsContent>
            <TabsContent value="details" className="mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="mb-1 text-xs text-slate-500">איש קשר</p>
                  <p className="text-sm font-medium text-slate-900">{manageOrg.contact_name || "—"}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="mb-1 text-xs text-slate-500">טלפון / אימייל</p>
                  <p className="text-sm font-medium text-slate-900">{manageOrg.contact_phone || "—"}</p>
                  <p className="text-xs text-slate-500">{manageOrg.contact_email || "—"}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 col-span-2">
                  <p className="mb-1 text-xs text-slate-500">סטטוס יחידות</p>
                  <div className="flex flex-wrap gap-1.5">
                    {unitsOf(manageOrg.id).length === 0 ? (
                      <span className="text-sm text-slate-400">אין יחידות עדיין</span>
                    ) : (
                      unitsOf(manageOrg.id).map((u) => (
                        <span key={u.id} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs">
                          {u.display_name}
                          <ProviderStatusBadge status={u.status} />
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => openEdit(manageOrg)}>
                  <Pencil className="h-3.5 w-3.5" /> עריכת פרטי הארגון
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </Dialog>

      {/* ---- Create-organization dialog ---- */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="ארגון חדש"
        description="לאחר יצירת הארגון מוסיפים לו יחידות רפואיות ומשתמש כניסה לכל יחידה"
      >
        <div className="flex flex-col gap-3">
          <Input label="שם הארגון" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
          <Input label="איש קשר" value={createForm.contact} onChange={(e) => setCreateForm({ ...createForm, contact: e.target.value })} />
          <Input label="טלפון" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
          <Input label="אימייל" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
          <Button onClick={handleCreate} disabled={!createForm.name.trim()}>
            צור ארגון
          </Button>
        </div>
      </Dialog>

      {/* ---- Edit-organization dialog ---- */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="עריכת פרטי הארגון">
        <div className="flex flex-col gap-3">
          <Input label="שם הארגון" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
          <Input label="איש קשר" value={editForm.contact} onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })} />
          <Input label="טלפון" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
          <Input label="אימייל" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          <Button onClick={handleEditSave} disabled={!editForm.name.trim()}>
            שמור
          </Button>
        </div>
      </Dialog>
    </AppLayout>
  );
}
