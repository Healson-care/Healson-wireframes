"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState } from "@/components/ui/Misc";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { PriceCalculator } from "@/components/catalog/Wizard";
import { SERVICE_TYPES, SERVICE_TYPE_LABELS, ServiceType } from "@/types";

export default function MedicalReferencePage() {
  const catalog = useStore((s) => s.catalog);
  const skillDomains = useStore((s) => s.skillDomains);
  const skillSubdomains = useStore((s) => s.skillSubdomains);
  const providers = useStore((s) => s.providers);

  const [domainId, setDomainId] = useState(skillDomains[0]?.id ?? "");
  const subdomainsForDomain = skillSubdomains.filter((sd) => sd.domain_id === domainId);
  const [subdomainId, setSubdomainId] = useState(subdomainsForDomain[0]?.id ?? "");
  const [serviceType, setServiceType] = useState<ServiceType>(SERVICE_TYPES[0]);

  const activeSubdomains = skillSubdomains.filter((sd) => sd.domain_id === domainId);
  const sub = activeSubdomains.find((s) => s.id === subdomainId) ?? activeSubdomains[0];

  const services = catalog.filter(
    (c) => c.skill_domain_id === domainId && c.skill_subdomain_id === sub?.id && c.service_type === serviceType
  );

  return (
    <AppLayout>
      <PageHeader title="מדריך רפואי" description="עיון בטקסונומיה הרפואית של הפלטפורמה" />

      <div className="grid lg:grid-cols-[200px_200px_1fr] gap-4">
        <Card className="p-2">
          <p className="text-xs font-semibold text-slate-400 px-2 py-1">תחום</p>
          {skillDomains.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setDomainId(d.id);
                const firstSub = skillSubdomains.find((sd) => sd.domain_id === d.id);
                setSubdomainId(firstSub?.id ?? "");
              }}
              className={cn(
                "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-right",
                domainId === d.id ? "bg-primary/10 text-primary font-medium" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <span>{d.emoji}</span> {d.name_he}
            </button>
          ))}
        </Card>

        <Card className="p-2">
          <p className="text-xs font-semibold text-slate-400 px-2 py-1">תת-תחום</p>
          {activeSubdomains.map((s) => (
            <button
              key={s.id}
              onClick={() => setSubdomainId(s.id)}
              className={cn(
                "w-full flex items-center rounded-lg px-3 py-2 text-sm text-right",
                subdomainId === s.id ? "bg-primary/10 text-primary font-medium" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              {s.name_he}
            </button>
          ))}
        </Card>

        <div>
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {SERVICE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setServiceType(t)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium",
                  serviceType === t ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {SERVICE_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${domainId}-${subdomainId}-${serviceType}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {services.length === 0 ? (
                <EmptyState title="אין פריטים מוגדרים בקטגוריה זו" />
              ) : (
                <div className="flex flex-col gap-3">
                  {services.map((item) => {
                    const provider = providers.find((p) => p.id === item.provider_id);
                    return (
                      <Card key={item.id} className="p-4">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="font-medium text-slate-900">{item.name_he}</p>
                            <p className="text-xs text-slate-400">{item.tavar_code}</p>
                            {provider && (
                              <p className="text-xs text-slate-500 mt-1">
                                {provider.title} {provider.display_name}
                              </p>
                            )}
                          </div>
                          <PriceCalculator item={item} />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
