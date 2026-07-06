"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { useStore } from "@/lib/store";
import { useCurrentPatient } from "@/lib/useCurrentPatient";
import { resolveCatalogPrice } from "@/lib/pricing";
import {
  BodyMap,
  OptionGrid,
  PatientPriceTag,
  SelectableOption,
  StepIndicator,
} from "@/components/catalog/Wizard";
import { BodyRegionMeta } from "@/lib/medical-tree";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Misc";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Search, RotateCcw } from "lucide-react";
import { SERVICE_TYPE_LABELS } from "@/types";

export default function ClientSearchPage() {
  const catalog = useStore((s) => s.catalog);
  const skillDomains = useStore((s) => s.skillDomains);
  const skillSubdomains = useStore((s) => s.skillSubdomains);
  const providers = useStore((s) => s.providers);
  const addAppointment = useStore((s) => s.addAppointment);
  const addOrder = useStore((s) => s.addOrder);
  const showToast = useStore((s) => s.showToast);
  const currentUser = useStore((s) => s.currentUser);
  const patient = useCurrentPatient();

  const [step, setStep] = useState(0);
  const [bodyRegion, setBodyRegion] = useState<BodyRegionMeta | null>(null);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [subdomainId, setSubdomainId] = useState<string | null>(null);

  const [bookingItemId, setBookingItemId] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("09:00");

  const activeCatalog = useMemo(() => catalog.filter((c) => c.is_active), [catalog]);

  const domainOptions: SelectableOption[] = useMemo(() => {
    const usedIds = new Set(activeCatalog.map((i) => i.skill_domain_id));
    const list = skillDomains.filter((d) => usedIds.has(d.id)).map((d) => ({ id: d.id, label: d.name_he }));
    if (bodyRegion) {
      list.sort((a, b) => {
        const aPriority = bodyRegion.domains.includes(a.label) ? -1 : 0;
        const bPriority = bodyRegion.domains.includes(b.label) ? -1 : 0;
        return aPriority - bPriority;
      });
    }
    return list;
  }, [activeCatalog, skillDomains, bodyRegion]);

  const subdomainOptions: SelectableOption[] = useMemo(() => {
    if (!domainId) return [];
    const usedIds = new Set(
      activeCatalog.filter((i) => i.skill_domain_id === domainId).map((i) => i.skill_subdomain_id)
    );
    return skillSubdomains
      .filter((sd) => sd.domain_id === domainId && usedIds.has(sd.id))
      .map((sd) => ({ id: sd.id, label: sd.name_he }));
  }, [activeCatalog, skillSubdomains, domainId]);

  const results = useMemo(() => {
    if (!domainId || !subdomainId) return [];
    return activeCatalog.filter((i) => i.skill_domain_id === domainId && i.skill_subdomain_id === subdomainId);
  }, [activeCatalog, domainId, subdomainId]);

  const domainLabel = skillDomains.find((d) => d.id === domainId)?.name_he;
  const subdomainLabel = skillSubdomains.find((sd) => sd.id === subdomainId)?.name_he;

  function handleReset() {
    setStep(0);
    setBodyRegion(null);
    setDomainId(null);
    setSubdomainId(null);
  }

  function openBooking(itemId: string) {
    setBookingItemId(itemId);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setBookingDate(d.toISOString().slice(0, 10));
    setBookingTime("09:00");
  }

  function confirmBooking() {
    const item = activeCatalog.find((c) => c.id === bookingItemId);
    if (!item) return;
    const resolved = resolveCatalogPrice(item.base_price, patient);
    const provider = providers.find((p) => p.id === item.provider_id);
    const commissionRate = provider?.commission_rate ?? 15;
    const commissionAmount = Math.round((resolved.price * commissionRate) / 100);

    addAppointment({
      client_name: currentUser?.full_name ?? "מטופל",
      client_phone: currentUser?.phone,
      provider_id: item.provider_id,
      provider_name: provider ? `${provider.title ?? ""} ${provider.display_name}`.trim() : "—",
      service_name: item.name_he,
      date: bookingDate,
      time: bookingTime,
      duration_minutes: item.typical_duration_min ?? 30,
      status: "ממתין לאישור",
      kupah: patient?.kupah,
      notes: "",
      created_by_id: patient?.id ?? currentUser?.id,
    });

    addOrder({
      item_id: item.id,
      item_name: item.name_he,
      provider_id: item.provider_id,
      provider_name: provider ? provider.display_name : "—",
      created_by_id: patient?.id ?? currentUser?.id,
      patient_name: currentUser?.full_name ?? "מטופל",
      final_price: resolved.price,
      status: "ממתין",
      payment_status: "מקדמה שולמה",
      deposit_amount: Math.round(resolved.price * 0.3),
      balance_amount: Math.round(resolved.price * 0.7),
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      provider_payout_amount: resolved.price - commissionAmount,
    });

    showToast("התור נוצר בהצלחה", { description: "ניתן לעקוב אחר הסטטוס במסך התורים שלי", variant: "success" });
    setBookingItemId(null);
  }

  return (
    <ClientLayout>
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <p className="text-3xl mb-1">🔍</p>
          <h1 className="text-lg font-bold text-slate-900">חיפוש שירות בריאות</h1>
          <p className="text-sm text-slate-500">בחרו את האזור והתחום הרפואי המתאימים לכם — המחיר יוצג לפי הביטוח שלכם</p>
        </div>

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
                {domainOptions.length === 0 ? (
                  <EmptyState title="לא נמצאו תחומים זמינים" action={<ResetButton onReset={handleReset} />} />
                ) : (
                  <OptionGrid
                    options={domainOptions}
                    onSelect={(id) => {
                      setDomainId(id);
                      setStep(2);
                    }}
                  />
                )}
              </div>
            )}

            {step === 2 && (
              <div>
                <Breadcrumb label={domainLabel} onBack={() => setStep(1)} />
                {subdomainOptions.length === 0 ? (
                  <EmptyState title="לא נמצאו תתי-תחומים עבור תחום זה" action={<ResetButton onReset={handleReset} />} />
                ) : (
                  <OptionGrid
                    options={subdomainOptions}
                    onSelect={(id) => {
                      setSubdomainId(id);
                      setStep(3);
                    }}
                  />
                )}
              </div>
            )}

            {step === 3 && (
              <div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {[bodyRegion?.label, domainLabel, subdomainLabel].filter(Boolean).map((chip, i) => (
                    <span key={`${i}-${chip}`} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      {chip}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-slate-500 mb-3">תוצאות ({results.length})</p>
                {!patient && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                    השלימו את הפרופיל הביטוחי שלכם בעמוד הפרופיל כדי לראות מחיר מותאם אישית.
                  </p>
                )}
                {results.length === 0 ? (
                  <EmptyState title="לא נמצאו שירותים" action={<ResetButton onReset={handleReset} />} />
                ) : (
                  <div className="flex flex-col gap-3">
                    {results.map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, delay: i * 0.04 }}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-900">{item.name_he}</p>
                            <p className="text-xs text-slate-400">{SERVICE_TYPE_LABELS[item.service_type]}</p>
                            {item.requires_referral && <Badge tone="amber" className="mt-1">דורש הפניה</Badge>}
                          </div>
                          <PatientPriceTag item={item} patient={patient} />
                        </div>
                        <Button size="sm" className="w-full mt-3" onClick={() => openBooking(item.id)}>
                          קבע תור
                        </Button>
                      </motion.div>
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

      <Dialog open={!!bookingItemId} onClose={() => setBookingItemId(null)} title="קביעת תור" description="בחרו תאריך ושעה מתאימים">
        <div className="flex flex-col gap-3">
          <Input type="date" label="תאריך" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
          <Input type="time" label="שעה" value={bookingTime} onChange={(e) => setBookingTime(e.target.value)} />
          <Button onClick={confirmBooking} className="w-full mt-1">
            <Search className="h-4 w-4" /> אישור קביעת תור
          </Button>
        </div>
      </Dialog>
    </ClientLayout>
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
