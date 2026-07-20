"use client";

import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, Avatar } from "@/components/ui/Misc";
import { Badge, ProviderStatusBadge, ProviderPublishedBadge } from "@/components/ui/Badge";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { ProgressBar } from "@/components/ui/Progress";
import { ProviderProfile, PROVIDER_TYPE_LABELS, ProviderType } from "@/types";
import { ProviderForm, ProviderFormValues } from "@/components/admin/ProviderForm";
import { AdminProviderProfile, onboardingPercent } from "@/components/admin/AdminProviderProfile";
import { Plus, Search, Stethoscope, ClipboardList, TriangleAlert, Users2, Radio, Clock, ShieldCheck, Rocket } from "lucide-react";

// Canned reasons for the reject / request-changes dialogs — one click fills
// the textarea, which stays editable so Ops can refine the wording.
const REJECT_REASON_PRESETS = [
  "קובץ הרישיון אינו קריא או חסר",
  "פרטי הרישיון אינם תואמים את הרישום במשרד הבריאות",
  "חסרים מסמכים נדרשים לסוג הספק",
  "תחום העיסוק אינו נתמך כרגע בפלטפורמה",
];

const CHANGES_REASON_PRESETS = [
  "יש להעלות קובץ רישיון עדכני וקריא",
  "יש להשלים את קטלוג השירותים והמחירים",
  "יש לשייך את כל השירותים למיקום פעיל",
  "יש להשלים פרטי מיקום ושעות פעילות",
];

function ReasonPresets({ presets, onPick }: { presets: string[]; onPick: (reason: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {presets.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => onPick(preset)}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 hover:border-primary hover:bg-primary/5 hover:text-primary transition-colors"
        >
          {preset}
        </button>
      ))}
    </div>
  );
}

// What each row is waiting on, and since when — pending_review waits from
// application submission; onboarding only becomes "waiting on Healson" once
// the provider actually requested Go-Live.
function waitingSince(p: ProviderProfile): string | undefined {
  if (p.status === "pending_review") return p.application_submitted_at;
  if (p.status === "onboarding" && p.go_live_requested_at) return p.go_live_requested_at;
  return undefined;
}

// The /apply page promises review "עד 24 שעות" — anything older than 2 days
// in the queue is flagged as overdue.
const QUEUE_SLA_DAYS = 2;

function waitingDays(p: ProviderProfile): number | null {
  const since = waitingSince(p);
  if (!since) return null;
  return Math.floor((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60 * 24));
}

function isBreached(p: ProviderProfile): boolean {
  const days = waitingDays(p);
  return days !== null && days > QUEUE_SLA_DAYS;
}

function WaitingIndicator({ provider }: { provider: ProviderProfile }) {
  const days = waitingDays(provider);
  if (days === null) return <span className="text-xs text-slate-300">—</span>;
  const breached = days > QUEUE_SLA_DAYS;
  return (
    <span className={`text-sm ${breached ? "font-semibold text-danger-text" : "text-slate-600"}`}>
      {days === 0 ? "היום" : `${days} ימים`}
      {breached && <Badge tone="danger" className="mr-1.5">חריגה</Badge>}
    </span>
  );
}

function SummaryStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
      <div>
        <p className="text-lg font-bold tabular-nums text-slate-900 leading-none">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export default function ProvidersPage() {
  const providers = useStore((s) => s.providers);
  const patients = useStore((s) => s.patients);
  const appointments = useStore((s) => s.appointments);
  const users = useStore((s) => s.users);
  const upsertProviderProfile = useStore((s) => s.upsertProviderProfile);
  const verifyProviderLicense = useStore((s) => s.verifyProviderLicense);
  const approveProviderGoLive = useStore((s) => s.approveProviderGoLive);
  const rejectProvider = useStore((s) => s.rejectProvider);
  const requestProviderChanges = useStore((s) => s.requestProviderChanges);
  const showToast = useStore((s) => s.showToast);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [slaOnly, setSlaOnly] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ProviderProfile | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectConfirmed, setRejectConfirmed] = useState(false);
  const [changesTarget, setChangesTarget] = useState<ProviderProfile | null>(null);
  const [changesReason, setChangesReason] = useState("");
  const [reviewTargetId, setReviewTargetId] = useState<string | null>(null);
  const [providerFormOpen, setProviderFormOpen] = useState(false);

  function handleProviderSubmit(values: ProviderFormValues) {
    upsertProviderProfile(undefined, {
      provider_type: values.provider_type,
      display_name: values.display_name,
      specialty: values.specialty,
      contact_phone: values.contact_phone || undefined,
      contact_email: values.contact_email || undefined,
      license_number: values.license_number || undefined,
      commission_rate: values.commission_rate,
      status: "approved",
      is_published: true,
      license_verified_at: new Date().toISOString(),
    });
    showToast("הספק נוסף בהצלחה", { variant: "success" });
    setProviderFormOpen(false);
  }

  // A provider can hold a live session from the moment they register
  // (PROV-REGISTRATION), before they've finished filling out / submitting
  // their application — Ops shouldn't see those half-finished signups.
  const visibleProviders = useMemo(
    () => providers.filter((p) => !(p.status === "pending_review" && !p.application_submitted_at)),
    [providers]
  );

  const reviewProvider = reviewTargetId ? providers.find((p) => p.id === reviewTargetId) : undefined;

  // Read-only overview metrics (the "at a glance" dashboard).
  const summary = useMemo(() => {
    const onboardingList = visibleProviders.filter((p) => p.status === "onboarding");
    const avgOnboarding =
      onboardingList.length === 0
        ? 0
        : Math.round(onboardingList.reduce((s, p) => s + onboardingPercent(p), 0) / onboardingList.length);
    return {
      total: visibleProviders.length,
      live: visibleProviders.filter((p) => p.is_published).length,
      breaches: visibleProviders.filter(isBreached).length,
      avgOnboarding,
    };
  }, [visibleProviders]);

  // Queue KPI tiles — live workload counts per stage; clicking a tile filters
  // the table to that stage (clicking again clears back to "all").
  const queueTiles = useMemo(
    () => [
      {
        key: "pending_review",
        label: "ממתינים לבדיקת רישיון",
        count: visibleProviders.filter((p) => p.status === "pending_review").length,
        activeClasses: "border-warning bg-warning-bg",
        countClasses: "text-warning-text",
      },
      {
        key: "onboarding",
        label: "באונבורדינג",
        count: visibleProviders.filter((p) => p.status === "onboarding").length,
        activeClasses: "border-info bg-info-bg",
        countClasses: "text-info-text",
      },
      {
        key: "go_live_requested",
        label: "ביקשו פרסום",
        count: visibleProviders.filter((p) => p.status === "onboarding" && p.go_live_requested_at).length,
        activeClasses: "border-accent bg-accent-bg",
        countClasses: "text-accent-text",
      },
      {
        key: "approved",
        label: "מאושרים",
        count: visibleProviders.filter((p) => p.status === "approved").length,
        activeClasses: "border-success bg-success-bg",
        countClasses: "text-success-text",
      },
      {
        key: "suspended",
        label: "מושהים",
        count: visibleProviders.filter((p) => p.status === "suspended").length,
        activeClasses: "border-danger bg-danger-bg",
        countClasses: "text-danger-text",
      },
    ],
    [visibleProviders]
  );

  // Provider-type options limited to types actually present in the data.
  const typeOptions = useMemo(() => {
    const present = new Set<ProviderType>();
    visibleProviders.forEach((p) => p.provider_type && present.add(p.provider_type));
    return [...present];
  }, [visibleProviders]);

  const filtered = useMemo(() => {
    const q = query.trim();
    return providers.filter((p) => {
      if (p.status === "pending_review" && !p.application_submitted_at) return false;
      if (statusFilter === "published" && !p.is_published) return false;
      if (statusFilter === "unpublished" && p.is_published) return false;
      if (statusFilter === "go_live_requested" && !(p.status === "onboarding" && p.go_live_requested_at)) return false;
      if (
        !["all", "published", "unpublished", "go_live_requested"].includes(statusFilter) &&
        p.status !== statusFilter
      )
        return false;
      if (typeFilter !== "all" && p.provider_type !== typeFilter) return false;
      if (slaOnly && !isBreached(p)) return false;
      if (!q) return true;
      const user = users.find((u) => u.id === p.user_id);
      const haystack = [
        p.display_name,
        p.specialty,
        p.license_number,
        p.contact_name,
        p.contact_email,
        p.contact_phone,
        p.business_reg_number,
        user?.email,
        user?.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q.toLowerCase());
    });
  }, [providers, query, statusFilter, typeFilter, slaOnly, users]);

  return (
    <AppLayout>
      <PageHeader
        title="ניהול ספקים"
        description="בדיקת רישיון, אונבורדינג, אישור Go-Live וניהול מחזור החיים של ספקי הבריאות"
        actions={
          <Button size="sm" onClick={() => setProviderFormOpen(true)}>
            <Plus className="h-4 w-4" /> ספק חדש
          </Button>
        }
      />

      {/* Overview dashboard — read-only metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <SummaryStat icon={<Users2 className="h-4.5 w-4.5" />} label="סה״כ ספקים" value={summary.total} tone="bg-info-bg text-info" />
        <SummaryStat icon={<Radio className="h-4.5 w-4.5" />} label="מפורסמים (Live)" value={summary.live} tone="bg-success-bg text-success" />
        <SummaryStat
          icon={<TriangleAlert className="h-4.5 w-4.5" />}
          label="חריגות SLA"
          value={summary.breaches}
          tone={summary.breaches > 0 ? "bg-danger-bg text-danger" : "bg-slate-100 text-slate-400"}
        />
        <SummaryStat icon={<Clock className="h-4.5 w-4.5" />} label="ממוצע התקדמות אונבורדינג" value={`${summary.avgOnboarding}%`} tone="bg-accent-bg text-accent-text" />
      </div>

      {/* Clickable stage tiles — double as quick filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {queueTiles.map((tile) => {
          const active = statusFilter === tile.key;
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => setStatusFilter(active ? "all" : tile.key)}
              className={`rounded-xl border p-3 text-right transition-colors ${
                active ? tile.activeClasses : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <p className={`text-2xl font-bold tabular-nums ${tile.countClasses}`}>{tile.count}</p>
              <p className="text-xs text-slate-600 mt-0.5">{tile.label}</p>
            </button>
          );
        })}
      </div>

      {/* Advanced filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Input
          placeholder="חיפוש: שם, תחום, רישיון, אימייל, טלפון..."
          icon={<Search className="h-4 w-4" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[200px]">
          <option value="all">כל הסטטוסים</option>
          <option value="pending_review">ממתינים לבדיקת רישיון</option>
          <option value="onboarding">באונבורדינג</option>
          <option value="go_live_requested">ביקשו פרסום — ממתינים לאישור</option>
          <option value="approved">מאושרים</option>
          <option value="rejected">נדחו</option>
          <option value="suspended">מושהים</option>
          <option value="published">מפורסמים</option>
          <option value="unpublished">לא מפורסמים</option>
        </Select>
        {typeOptions.length > 1 && (
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="max-w-[180px]">
            <option value="all">כל סוגי הספקים</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {PROVIDER_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        )}
        <button
          type="button"
          onClick={() => setSlaOnly((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            slaOnly ? "border-danger bg-danger-bg text-danger-text" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
        >
          <TriangleAlert className="h-3.5 w-3.5" /> חריגות SLA בלבד
        </button>
        {(query || statusFilter !== "all" || typeFilter !== "all" || slaOnly) && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatusFilter("all");
              setTypeFilter("all");
              setSlaOnly(false);
            }}
            className="text-sm text-primary hover:underline"
          >
            נקה סינון
          </button>
        )}
        <span className="ms-auto text-sm text-slate-500">{filtered.length} תוצאות</span>
      </div>

      <DataTable<ProviderProfile>
        rows={filtered}
        rowKey={(p) => p.id}
        onRowClick={(p) => setReviewTargetId(p.id)}
        emptyIcon={<Stethoscope className="h-10 w-10" />}
        emptyTitle="לא נמצאו ספקים"
        columns={
          [
            {
              key: "name",
              header: "ספק",
              sortable: true,
              sortValue: (p) => p.display_name,
              render: (p) => (
                <div className="flex items-center gap-3">
                  <Avatar name={p.display_name || "?"} src={p.image_url} />
                  <div>
                    <p className="font-medium text-slate-900">
                      {p.title} {p.display_name}
                    </p>
                    <p className="text-xs text-amber-700">{p.specialty || "—"}</p>
                  </div>
                </div>
              ),
            },
            {
              key: "type",
              header: "סוג",
              render: (p) => (p.provider_type ? <Badge tone="slate">{PROVIDER_TYPE_LABELS[p.provider_type]}</Badge> : <span className="text-xs text-slate-300">—</span>),
            },
            {
              key: "status",
              header: "סטטוס",
              render: (p) => (
                <div className="flex gap-1.5 flex-wrap">
                  <ProviderStatusBadge status={p.status} title={p.status === "rejected" ? p.rejection_reason : undefined} />
                  {p.is_published && <ProviderPublishedBadge />}
                  {p.status === "onboarding" && p.go_live_requested_at ? (
                    <Badge tone="warning">⏳ ביקש פרסום</Badge>
                  ) : (
                    p.status === "onboarding" && p.onboarding_ready_at && <Badge tone="green">מוכן לפרסום</Badge>
                  )}
                </div>
              ),
            },
            {
              key: "onboarding",
              header: "התקדמות",
              sortable: true,
              sortValue: (p) => (p.status === "onboarding" ? onboardingPercent(p) : p.status === "approved" ? 100 : -1),
              render: (p) => {
                if (p.status !== "onboarding") return <span className="text-xs text-slate-300">—</span>;
                const pct = onboardingPercent(p);
                return (
                  <div className="flex items-center gap-2 min-w-[110px]">
                    <ProgressBar percent={pct} tone={pct === 100 ? "success" : "primary"} className="flex-1" />
                    <span className="text-xs tabular-nums text-slate-500">{pct}%</span>
                  </div>
                );
              },
            },
            {
              key: "waiting",
              header: "ממתין מזה",
              sortable: true,
              sortValue: (p) => waitingSince(p) ?? "",
              render: (p) => <WaitingIndicator provider={p} />,
            },
            {
              key: "commission",
              header: "עמלה",
              sortable: true,
              sortValue: (p) => p.commission_rate ?? 15,
              render: (p) => <span className="text-slate-700">{p.commission_rate ?? 15}%</span>,
            },
            {
              key: "patients",
              header: "מטופלים",
              sortable: true,
              sortValue: (p) => patients.filter((pa) => pa.assigned_provider === p.id).length,
              render: (p) => (
                <span className="text-slate-700">{patients.filter((pa) => pa.assigned_provider === p.id).length}</span>
              ),
            },
            {
              key: "appointments",
              header: "תורים",
              sortable: true,
              sortValue: (p) => appointments.filter((a) => a.provider_id === p.id).length,
              render: (p) => (
                <span className="text-slate-700">{appointments.filter((a) => a.provider_id === p.id).length}</span>
              ),
            },
          ] satisfies DataTableColumn<ProviderProfile>[]
        }
        rowActions={(p) => (
          <>
            {/* Quick triage for the two highest-frequency queue actions;
                everything else lives in the provider profile. */}
            {p.status === "pending_review" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  verifyProviderLicense(p.id);
                  showToast("הרישיון אומת — הספק עבר לשלב האונבורדינג", { variant: "success" });
                }}
              >
                <ShieldCheck className="h-3.5 w-3.5" /> אמת רישיון
              </Button>
            )}
            {p.status === "onboarding" && p.go_live_requested_at && p.onboarding_ready_at && (
              <Button
                size="sm"
                onClick={() => {
                  approveProviderGoLive(p.id);
                  showToast("הספק אושר ל-Go-Live ופורסם", { variant: "success" });
                }}
              >
                <Rocket className="h-3.5 w-3.5" /> אשר Go-Live
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setReviewTargetId(p.id)}>
              <ClipboardList className="h-3.5 w-3.5" /> פרטים
            </Button>
          </>
        )}
      />

      {/* Provider profile — tabbed record + contextual lifecycle actions */}
      <Dialog
        open={!!reviewProvider}
        onClose={() => setReviewTargetId(null)}
        title="כרטיס ספק"
        description={reviewProvider ? `${reviewProvider.title ?? ""} ${reviewProvider.display_name}` : undefined}
        className="max-w-3xl"
      >
        {reviewTargetId && (
          <AdminProviderProfile
            providerId={reviewTargetId}
            onClose={() => setReviewTargetId(null)}
            onRequestReject={(p) => {
              setRejectTarget(p);
              setReviewTargetId(null);
            }}
            onRequestChanges={(p) => {
              setChangesTarget(p);
              setReviewTargetId(null);
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={!!rejectTarget}
        onClose={() => {
          setRejectTarget(null);
          setRejectReason("");
          setRejectConfirmed(false);
        }}
        title="דחיית ספק"
        description={rejectTarget ? `${rejectTarget.title ?? ""} ${rejectTarget.display_name}` : undefined}
      >
        <div className="flex flex-col gap-3">
          <ReasonPresets presets={REJECT_REASON_PRESETS} onPick={setRejectReason} />
          <Textarea label="סיבת הדחייה" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} required />
          {rejectReason.trim() && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p className="mb-1 font-medium text-slate-500">כך זה יוצג לספק:</p>
              <p className="text-slate-800">בקשתך נדחתה: {rejectReason.trim()}</p>
            </div>
          )}
          <label className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-bg px-3 py-2.5 text-sm text-danger-text cursor-pointer">
            <input
              type="checkbox"
              checked={rejectConfirmed}
              onChange={(e) => setRejectConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#dc2626]"
            />
            אני מבין/ה שדחייה היא סופית — הספק ייחסם מכניסה למערכת ויקבל את הסיבה שלמעלה
          </label>
          <Button
            variant="destructive"
            disabled={rejectReason.trim().length < 5 || !rejectConfirmed}
            title={rejectReason.trim().length < 5 ? "יש להזין סיבת דחייה (לפחות 5 תווים)" : !rejectConfirmed ? "יש לאשר את הדחייה" : undefined}
            onClick={() => {
              if (rejectTarget) {
                rejectProvider(rejectTarget.id, rejectReason.trim());
                showToast("הספק נדחה", { variant: "success" });
              }
              setRejectTarget(null);
              setRejectReason("");
              setRejectConfirmed(false);
            }}
          >
            דחה ספק
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={!!changesTarget}
        onClose={() => setChangesTarget(null)}
        title="בקשת תיקונים מהספק"
        description={changesTarget ? `${changesTarget.title ?? ""} ${changesTarget.display_name}` : undefined}
      >
        <div className="flex flex-col gap-3">
          <ReasonPresets presets={CHANGES_REASON_PRESETS} onPick={setChangesReason} />
          <Textarea label="מה יש לתקן?" value={changesReason} onChange={(e) => setChangesReason(e.target.value)} required />
          {changesReason.trim() && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p className="mb-1 font-medium text-slate-500">כך זה יוצג לספק במסך האונבורדינג:</p>
              <p className="text-slate-800">נדרשים תיקונים: {changesReason.trim()}</p>
            </div>
          )}
          <Button
            disabled={changesReason.trim().length < 5}
            title={changesReason.trim().length < 5 ? "יש לפרט מה יש לתקן (לפחות 5 תווים)" : undefined}
            onClick={() => {
              if (changesTarget) {
                requestProviderChanges(changesTarget.id, changesReason.trim());
                showToast("נשלחה בקשת תיקונים לספק", { variant: "success" });
              }
              setChangesTarget(null);
              setChangesReason("");
            }}
          >
            שלח בקשת תיקונים
          </Button>
        </div>
      </Dialog>

      <ProviderForm open={providerFormOpen} onClose={() => setProviderFormOpen(false)} onSubmit={handleProviderSubmit} />
    </AppLayout>
  );
}
