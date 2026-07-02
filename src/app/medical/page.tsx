"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { Card } from "@/components/ui/Card";
import { MEDICAL_TREE, SERVICE_TYPES } from "@/lib/medical-tree";
import { cn } from "@/lib/utils";
import { PriceCalculator } from "@/components/catalog/Wizard";
import { KUPOT } from "@/types";

export default function MedicalReferencePage() {
  const catalog = useStore((s) => s.catalog);
  const [domainKey, setDomainKey] = useState(MEDICAL_TREE[0].key);
  const [subKey, setSubKey] = useState(MEDICAL_TREE[0].subDomains[0].key);
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0].key);

  const domain = MEDICAL_TREE.find((d) => d.key === domainKey)!;
  const sub = domain.subDomains.find((s) => s.key === subKey) ?? domain.subDomains[0];
  const serviceTypeLabel = SERVICE_TYPES.find((s) => s.key === serviceType)!.label;

  const services = catalog.filter(
    (c) => c.domain === domain.label && c.sub_domain === sub.label && c.service_type === serviceTypeLabel
  );

  return (
    <AppLayout>
      <PageHeader title="מדריך רפואי" description="עיון בטקסונומיה הרפואית של הפלטפורמה" />

      <div className="grid lg:grid-cols-[200px_200px_1fr] gap-4">
        <Card className="p-2">
          <p className="text-xs font-semibold text-slate-400 px-2 py-1">תחום</p>
          {MEDICAL_TREE.map((d) => (
            <button
              key={d.key}
              onClick={() => {
                setDomainKey(d.key);
                setSubKey(d.subDomains[0].key);
              }}
              className={cn(
                "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-right",
                domainKey === d.key ? "bg-primary/10 text-primary font-medium" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <span>{d.emoji}</span> {d.label}
            </button>
          ))}
        </Card>

        <Card className="p-2">
          <p className="text-xs font-semibold text-slate-400 px-2 py-1">תת-תחום</p>
          {domain.subDomains.map((s) => (
            <button
              key={s.key}
              onClick={() => setSubKey(s.key)}
              className={cn(
                "w-full flex items-center rounded-lg px-3 py-2 text-sm text-right",
                subKey === s.key ? "bg-primary/10 text-primary font-medium" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              {s.label}
            </button>
          ))}
        </Card>

        <div>
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {SERVICE_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setServiceType(t.key)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium",
                  serviceType === t.key ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${domainKey}-${subKey}-${serviceType}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {services.length === 0 ? (
                <EmptyState title="אין שירותים מוגדרים בקטגוריה זו" />
              ) : (
                <div className="flex flex-col gap-3">
                  {services.map((item) => (
                    <Card key={item.id} className="p-4">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-medium text-slate-900">{item.item_name}</p>
                          <p className="text-xs text-slate-400">{item.item_code}</p>
                          {item.staff_name && <p className="text-xs text-slate-500 mt-1">{item.staff_name}</p>}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {KUPOT.map((k) => (
                            <div key={k} className="text-center">
                              <p className="text-[10px] text-slate-400">{k}</p>
                              <PriceCalculator item={item} kupah={k} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
