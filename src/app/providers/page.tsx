"use client";

import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, Avatar } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { ProviderProfile } from "@/types";
import { Search, BadgeCheck, Stethoscope, Ban, ShieldCheck } from "lucide-react";

export default function ProvidersPage() {
  const providers = useStore((s) => s.providers);
  const patients = useStore((s) => s.patients);
  const appointments = useStore((s) => s.appointments);
  const updateProviderById = useStore((s) => s.updateProviderById);
  const approveProvider = useStore((s) => s.approveProvider);
  const rejectProvider = useStore((s) => s.rejectProvider);
  const showToast = useStore((s) => s.showToast);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rejectTarget, setRejectTarget] = useState<ProviderProfile | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const filtered = useMemo(() => {
    return providers.filter((p) => {
      if (statusFilter === "pending" && p.verification_status !== "ממתין") return false;
      if (statusFilter === "approved" && p.verification_status !== "מאושר") return false;
      if (statusFilter === "rejected" && p.verification_status !== "נדחה") return false;
      if (statusFilter === "published" && !p.is_published) return false;
      if (statusFilter === "unpublished" && p.is_published) return false;
      if (!query) return true;
      return p.display_name.includes(query) || p.specialty.includes(query);
    });
  }, [providers, query, statusFilter]);

  return (
    <AppLayout>
      <PageHeader title="ספקי שירות" description="אישור רישיון, פרסום וניהול ספקי הבריאות במערכת" />

      <div className="flex flex-wrap gap-3 mb-5">
        <Input
          placeholder="חיפוש לפי שם או תחום..."
          icon={<Search className="h-4 w-4" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[180px]">
          <option value="all">כל הסטטוסים</option>
          <option value="pending">ממתינים לאישור</option>
          <option value="approved">מאושרים</option>
          <option value="rejected">נדחו</option>
          <option value="published">מפורסמים</option>
          <option value="unpublished">לא מפורסמים</option>
        </Select>
      </div>

      <DataTable<ProviderProfile>
        rows={filtered}
        rowKey={(p) => p.id}
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
                  <Avatar name={p.display_name || "?"} />
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
              key: "status",
              header: "סטטוס",
              render: (p) => (
                <div className="flex gap-1.5 flex-wrap">
                  {p.verification_status === "מאושר" ? (
                    <Badge tone="green">
                      <BadgeCheck className="h-3 w-3" /> מאושר
                    </Badge>
                  ) : p.verification_status === "נדחה" ? (
                    <Badge tone="red">נדחה</Badge>
                  ) : (
                    <Badge tone="amber">ממתין לאישור</Badge>
                  )}
                  {p.is_published && <Badge tone="blue">מפורסם</Badge>}
                  {!p.is_active && <Badge tone="slate">מושהה</Badge>}
                </div>
              ),
            },
            {
              key: "agreements",
              header: "הסדרים",
              render: (p) => (
                <span className="text-xs text-slate-500">
                  {p.agreements.length > 0 ? p.agreements.map((a) => a.layer).join(", ") : "—"}
                </span>
              ),
            },
            {
              key: "commission",
              header: "עמלה",
              render: (p) => <span className="text-slate-700">{p.commission_rate ?? 15}%</span>,
            },
            {
              key: "clinics",
              header: "מרפאות",
              sortable: true,
              sortValue: (p) => p.clinic_locations.length,
              render: (p) => <span className="text-slate-700">{p.clinic_locations.length}</span>,
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
            {p.verification_status !== "מאושר" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  approveProvider(p.id);
                  showToast("הספק אושר בהצלחה", { variant: "success" });
                }}
              >
                <ShieldCheck className="h-3.5 w-3.5" /> אשר
              </Button>
            )}
            {p.verification_status !== "נדחה" && (
              <Button variant="outline" size="sm" onClick={() => setRejectTarget(p)}>
                <Ban className="h-3.5 w-3.5" /> דחה
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                updateProviderById(p.id, { is_published: !p.is_published });
                showToast(p.is_published ? "הפרופיל הוסר מהפרסום" : "הפרופיל פורסם", { variant: "success" });
              }}
            >
              {p.is_published ? "בטל פרסום" : "פרסם"}
            </Button>
          </>
        )}
      />

      <Dialog
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="דחיית ספק"
        description={rejectTarget ? `${rejectTarget.title ?? ""} ${rejectTarget.display_name}` : undefined}
      >
        <div className="flex flex-col gap-3">
          <Textarea label="סיבת הדחייה" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} required />
          <Button
            variant="destructive"
            onClick={() => {
              if (rejectTarget) {
                rejectProvider(rejectTarget.id, rejectReason);
                showToast("הספק נדחה", { variant: "success" });
              }
              setRejectTarget(null);
              setRejectReason("");
            }}
          >
            דחה ספק
          </Button>
        </div>
      </Dialog>
    </AppLayout>
  );
}
