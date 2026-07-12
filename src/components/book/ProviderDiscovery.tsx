"use client";

import { useMemo, useState } from "react";
import { Info, MessageCircle, Search, Stethoscope, Upload } from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Misc";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { DoctorCard } from "@/components/book/DoctorCard";
import { getRegionForCity } from "@/lib/constants";
import { nextAvailableInDays } from "@/lib/scheduling";
import { resolveProviderPrice } from "@/lib/pricing";
import { useStore } from "@/lib/store";
import { Patient, ProviderProfile } from "@/types";

type ServiceTab = "consultation" | "diagnostics" | "extra";

const SERVICE_TABS: { id: ServiceTab; label: string }[] = [
  { id: "consultation", label: "ייעוץ וחוות דעת" },
  { id: "diagnostics", label: "בדיקות" },
  { id: "extra", label: "שירותים נוספים" },
];

const AVAILABILITY_OPTIONS: { value: string; label: string; maxDays: number }[] = [
  { value: "", label: "כל זמן", maxDays: Infinity },
  { value: "week", label: "השבוע הקרוב", maxDays: 7 },
  { value: "twoWeeks", label: "השבועיים הקרובים", maxDays: 14 },
];

const PRICE_RANGES: { value: string; label: string; min: number; max: number }[] = [
  { value: "", label: "כל מחיר", min: 0, max: Infinity },
  { value: "low", label: "עד 300 ₪", min: 0, max: 300 },
  { value: "mid", label: "300–600 ₪", min: 300, max: 600 },
  { value: "high", label: "600 ₪ ומעלה", min: 600, max: Infinity },
];

