"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, Avatar, EmptyState } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import {
  ADMIN_TITLE_LABELS,
  DSR_REQUEST_TYPE_LABELS,
  DSR_REQUEST_STATUSES,
  DsrRequest,
  DsrRequestStatus,
  ProviderProfile,
  Role,
  SERVICE_TYPE_LABELS,
  SERVICE_TYPES,
  User,
} from "@/types";
import { formatDateHe } from "@/lib/utils";
import { EXAMPLE_REMINDER_APPOINTMENT, REMINDER_PLACEHOLDERS, renderReminderTemplate } from "@/lib/reminders";
import { Plus, Trash2, Building2, Users, Settings, Percent, ShieldAlert, UserPlus } from "lucide-react";

const ROLE_LABELS: Record<Role, string> = { admin: "מנהל", provider: "ספק", patient: "מטופל" };

export default function AdminSettingsPage() {
  const users = useStore((s) => s.users);
  const branches = useStore((s) => s.branches);
  const showToast = useStore((s) => s.showToast);
  const addAdminUser = useStore((s) => s.addAdminUser);
  const reminderSettings = useStore((s) => s.reminderSettings);
  const updateReminderSettings = useStore((s) => s.updateReminderSettings);
  const addBranch = useStore((s) => s.addBranch);
  const deleteBranch = useStore((s) => s.deleteBranch);

  const [localUsers, setLocalUsers] = useState(users);
  const [branchOpen, setBranchOpen] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: "", city: "", address: "" });
  const [deleteBranchId, setDeleteBranchId] = useState<string | null>(null);
  const [repFormOpen, setRepFormOpen] = useState(false);
  const [repForm, setRepForm] = useState({ full_name: "", email: "", phone: "" });
  const [reminderDraft, setReminderDraft] = useState(reminderSettings);

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

  function handleAddBranch() {
    addBranch(branchForm);
    showToast("הסניף נוסף בהצלחה", { variant: "success" });
    setBranchOpen(false);
    setBranchForm({ name: "", city: "", address: "" });
  }

  function addRep() {
    addAdminUser(repForm);
    showToast("נציג השירות נוסף בהצלחה", { variant: "success" });
    setRepFormOpen(false);
    setRepForm({ full_name: "", email: "", phone: "" });
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

        <TabsContent value="users" className="flex flex-col gap-5">
          <Card>
            <CardHeader className="flex items-center justify-between flex-row">
              <div>
                <CardTitle>צוות המנהלים</CardTitle>
                <p className="text-sm text-slate-500">מנהלי-על ונציגי שירות של Healson</p>
              </div>
              <Button size="sm" onClick={() => setRepFormOpen(true)}>
                <UserPlus className="h-4 w-4" /> נציג שירות חדש
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable<User>
                rows={users.filter((u) => u.role === "admin")}
                rowKey={(u) => u.id}
                emptyTitle="אין צוות מנהלים"
                columns={
                  [
                    {
                      key: "name",
                      header: "משתמש",
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
                      key: "title",
                      header: "תפקיד",
                      render: (u) => (
                        <Badge tone={u.admin_title === "superadmin" ? "purple" : "slate"}>
                          {ADMIN_TITLE_LABELS[u.admin_title ?? "superadmin"]}
                        </Badge>
                      ),
                    },
                  ] satisfies DataTableColumn<User>[]
                }
              />
            </CardContent>
          </Card>

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

          <Card className="max-w-lg mt-5">
            <CardHeader>
              <CardTitle>תזכורות אוטומטיות</CardTitle>
              <p className="text-sm text-slate-500">שליחת SMS תזכורת אוטומטית לכל תורי המחר, בשעה קבועה כל יום</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <SettingToggle
                label="שליחה אוטומטית מופעלת"
                checked={reminderDraft.enabled}
                onChange={(v) => setReminderDraft({ ...reminderDraft, enabled: v })}
              />
              <Input
                type="time"
                label="שעת שליחה יומית"
                value={reminderDraft.sendTime}
                onChange={(e) => setReminderDraft({ ...reminderDraft, sendTime: e.target.value })}
              />
              <Textarea
                label="תבנית ההודעה"
                value={reminderDraft.template}
                onChange={(e) => setReminderDraft({ ...reminderDraft, template: e.target.value })}
                rows={3}
              />
              <p className="text-xs text-slate-400">
                משתנים זמינים: {REMINDER_PLACEHOLDERS.map((p) => p.token).join(" · ")}
              </p>
              <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                <p className="text-xs font-medium text-slate-400 mb-1">תצוגה מקדימה</p>
                {renderReminderTemplate(reminderDraft.template, EXAMPLE_REMINDER_APPOINTMENT)}
              </div>
              <Button
                size="sm"
                className="self-start"
                onClick={() => {
                  updateReminderSettings({
                    enabled: reminderDraft.enabled,
                    sendTime: reminderDraft.sendTime,
                    template: reminderDraft.template,
                  });
                  showToast("הגדרות התזכורות נשמרו", { variant: "success" });
                }}
              >
                שמור הגדרות תזכורות
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
              {branches.length === 0 ? (
                <EmptyState icon={<Building2 className="h-10 w-10" />} title="אין סניפים" />
              ) : (
                <div className="grid sm:grid-cols-3 gap-3">
                  {branches.map((b) => (
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

      <Dialog open={repFormOpen} onClose={() => setRepFormOpen(false)} title="נציג שירות חדש">
        <div className="flex flex-col gap-3">
          <Input label="שם מלא" value={repForm.full_name} onChange={(e) => setRepForm({ ...repForm, full_name: e.target.value })} />
          <Input label="אימייל" type="email" value={repForm.email} onChange={(e) => setRepForm({ ...repForm, email: e.target.value })} />
          <Input label="טלפון" value={repForm.phone} onChange={(e) => setRepForm({ ...repForm, phone: e.target.value })} />
          <Button onClick={addRep} disabled={!repForm.full_name || !repForm.email}>
            הוסף נציג שירות
          </Button>
        </div>
      </Dialog>

      <Dialog open={branchOpen} onClose={() => setBranchOpen(false)} title="סניף חדש">
        <div className="flex flex-col gap-3">
          <Input label="שם הסניף" value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} />
          <Input label="עיר" value={branchForm.city} onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })} />
          <Input label="כתובת" value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} />
          <Button onClick={handleAddBranch}>שמור סניף</Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteBranchId}
        onClose={() => setDeleteBranchId(null)}
        title="מחיקת סניף"
        destructive
        confirmLabel="מחק"
        onConfirm={() => {
          if (deleteBranchId) deleteBranch(deleteBranchId);
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
  const commissionRateByServiceType = useStore((s) => s.commissionRateByServiceType);
  const setServiceTypeCommissionRate = useStore((s) => s.setServiceTypeCommissionRate);
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
          <CardTitle>עמלה לפי סוג פריט</CardTitle>
          <p className="text-sm text-slate-500">
            חלה על הזמנות המקושרות לפריט קטלוג, כשלא הוגדרה עמלה מותאמת לספק
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {SERVICE_TYPES.map((type) => (
            <div key={type} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-700">{SERVICE_TYPE_LABELS[type]}</span>
              <ServiceTypeCommissionEditor
                value={commissionRateByServiceType[type]}
                defaultRate={defaultCommissionRate}
                onSave={(rate) => {
                  setServiceTypeCommissionRate(type, rate);
                  showToast("העמלה לפי סוג פריט עודכנה", { variant: "success" });
                }}
              />
            </div>
          ))}
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

function ServiceTypeCommissionEditor({
  value,
  defaultRate,
  onSave,
}: {
  value: number | undefined;
  defaultRate: number;
  onSave: (rate: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(String(value ?? defaultRate));
  return (
    <div className="flex items-center gap-1.5">
      {value === undefined ? (
        <span className="text-xs text-slate-400">ברירת מחדל ({defaultRate}%)</span>
      ) : (
        <span className="text-xs text-slate-600">{value}%</span>
      )}
      <Input type="number" value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 w-16 text-xs" />
      <Button size="sm" variant="outline" onClick={() => onSave(Number(draft) || 0)}>
        עדכן
      </Button>
      {value !== undefined && (
        <Button size="sm" variant="outline" onClick={() => onSave(undefined)}>
          נקה
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data subject rights queue (ADM-08) — export/rectification/erasure requests.
// ---------------------------------------------------------------------------
const DSR_SLA_DAYS = 30;
const OPEN_DSR_STATUSES: DsrRequestStatus[] = ["ממתין", "בטיפול"];

function DsrTab() {
  const dsrRequests = useStore((s) => s.dsrRequests);
  const patients = useStore((s) => s.patients);
  const updateDsrRequest = useStore((s) => s.updateDsrRequest);
  const updatePatient = useStore((s) => s.updatePatient);
  const showToast = useStore((s) => s.showToast);

  return (
    <Card>
      <CardHeader>
        <CardTitle>בקשות נושאי מידע</CardTitle>
        <p className="text-sm text-slate-500">ייצוא / תיקון / מחיקה — SLA לטיפול: {DSR_SLA_DAYS} יום ממועד הבקשה</p>
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
                  return (
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-900">{patient?.full_name ?? "—"}</span>
                      {patient?.processing_restricted && <Badge tone="red">עיבוד מוגבל</Badge>}
                    </div>
                  );
                },
              },
              { key: "type", header: "סוג בקשה", render: (r) => <Badge tone="slate">{DSR_REQUEST_TYPE_LABELS[r.type]}</Badge> },
              {
                key: "requested",
                header: "תאריך בקשה",
                sortable: true,
                sortValue: (r) => r.requested_at,
                render: (r) => {
                  const daysOpen = (Date.now() - new Date(r.requested_at).getTime()) / (1000 * 60 * 60 * 24);
                  const breached = OPEN_DSR_STATUSES.includes(r.status) && daysOpen > DSR_SLA_DAYS;
                  return (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">{formatDateHe(r.requested_at)}</span>
                      {breached && <Badge tone="red">חריגת SLA</Badge>}
                    </div>
                  );
                },
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
          rowActions={(r) => {
            const patient = patients.find((p) => p.id === r.patient_id);
            if (!patient) return null;
            return (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const restricted = !patient.processing_restricted;
                  updatePatient(patient.id, { processing_restricted: restricted });
                  showToast(restricted ? "עיבוד הנתונים של המטופל נחסם" : "חסימת עיבוד הנתונים בוטלה", {
                    variant: "success",
                  });
                }}
              >
                {patient.processing_restricted ? "בטל חסימת עיבוד" : "חסום עיבוד נתונים"}
              </Button>
            );
          }}
        />
      </CardContent>
    </Card>
  );
}
