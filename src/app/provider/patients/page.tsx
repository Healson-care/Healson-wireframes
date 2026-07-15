"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProviderLayout } from "@/components/layouts/ProviderLayout";
import { useStore } from "@/lib/store";
import { useCurrentProvider } from "@/lib/useCurrentPatient";
import { PageHeader, Avatar } from "@/components/ui/Misc";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";
import { Patient } from "@/types";
import { Search, Users, FolderOpen } from "lucide-react";

export default function ProviderPatientsPage() {
  const router = useRouter();
  const provider = useCurrentProvider();
  const patients = useStore((s) => s.patients);
  const appointments = useStore((s) => s.appointments);
  const [query, setQuery] = useState("");

  const myPatients = useMemo(() => {
    if (!provider) return [];
    return patients.filter((p) => p.assigned_provider === provider.id);
  }, [patients, provider]);

  const filtered = myPatients.filter((p) => {
    if (!query) return true;
    const q = query.trim();
    return (
      p.full_name.includes(q) ||
      (p.phone ?? "").includes(q) ||
      (p.id_number ?? "").includes(q)
    );
  });

  function apptCount(patientId: string) {
    return appointments.filter((a) => a.created_by_id === patientId).length;
  }

  return (
    <ProviderLayout>
      <PageHeader title="המטופלים שלי" description="רשימת המטופלים המשויכים אליך" />

      <Input
        placeholder="חיפוש לפי שם, טלפון או ת.ז..."
        icon={<Search className="h-4 w-4" />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 max-w-sm"
      />

      <DataTable<Patient>
        rows={filtered}
        rowKey={(p) => p.id}
        emptyIcon={<Users className="h-10 w-10" />}
        emptyTitle="אין מטופלים מתאימים"
        onRowClick={(p) => router.push(`/provider/patients/${p.id}`)}
        rowActions={(p) => (
          <Button variant="outline" size="sm" onClick={() => router.push(`/provider/patients/${p.id}`)}>
            <FolderOpen className="h-3.5 w-3.5" /> פתח תיק
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
                    <p className="font-medium text-slate-900">{p.full_name}</p>
                    <p className="text-xs text-slate-500">{p.phone}</p>
                  </div>
                </div>
              ),
            },
            { key: "kupah", header: "קופה", sortable: true, sortValue: (p) => p.kupah, render: (p) => <span className="text-slate-600">{p.kupah}</span> },
            {
              key: "status",
              header: "סטטוס",
              sortable: true,
              sortValue: (p) => p.status,
              render: (p) => <StatusBadge status={p.status} kind="patient" />,
            },
            {
              key: "appointments",
              header: "תורים",
              sortable: true,
              sortValue: (p) => apptCount(p.id),
              render: (p) => <span className="text-slate-600">{apptCount(p.id)}</span>,
            },
          ] satisfies DataTableColumn<Patient>[]
        }
      />
    </ProviderLayout>
  );
}
