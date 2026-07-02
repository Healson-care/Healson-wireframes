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
import { Role, User } from "@/types";
import { generateId } from "@/lib/utils";
import { Plus, Trash2, Building2 } from "lucide-react";

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
      <PageHeader title="ניהול מערכת" description="הגדרות פלטפורמה, משתמשים וסניפים" />

      <div className="grid lg:grid-cols-2 gap-5">
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

        <Card>
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

        <Card className="lg:col-span-2">
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
      </div>

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
