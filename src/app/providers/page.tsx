"use client";

import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, Avatar } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { ProviderProfile } from "@/types";
import { Search, BadgeCheck, Stethoscope } from "lucide-react";

export default function ProvidersPage() {
  const providers = useStore((s) => s.providers);
  const patients = useStore((s) => s.patients);
  const appointments = useStore((s) => s.appointments);
  const updateProviderById = useStore((s) => s.updateProviderById);
  const showToast = useStore((s) => s.showToast);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return providers.filter((p) => {
      const isVerified = !!(p.license_number && p.display_name && p.specialty);
      if (statusFilter === "verified" && !isVerified) return false;
      if (statusFilter === "published" && !p.is_published) return false;
      if (statusFilter === "unpublished" && p.is_published) return false;
      if (!query) return true;
      return p.display_name.includes(query) || p.specialty.includes(query);
    });
  }, [providers, query, statusFilter]);

  return (
    <AppLayout>
      <PageHeader title="ספקי שירות" description="מדריך ונהול ספקי הבריאות במערכת" />

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
          <option value="verified">מאומתים</option>
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
              render: (p) => {
                const isVerified = !!(p.license_number && p.display_name && p.specialty);
                return (
                  <div className="flex gap-1.5 flex-wrap">
                    {isVerified ? (
                      <Badge tone="green">
                        <BadgeCheck className="h-3 w-3" /> מאומת
                      </Badge>
                    ) : (
                      <Badge tone="amber">לא הושלם</Badge>
                    )}
                    {p.is_published && <Badge tone="blue">מפורסם</Badge>}
                  </div>
                );
              },
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
        )}
      />
    </AppLayout>
  );
}
