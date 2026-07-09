"use client";

import { useMemo, useState } from "react";
import { Search, Languages, Stethoscope } from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Misc";
import { DoctorCard } from "@/components/book/DoctorCard";
import { KUPAH_LOGOS } from "@/lib/medical-tree";
import { getRegionForCity } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { KUPOT, Kupah, Patient, ProviderProfile } from "@/types";

export function ProviderDiscovery({
  providers,
  patient,
  defaultKupah = "",
  title = "מצאו את הרופא המתאים לכם",
  description = "סננו לפי אזור, תחום, שפה וקופת חולים — ותוצאות מתעדכנות מיידית",
  showLanguageFilter = true,
  showKupahFilter = true,
  onSelect,
  onKupahChange,
}: {
  providers: ProviderProfile[];
  patient?: Patient | null;
  defaultKupah?: Kupah | "";
  title?: string;
  description?: string;
  showLanguageFilter?: boolean;
  showKupahFilter?: boolean;
  onSelect: (provider: ProviderProfile) => void;
  onKupahChange?: (kupah: Kupah | "") => void;
}) {
  const catalog = useStore((s) => s.catalog);
  const skillDomains = useStore((s) => s.skillDomains);
  const skillSubdomains = useStore((s) => s.skillSubdomains);

  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [domainId, setDomainId] = useState("");
  const [subdomainId, setSubdomainId] = useState("");
  const [language, setLanguage] = useState("");
  const [kupah, setKupah] = useState<Kupah | "">(defaultKupah);

  function updateKupah(value: Kupah | "") {
    setKupah(value);
    onKupahChange?.(value);
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

  // Skill hierarchy (§5): only offer domains/sub-domains that actually route
  // to a bookable provider through an active catalog item.
  const domainOptions = useMemo(() => {
    const usedIds = new Set(catalog.filter((c) => c.is_active && c.provider_id).map((c) => c.skill_domain_id));
    return skillDomains.filter((d) => usedIds.has(d.id));
  }, [catalog, skillDomains]);

  const subdomainOptions = useMemo(() => {
    if (!domainId) return [];
    const usedIds = new Set(
      catalog
        .filter((c) => c.is_active && c.provider_id && c.skill_domain_id === domainId)
        .map((c) => c.skill_subdomain_id)
    );
    return skillSubdomains.filter((sd) => sd.domain_id === domainId && usedIds.has(sd.id));
  }, [catalog, skillSubdomains, domainId]);

  const languages = useMemo(() => {
    const set = new Set<string>();
    publishedProviders.forEach((p) => (p.languages ?? []).forEach((l) => set.add(l)));
    return Array.from(set);
  }, [publishedProviders]);

  const domainProviderIds = useMemo(() => {
    if (!domainId) return null;
    return new Set(
      catalog
        .filter(
          (c) =>
            c.is_active &&
            c.provider_id &&
            c.skill_domain_id === domainId &&
            (!subdomainId || c.skill_subdomain_id === subdomainId)
        )
        .map((c) => c.provider_id)
    );
  }, [catalog, domainId, subdomainId]);

  const filteredProviders = useMemo(() => {
    return publishedProviders.filter((p) => {
      if (region && !p.clinic_locations.some((c) => getRegionForCity(c.city) === region)) return false;
      if (domainProviderIds && !domainProviderIds.has(p.id)) return false;
      if (showLanguageFilter && language && !(p.languages ?? []).includes(language)) return false;
      if (
        showKupahFilter &&
        kupah &&
        !p.agreements.some(
          (a) => (a.layer === "S" || a.layer === "K") && (!a.kupah_list?.length || a.kupah_list.includes(kupah))
        )
      )
        return false;
      if (query && !`${p.display_name} ${p.specialty}`.includes(query)) return false;
      return true;
    });
  }, [publishedProviders, region, domainProviderIds, showLanguageFilter, language, showKupahFilter, kupah, query]);

  return (
    <div>
      <div className="text-center mb-7">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{title}</h1>
        <p className="text-slate-500 mt-2">{description}</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-2.5 mb-8">
        <Input
          placeholder="חיפוש רופא / תחום..."
          icon={<Search className="h-4 w-4" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="lg:col-span-2"
        />
        <Select value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">כל האזורים</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
        <Select value={domainId} onChange={(e) => updateDomain(e.target.value)}>
          <option value="">כל התחומים</option>
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
        {showKupahFilter && (
          <Select value={kupah} onChange={(e) => updateKupah(e.target.value as Kupah | "")}>
            <option value="">כל הקופות</option>
            {KUPOT.map((k) => (
              <option key={k} value={k}>
                {KUPAH_LOGOS[k]} {k}
              </option>
            ))}
          </Select>
        )}
      </div>

      {showLanguageFilter && languages.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6 -mt-3">
          {languages.map((l) => (
            <button
              key={l}
              onClick={() => setLanguage(language === l ? "" : l)}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                language === l ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Languages className="h-3 w-3" /> {l}
            </button>
          ))}
        </div>
      )}

      {filteredProviders.length === 0 ? (
        <EmptyState icon={<Stethoscope className="h-10 w-10" />} title="לא נמצאו רופאים מתאימים" description="נסו לשנות את הסינון" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filteredProviders.map((p) => (
            <DoctorCard key={p.id} provider={p} patient={patient} onSelect={() => onSelect(p)} />
          ))}
        </div>
      )}
    </div>
  );
}
