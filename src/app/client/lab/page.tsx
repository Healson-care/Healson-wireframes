"use client";

import { motion } from "framer-motion";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDateHe } from "@/lib/utils";
import { Download, FlaskConical } from "lucide-react";

export default function ClientLabPage() {
  const labReferrals = useStore((s) => s.labReferrals);
  const showToast = useStore((s) => s.showToast);
  const patient = useCurrentPatient();

  const myResults = labReferrals
    .filter((r) => r.patient_id === patient?.id)
    .sort((a, b) => (a.created_date < b.created_date ? 1 : -1));

  return (
    <ClientLayout>
      <PageHeader title="תוצאות מעבדה" description="צפייה והורדת תוצאות בדיקות" />

      {myResults.length === 0 ? (
        <EmptyState icon={<FlaskConical className="h-10 w-10" />} title="אין תוצאות מעבדה" />
      ) : (
        <div className="flex flex-col gap-3">
          {myResults.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: i * 0.04 }}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{r.test_types.join(", ")}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{r.provider_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDateHe(r.created_date)}</p>
                  </div>
                  <StatusBadge status={r.status} kind="referral" />
                </div>
                {r.status === "הושלם" && (
                  <>
                    <p className="text-sm text-slate-600 mt-3 rounded-lg bg-slate-50 p-3">{r.results}</p>
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => showToast("הקובץ הורד (מצב הדגמה)", { variant: "success" })}
                      >
                        <Download className="h-3.5 w-3.5" /> הורד PDF
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </ClientLayout>
  );
}
