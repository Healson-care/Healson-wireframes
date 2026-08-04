"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PageHeader, Avatar } from "@/components/ui/Misc";
import { Badge, ProviderStatusBadge, ProviderPublishedBadge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { DEFAULT_COMMISSION_RATE } from "@/lib/commission";
import { ProgressBar } from "@/components/ui/Progress";
import { ProviderProfile, PROVIDER_TYPE_LABELS, ProviderType } from "@/types";
import { ProviderForm, ProviderFormValues } from "@/components/admin/ProviderForm";
import { onboardingPercent } from "@/components/admin/AdminProviderProfile";
import { Plus, Search, Stethoscope, ClipboardList, TriangleAlert, ShieldCheck, Rocket } from "lucide-react";

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

// The lifecycle stages that double as the queue filter. "all" first, then the
// five states an Ops user actually triages between.
const STAGE_KEYS = ["all", "pending_review", "onboarding", "go_live_requested", "approved", "suspended"] as const;
type StageKey = (typeof STAGE_KEYS)[number];

const STAGE_LABELS: Record<StageKey, string> = {
  all: "הכל",
  pending_review: "ממתינים לבדיקה",
  onboarding: "בהצטרפות",
  go_live_requested: "ביקשו פרסום",
  approved: "מאושרים",
  suspended: "מושהים",
};

export default function ProvidersPage() {
  const router = useRouter();
  const providers = useStore((s) => s.providers);
  const users = useStore((s) => s.users);
  const upsertProviderProfile = useStore((s) => s.upsertProviderProfile);
  const createOrganization = useStore((s) => s.createOrganization);
  const verifyProviderLicense = useStore((s) => s.verifyProviderLicense);
  const approveProviderGoLive = useStore((s) => s.approveProviderGoLive);
  const showToast = useStore((s) => s.showToast);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [slaOnly, setSlaOnly] = useState(false);
  const [providerFormOpen, setProviderFormOpen] = useState(false);

  const openProvider = (id: string) => router.push(`/providers/${id}`);

  function handleProviderSubmit(values: ProviderFormValues) {
    if (values.is_organization) {
      // Ops-created organization (רשת) — units and their login users are
      // added afterwards from the organization's card ("יחידות ומשתמשים").
      const org = createOrganization({
        display_name: values.display_name,
        contact_name: values.contact_name || undefined,
        contact_phone: values.contact_phone || undefined,
        contact_email: values.contact_email || undefined,
      });
      showToast("הארגון נוצר — כעת ניתן להוסיף לו יחידות רפואיות ומשתמשים", { variant: "success" });
      setProviderFormOpen(false);
      openProvider(org.id);
      return;
    }
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

  const summary = useMemo(
    () => ({
      total: visibleProviders.length,
      live: visibleProviders.filter((p) => p.is_published).length,
      breaches: visibleProviders.filter(isBreached).length,
    }),
    [visibleProviders]
  );

  // Per-stage counts for the segmented queue filter.
  const stageCounts = useMemo(() => {
    const count = (key: StageKey) => {
      switch (key) {
        case "all":
          return visibleProviders.length;
        case "go_live_requested":
          return visibleProviders.filter((p) => p.status === "onboarding" && p.go_live_requested_at).length;
        default:
          return visibleProviders.filter((p) => p.status === key).length;
      }
    };
    return Object.fromEntries(STAGE_KEYS.map((k) => [k, count(k)])) as Record<StageKey, number>;
  }, [visibleProviders]);

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

  const secondaryStatus = ["published", "unpublished", "rejected"].includes(statusFilter) ? statusFilter : "";
  const filtersActive = query || statusFilter !== "all" || typeFilter !== "all" || slaOnly;

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

      {/* Thin metric line — at-a-glance totals; the SLA figure is a live filter */}
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
        <span>
          <strong className="tabular-nums text-slate-900">{summary.total}</strong> ספקים
        </span>
        <span className="text-slate-300">·</span>
        <span>
          <strong className="tabular-nums text-slate-900">{summary.live}</strong> מפורסמים (Live)
        </span>
        <span className="text-slate-300">·</span>
        <button
          type="button"
          onClick={() => setSlaOnly((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors",
            summary.breaches > 0 ? "font-medium text-danger-text" : "text-slate-500",
            slaOnly && "bg-danger-bg"
          )}
          title="הצג רק חריגות SLA"
        >
          <TriangleAlert className="h-3.5 w-3.5" />
          <span className="tabular-nums">{summary.breaches}</span> חריגות SLA
        </button>
      </div>

      {/* Segmented queue filter — the lifecycle stages double as quick filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STAGE_KEYS.map((key) => {
          const active = statusFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              )}
            >
              {STAGE_LABELS[key]}
              <span className={cn("tabular-nums text-xs", active ? "text-white/75" : "text-slate-400")}>
                {stageCounts[key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + secondary filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Input
          placeholder="חיפוש: שם, תחום, רישיון, אימייל, טלפון..."
          icon={<Search className="h-4 w-4" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={secondaryStatus}
          onChange={(e) => setStatusFilter(e.target.value || "all")}
          className="max-w-[170px]"
        >
          <option value="">סינון נוסף…</option>
          <option value="published">מפורסמים</option>
          <option value="unpublished">לא מפורסמים</option>
          <option value="rejected">נדחו</option>
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
        {filtersActive && (
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
        onRowClick={(p) => openProvider(p.id)}
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
              render: (p) =>
                p.is_organization ? (
                  <Badge tone="purple">
                    ארגון · {providers.filter((u) => u.parent_organization_id === p.id).length} יחידות
                  </Badge>
                ) : p.provider_type ? (
                  <Badge tone="slate">{PROVIDER_TYPE_LABELS[p.provider_type]}</Badge>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                ),
            },
            {
              key: "status",
              header: "מצב",
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
              sortValue: (p) => p.commission_rate ?? DEFAULT_COMMISSION_RATE,
              render: (p) => <span className="text-slate-700">{p.commission_rate ?? DEFAULT_COMMISSION_RATE}%</span>,
            },
          ] satisfies DataTableColumn<ProviderProfile>[]
        }
        rowActions={(p) => (
          <>
            {/* Quick triage for the two highest-frequency queue actions;
                everything else lives in the provider card. */}
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
            <Button variant="outline" size="sm" onClick={() => openProvider(p.id)}>
              <ClipboardList className="h-3.5 w-3.5" /> פרטים
            </Button>
          </>
        )}
      />

      <ProviderForm open={providerFormOpen} onClose={() => setProviderFormOpen(false)} onSubmit={handleProviderSubmit} />
    </AppLayout>
  );
}
