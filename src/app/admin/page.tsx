"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, Avatar, EmptyState } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import {
  DSR_REQUEST_TYPE_LABELS,
  DSR_REQUEST_STATUSES,
  DsrRequest,
  DsrRequestStatus,
  ProviderProfile,
  Role,
  User,
} from "@/types";
import { generateId, formatDateHe } from "@/lib/utils";
import { Plus, Trash2, Building2, Users, Settings, Percent, ShieldAlert } from "lucide-react";

const ROLE_LABELS: Record<Role, string> = { admin: "מנהל", provider: "ספק", patient: "מטופל" };

export default function AdminSettingsPage() {
  const users = useStore((s) => s.users);
  const branches = useStore((s) => s.branches);
  const showToast = useStore((s) => s.showToast);

  const [localUsers, setLocalUsers] = useState(users);
  const [localBranches, setLocalBranches] = useState(branches);
  const [branchOpen, setBranchOpen] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: "", city: "", address: "" });
  const [deleteBranchId, setDeleteBranchId] = useState<string | null>(null);

  const [settings, setSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    maintenanceMode: false,
    autoApproveAppointments: false,
  });

  function changeRole(userId: string, role: Role) {
    setLocalUsers((u) => u.map((x) => (x.id === userId ? { ...x, role } : x)));
    showToast("התפקיד עודכן", { description: "שינוי זה הוא לצורכי הדגמה בלבד", variant: "success" });
  }

  function addBranch() {
    setLocalBranches((b) => [...b, { id: generateId("branch"), ...branchForm }]);
    showToast("הסניף נוסף בהצלחה", { variant: "success" });
    setBranchOpen(false);
    setBranchForm({ name: "", city: "", address: "" });
  }

  return (
    <AppLayout>
      <PageHeader title="ניהול מערכת" description="הגדרות פלטפורמה, משתמשים, עמלות ובקשות פרטיות" />

      <Tabs defaultValue="users">
        <TabsList className="mb-5 flex-wrap">
          <TabsTrigger value="users" icon={<Users className="h-3.5 w-3.5" />}>משתמשים</TabsTrigger>
          <TabsTrigger value="settings" icon={<Settings className="h-3.5 w-3.5" />}>הגדרות</TabsTrigger>
          <TabsTrigger value="branches" icon={<Building2 className="h-3.5 w-3.5" />}>סניפים</TabsTrigger>
          <TabsTrigger value="commission" icon={<Percent className="h-3.5 w-3.5" />}>עמלות</TabsTrigger>
          <TabsTrigger value="dsr" icon={<ShieldAlert className="h-3.5 w-3.5" />}>בקשות פרטיות</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>ניהול תפקידי משתמשים</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable<User>
                rows={localUsers}
                rowKey={(u) => u.id}
                emptyTitle="אין משתמשים"
                columns={
                  [
                    {
                      key: "name",
                      header: "משתמש",
                      sortable: true,
                      sortValue: (u) => u.full_name,
                      render: (u) => (
                        <div className="flex items-center gap-2">
                          <Avatar name={u.full_name} className="h-8 w-8 text-xs" />
                          <div>
                            <p className="text-sm font-medium text-slate-800">{u.full_name}</p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: "role",
                      header: "תפקיד",
                      render: (u) => (
                        <Select value={u.role} onChange={(e) => changeRole(u.id, e.target.value as Role)} className="w-28 h-8 text-xs">
                          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </Select>
                      ),
                    },
                  ] satisfies DataTableColumn<User>[]
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle>הגדרות מערכת</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <SettingToggle
                label="התראות אימייל"
                checked={settings.emailNotifications}
                onChange={(v) => setSettings({ ...settings, emailNotifications: v })}
              />
              <SettingToggle
                label="התראות SMS"
                checked={settings.smsNotifications}
                onChange={(v) => setSettings({ ...settings, smsNotifications: v })}
              />
              <SettingToggle
                label="אישור תורים אוטומטי"
                checked={settings.autoApproveAppointments}
                onChange={(v) => setSettings({ ...settings, autoApproveAppointments: v })}
              />
              <SettingToggle
                label="מצב תחזוקה"
                checked={settings.maintenanceMode}
                onChange={(v) => setSettings({ ...settings, maintenanceMode: v })}
              />
              <Button
                size="sm"
                className="self-start mt-1"
                onClick={() => showToast("ההגדרות נשמרו בהצלחה", { variant: "success" })}
              >
                שמור הגדרות
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branches">
          <Card>
            <CardHeader className="flex items-center justify-between flex-row">
              <CardTitle>סניפים</CardTitle>
              <Button size="sm" onClick={() => setBranchOpen(true)}>
                <Plus className="h-4 w-4" /> סניף חדש
              </Button>
            </CardHeader>
            <CardContent>
              {localBranches.length === 0 ? (
                <EmptyState icon={<Building2 className="h-10 w-10" />} title="אין סניפים" />
              ) : (
                <div className="grid sm:grid-cols-3 gap-3">
                  {localBranches.map((b) => (
                    <div key={b.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-slate-800">{b.name}</p>
                          <p className="text-xs text-slate-500">{b.city}</p>
                          <p className="text-xs text-slate-400">{b.address}</p>
                        </div>
                        <button
                          onClick={() => setDeleteBranchId(b.id)}
                          className="p-1.5 rounded-md hover:bg-red-50 text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Badge tone="green" className="mt-2">פעיל</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commission">
          <CommissionTab />
        </TabsContent>

        <TabsContent value="dsr">
          <DsrTab />
        </TabsContent>
      </Tabs>

      <Dialog open={branchOpen} onClose={() => setBranchOpen(false)} title="סניף חדש">
        <div className="flex flex-col gap-3">
          <Input label="שם הסניף" value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} />
          <Input label="עיר" value={branchForm.city} onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })} />
          <Input label="כתובת" value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} />
          <Button onClick={addBranch}>שמור סניף</Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteBranchId}
        onClose={() => setDeleteBranchId(null)}
        title="מחיקת סניף"
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          setLocalBranches((b) => b.filter((x) => x.id !== deleteBranchId));
          showToast("הסניף נמחק", { variant: "success" });
        }}
      />
    </AppLayout>
  );
}

function SettingToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 cursor-pointer">
      <span className="text-sm text-slate-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-9 cursor-pointer accent-[#0d7d6f]"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Commission settings (ADM-06) — default rate + per-provider override.
// ---------------------------------------------------------------------------
function CommissionTab() {
  const providers = useStore((s) => s.providers);
  const defaultCommissionRate = useStore((s) => s.defaultCommissionRate);
  const setDefaultCommissionRate = useStore((s) => s.setDefaultCommissionRate);
  const setProviderCommission = useStore((s) => s.setProviderCommission);
  const showToast = useStore((s) => s.showToast);

  const [defaultDraft, setDefaultDraft] = useState(String(defaultCommissionRate));

  return (
    <div className="flex flex-col gap-5">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>עמלת ברירת מחדל</CardTitle>
          <p className="text-sm text-slate-500">חלה על כל ספק ללא עמלה מותאמת אישית</p>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <Input
            label="אחוז עמלה (%)"
            type="number"
            value={defaultDraft}
            onChange={(e) => setDefaultDraft(e.target.value)}
            className="max-w-[140px]"
          />
          <Button
            onClick={() => {
              setDefaultCommissionRate(Number(defaultDraft) || 0);
              showToast("עמלת ברירת המחדל עודכנה", { variant: "success" });
            }}
          >
            שמור
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>עמלה לפי ספק</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable<ProviderProfile>
            rows={providers}
            rowKey={(p) => p.id}
            emptyTitle="אין ספקים"
            columns={
              [
                {
                  key: "name",
                  header: "ספק",
                  render: (p) => (
                    <span className="font-medium text-slate-900">
                      {p.title} {p.display_name}
                    </span>
                  ),
                },
                { key: "specialty", header: "תחום", render: (p) => <span className="text-slate-600">{p.specialty}</span> },
                {
                  key: "commission",
                  header: "עמלה נוכחית",
                  render: (p) => <span className="text-slate-700">{p.commission_rate ?? defaultCommissionRate}%</span>,
                },
              ] satisfies DataTableColumn<ProviderProfile>[]
            }
            rowActions={(p) => (
              <CommissionInlineEditor
                value={p.commission_rate ?? defaultCommissionRate}
                onSave={(rate) => {
                  setProviderCommission(p.id, rate);
                  showToast("העמלה עודכנה", { variant: "success" });
                }}
              />
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function CommissionInlineEditor({ value, onSave }: { value: number; onSave: (rate: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  return (
    <div className="flex items-center gap-1.5">
      <Input type="number" value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 w-16 text-xs" />
      <Button size="sm" variant="outline" onClick={() => onSave(Number(draft) || 0)}>
        עדכן
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data subject rights queue (ADM-08) — export/rectification/erasure requests.
// ---------------------------------------------------------------------------
function DsrTab() {
  const dsrRequests = useStore((s) => s.dsrRequests);
  const patients = useStore((s) => s.patients);
  const updateDsrRequest = useStore((s) => s.updateDsrRequest);
  const showToast = useStore((s) => s.showToast);

  return (
    <Card>
      <CardHeader>
        <CardTitle>בקשות נושאי מידע</CardTitle>
        <p className="text-sm text-slate-500">ייצוא / תיקון / מחיקה — SLA לטיפול: 30 יום ממועד הבקשה</p>
      </CardHeader>
      <CardContent>
        <DataTable<DsrRequest>
          rows={dsrRequests}
          rowKey={(r) => r.id}
          emptyIcon={<ShieldAlert className="h-10 w-10" />}
          emptyTitle="אין בקשות פתוחות"
          columns={
            [
              {
                key: "patient",
                header: "מטופל",
                render: (r) => {
                  const patient = patients.find((p) => p.id === r.patient_id);
                  return <span className="font-medium text-slate-900">{patient?.full_name ?? "—"}</span>;
                },
              },
              { key: "type", header: "סוג בקשה", render: (r) => <Badge tone="slate">{DSR_REQUEST_TYPE_LABELS[r.type]}</Badge> },
              {
                key: "requested",
                header: "תאריך בקשה",
                sortable: true,
                sortValue: (r) => r.requested_at,
                render: (r) => <span className="text-slate-500">{formatDateHe(r.requested_at)}</span>,
              },
              {
                key: "status",
                header: "סטטוס",
                render: (r) => (
                  <Select
                    value={r.status}
                    onChange={(e) => {
                      const status = e.target.value as DsrRequestStatus;
                      updateDsrRequest(r.id, {
                        status,
                        resolved_at: status === "הושלם" || status === "נדחה" ? new Date().toISOString() : undefined,
                      });
                      showToast("סטטוס הבקשה עודכן", { variant: "success" });
                    }}
                    className="h-8 text-xs w-28"
                  >
                    {DSR_REQUEST_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                ),
              },
              {
                key: "notes",
                header: "הערות",
                render: (r) => <span className="text-xs text-slate-400">{r.notes ?? "—"}</span>,
              },
            ] satisfies DataTableColumn<DsrRequest>[]
          }
        />
      </CardContent>
    </Card>
  );
}
