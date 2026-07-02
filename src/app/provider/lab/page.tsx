"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ProviderLayout } from "@/components/layouts/ProviderLayout";
import { useStore } from "@/lib/store";
import { useCurrentProvider } from "@/lib/useCurrentPatient";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatDateHe } from "@/lib/utils";
import { Search, FlaskConical } from "lucide-react";

export default function ProviderLabPage() {
  const provider = useCurrentProvider();
  const labReferrals = useStore((s) => s.labReferrals);
  const [query, setQuery] = useState("");

  const results = useMemo(
    () =>
      labReferrals
        .filter((r) => r.provider_id === provider?.id && r.status === "הושלם")
        .filter((r) => !query || r.patient_name.includes(query)),
    [labReferrals, provider, query]
  );

  return (
    <ProviderLayout>
      <PageHeader title="תוצאות מעבדה" description="תוצאות בדיקות שהושלמו עבור המטופלים שלך" />

      <Input
        placeholder="חיפוש לפי שם מטופל..."
        icon={<Search className="h-4 w-4" />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 max-w-sm"
      />

      {results.length === 0 ? (
        <EmptyState icon={<FlaskConical className="h-10 w-10" />} title="אין תוצאות מעבדה" />
      ) : (
        <div className="flex flex-col gap-3">
          {results.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: i * 0.03 }}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{r.patient_name}</p>
                    <p className="text-sm text-slate-500">{r.test_types.join(", ")}</p>
                    <p className="text-xs text-slate-400 mt-1">{formatDateHe(r.completed_date)}</p>
                  </div>
                  <StatusBadge status={r.status} kind="referral" />
                </div>
                {r.results && <p className="text-sm text-slate-600 mt-3 rounded-lg bg-slate-50 p-3">{r.results}</p>}
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </ProviderLayout>
  );
}