export function ProviderDiscovery({
  providers,
  patient,
  title = "קבע תור חדש",
  description = "חיפוש חופשי, או לפי סוג השירות שאתם מחפשים",
  onSelect,
}: {
  providers: ProviderProfile[];
  patient?: Patient | null;
  title?: string;
  description?: string;
  onSelect: (provider: ProviderProfile) => void;
}) {
  const catalog = useStore((s) => s.catalog);
  const skillDomains = useStore((s) => s.skillDomains);
  const skillSubdomains = useStore((s) => s.skillSubdomains);
  const showToast = useStore((s) => s.showToast);

  const [activeTab, setActiveTab] = useState<ServiceTab>("consultation");
  const [query, setQuery] = useState("");
  const [domainId, setDomainId] = useState("");
  const [subdomainId, setSubdomainId] = useState("");
  const [region, setRegion] = useState("");
  const [availability, setAvailability] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralFile, setReferralFile] = useState<File | null>(null);
  const [searched, setSearched] = useState(false);

  function changeTab(tab: ServiceTab) {
    setActiveTab(tab);
    setSearched(false);
  }

  function updateDomain(value: string) {
    setDomainId(value);
    setSubdomainId("");
  }

  const publishedProviders = useMemo(() => providers.filter((p) => p.is_published), [providers]);

  const regions = useMemo(() => {
    const set = new Set<string>();
    publishedProviders.forEach((p) => p.clinic_locations.forEach((c) => set.add(getRegionForCity(c.city))));
    return Array.from(set);
  }, [publishedProviders]);

  // Skill hierarchy (§5): domain/sub-domain options only ever come from the
  // ייעוץ tab's own catalog items (consultation service_type).
  const domainOptions = useMemo(() => {
    const usedIds = new Set(
      catalog.filter((c) => c.is_active && c.provider_id && c.service_type === "consultation").map((c) => c.skill_domain_id)
    );
    return skillDomains.filter((d) => usedIds.has(d.id));
  }, [catalog, skillDomains]);

  const subdomainOptions = useMemo(() => {
    if (!domainId) return [];
    const usedIds = new Set(
      catalog
        .filter((c) => c.is_active && c.provider_id && c.service_type === "consultation" && c.skill_domain_id === domainId)
        .map((c) => c.skill_subdomain_id)
    );
    return skillSubdomains.filter((sd) => sd.domain_id === domainId && usedIds.has(sd.id));
  }, [catalog, skillSubdomains, domainId]);

  // Providers who offer at least one active catalog item matching the active
  // tab's service type — narrowed further by domain/sub-domain on the ייעוץ tab.
  const serviceProviderIds = useMemo(() => {
    return new Set(
      catalog
        .filter((c) => {
          if (!c.is_active || !c.provider_id || c.service_type !== activeTab) return false;
          if (activeTab === "consultation") {
            if (domainId && c.skill_domain_id !== domainId) return false;
            if (subdomainId && c.skill_subdomain_id !== subdomainId) return false;
          }
          return true;
        })
        .map((c) => c.provider_id)
    );
  }, [catalog, activeTab, domainId, subdomainId]);

  const filteredProviders = useMemo(() => {
    const availabilityMax = AVAILABILITY_OPTIONS.find((a) => a.value === availability)?.maxDays ?? Infinity;
    const range = PRICE_RANGES.find((r) => r.value === priceRange);

    return publishedProviders.filter((p) => {
      if (!serviceProviderIds.has(p.id)) return false;
      if (query && !`${p.display_name} ${p.specialty}`.includes(query)) return false;

      if (activeTab === "consultation") {
        if (region && !p.clinic_locations.some((c) => getRegionForCity(c.city) === region)) return false;
        if (availabilityMax !== Infinity && nextAvailableInDays(p.id) > availabilityMax) return false;
        if (range?.value) {
          const consultation = p.consultation_types[0];
          const resolved = consultation ? resolveProviderPrice(consultation.prices, p.agreements, patient) : null;
          // Unknown price (no patient profile yet) is never excluded — only
          // filter out providers whose price we can actually resolve.
          if (resolved && (resolved.price < range.min || resolved.price > range.max)) return false;
        }
      }
      return true;
    });
  }, [publishedProviders, serviceProviderIds, query, activeTab, region, availability, priceRange, patient]);

  const canSearch = activeTab !== "consultation" || !!domainId;

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{title}</h1>
        <p className="text-slate-500 mt-2">{description}</p>
      </div>

      <Input
        placeholder="חיפוש חופשי — שם רופא / תחום"
        icon={<Search className="h-4 w-4" />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4"
      />

      <Tabs value={activeTab} onValueChange={(v) => changeTab(v as ServiceTab)}>
        <TabsList className="mb-5 max-w-lg mx-auto">
          {SERVICE_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="flex-1">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="consultation">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2.5 mb-2">
            <Select value={domainId} onChange={(e) => updateDomain(e.target.value)}>
              <option value="">תחום רפואי — בחרו תחום</option>
              {domainOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.emoji} {d.name_he}
                </option>
              ))}
            </Select>
            <Select value={subdomainId} onChange={(e) => setSubdomainId(e.target.value)} disabled={!domainId}>
              <option value="">כל תתי-התחומים</option>
              {subdomainOptions.map((sd) => (
                <option key={sd.id} value={sd.id}>
                  {sd.name_he}
                </option>
              ))}
            </Select>
            <Select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">כל הארץ</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <Select value={availability} onChange={(e) => setAvailability(e.target.value)}>
              {AVAILABILITY_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </Select>
            <Select value={priceRange} onChange={(e) => setPriceRange(e.target.value)}>
              {PRICE_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
          {!domainId && <p className="text-xs text-amber-600 mb-3">בחרו תחום רפואי כדי לחפש רופאים</p>}
        </TabsContent>

        <TabsContent value="diagnostics">
          <div className="rounded-xl border border-info-border bg-info-bg px-4 py-3 mb-4 flex items-center gap-2 text-sm text-info-text">
            <Info className="h-4 w-4 shrink-0" /> לבדיקות עם הפניה
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <Input
              placeholder="קוד הפניה (למשל REF-2345)"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
            />
            <label className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 h-10 text-sm text-slate-600 cursor-pointer hover:border-primary">
              <Upload className="h-4 w-4 shrink-0" />
              <span className="truncate">{referralFile ? referralFile.name : "העלאת הפניה (PDF / תמונה)"}</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setReferralFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </TabsContent>

        <TabsContent value="extra">
          <div className="rounded-xl border border-slate-200 bg-white p-4 mb-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-bg text-success-text">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">ביטוח, מסמכים, תרגומים</p>
                <p className="text-xs text-slate-500">צוות השירות שלנו זמין לכם ב-WhatsApp</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() =>
                showToast("פתיחת WhatsApp", { description: "בקרוב תוכלו לשוחח איתנו ישירות מכאן", variant: "success" })
              }
            >
              פתח שיחת WhatsApp
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-center mb-6">
        <Button size="lg" disabled={!canSearch} onClick={() => setSearched(true)}>
          <Search className="h-4 w-4" /> חפש רופאים
        </Button>
      </div>

      {searched &&
        (filteredProviders.length === 0 ? (
          <EmptyState icon={<Stethoscope className="h-10 w-10" />} title="לא נמצאו רופאים מתאימים" description="נסו לשנות את הסינון" />
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filteredProviders.map((p) => (
              <DoctorCard key={p.id} provider={p} patient={patient} onSelect={() => onSelect(p)} />
            ))}
          </div>
        ))}
    </div>
  );
}
