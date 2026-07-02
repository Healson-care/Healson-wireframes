"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useStore } from "@/lib/store";
import {
  BodyMap,
  KupahLogo,
  OptionGrid,
  PriceCalculator,
  StepIndicator,
} from "@/components/catalog/Wizard";
import { BodyRegionMeta } from "@/lib/medical-tree";
import { Button } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/Misc";
import { KUPOT, Kupah } from "@/types";
import { RotateCcw } from "lucide-react";

export default function AdminCatalogPage() {
  const catalog = useStore((s) => s.catalog);

  const [step, setStep] = useState(0);
  const [bodyRegion, setBodyRegion] = useState<BodyRegionMeta | null>(null);
  const [kupah, setKupah] = useState<Kupah | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [subDomain, setSubDomain] = useState<string | null>(null);

  const activeCatalog = useMemo(() => catalog.filter((c) => c.is_active), [catalog]);

  const domains = useMemo(() => {
    if (!kupah) return [];
    const set = new Set(
      activeCatalog.filter((i) => i.price_K.some((p) => p.kupah === kupah)).map((i) => i.domain)
    );
    const list = Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
    if (bodyRegion) {
      list.sort((a, b) => {
        const aPriority = bodyRegion.domains.includes(a) ? -1 : 0;
        const bPriority = bodyRegion.domains.includes(b) ? -1 : 0;
        return aPriority - bPriority;
      });
    }
    return list;
  }, [activeCatalog, kupah, bodyRegion]);

  const subDomains = useMemo(() => {
    if (!domain || !kupah) return [];
    const set = new Set(
      activeCatalog
        .filter((i) => i.domain === domain && i.price_K.some((p) => p.kupah === kupah))
        .map((i) => i.sub_domain)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }, [activeCatalog, domain, kupah]);

  const results = useMemo(() => {
    if (!domain || !subDomain || !kupah) return [];
    return activeCatalog.filter(
      (i) => i.domain === domain && i.sub_domain === subDomain && i.price_K.some((p) => p.kupah === kupah)
    );
  }, [activeCatalog, domain, subDomain, kupah]);

  function handleReset() {
    setStep(0);
    setBodyRegion(null);
    setKupah(null);
    setDomain(null);
    setSubDomain(null);
  }

  return (
    <AppLayout>
      <PageHeader title="קטלוג שירותים" description="עיון בקטלוג השירותים לצורך הפניה וייעוץ למטופלים" />

      <div className="max-w-lg">
        <StepIndicator step={step} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {step === 0 && (
              <BodyMap
                onSelect={(region) => {
                  setBodyRegion(region);
                  setStep(1);
                }}
              />
            )}

            {step === 1 && (
              <div>
                <Breadcrumb label={bodyRegion?.label} onBack={() => setStep(0)} />
                <div className="grid grid-cols-2 gap-3">
                  {KUPOT.map((k) => (
                    <button
                      key={k}
                      onClick={() => {
                        setKupah(k);
                        setStep(2);
                      }}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-primary hover:shadow-md hover:-translate-y-0.5"
                    >
                      <KupahLogo kupah={k} />
                      <span className="text-sm font-medium text-slate-700">{k}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <Breadcrumb label={kupah ?? undefined} onBack={() => setStep(1)} />
                {domains.length === 0 ? (
                  <EmptyState title="לא נמצאו תחומים זמינים" action={<ResetButton onReset={handleReset} />} />
                ) : (
                  <OptionGrid
                    options={domains}
                    onSelect={(d) => {
                      setDomain(d);
                      setStep(3);
                    }}
                  />
                )}
              </div>
            )}

            {step === 3 && (
              <div>
                <Breadcrumb label={domain ?? undefined} onBack={() => setStep(2)} />
                {subDomains.length === 0 ? (
                  <EmptyState title="לא נמצאו תתי-תחומים" action={<ResetButton onReset={handleReset} />} />
                ) : (
                  <OptionGrid
                    options={subDomains}
                    onSelect={(sd) => {
                      setSubDomain(sd);
                      setStep(4);
                    }}
                  />
                )}
              </div>
            )}

            {step === 4 && (
              <div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {[bodyRegion?.label, kupah, domain, subDomain].filter(Boolean).map((chip, i) => (
                    <span key={`${i}-${chip}`} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      {chip}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-slate-500 mb-3">תוצאות ({results.length})</p>
                {results.length === 0 ? (
                  <EmptyState title="לא נמצאו שירותים" action={<ResetButton onReset={handleReset} />} />
                ) : (
                  <div className="flex flex-col gap-3">
                    {results.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-900">{item.item_name}</p>
                            <p className="text-xs text-slate-400">{item.item_code}</p>
                            {item.staff_name && <p className="text-xs text-slate-500 mt-1">{item.staff_name}</p>}
                          </div>
                          {kupah && <PriceCalculator item={item} kupah={kupah} />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="outline" className="w-full mt-4" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4" /> חיפוש חדש
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}

function Breadcrumb({ label, onBack }: { label?: string; onBack: () => void }) {
  if (!label) return null;
  return (
    <button onClick={onBack} className="mb-4 text-sm text-primary hover:underline">
      ← {label} · שנה
    </button>
  );
}

function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onReset}>
      <RotateCcw className="h-4 w-4" /> חיפוש מחדש
    </Button>
  );
}
