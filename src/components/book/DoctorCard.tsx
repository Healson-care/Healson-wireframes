"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Star, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/Misc";
import { resolvePriceBreakdown } from "@/lib/pricing";
import { InsurancePriceBlock } from "@/components/book/InsurancePriceBlock";
import { useStore } from "@/lib/store";
import { yearsSince } from "@/lib/utils";
import { Patient, ProviderProfile } from "@/types";

export function DoctorCard({
  provider,
  patient,
  onSelect,
}: {
  provider: ProviderProfile;
  patient?: Patient | null;
  onSelect: () => void;
}) {
  const catalog = useStore((s) => s.catalog);
  const skillSubdomains = useStore((s) => s.skillSubdomains);

  const primaryClinic = provider.clinic_locations.find((c) => c.is_primary) ?? provider.clinic_locations[0];
  const consultation = provider.consultation_types[0];
  const breakdown = consultation ? resolvePriceBreakdown(consultation.prices, provider.agreements, patient) : null;
  const experienceYears = yearsSince(provider.license_issue_date);

  // Sub-domains this doctor is discoverable under (§5 skill taxonomy) —
  // derived from their own consultation-type catalog items, not free text.
  const subdomainNames = useMemo(() => {
    const ids = new Set(
      catalog
        .filter((c) => c.provider_id === provider.id && c.service_type === "consultation" && c.is_active)
        .map((c) => c.skill_subdomain_id)
    );
    return skillSubdomains.filter((sd) => ids.has(sd.id)).map((sd) => sd.name_he);
  }, [catalog, skillSubdomains, provider.id]);

  return (
    <motion.button
      onClick={onSelect}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="group flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-sm hover:shadow-xl hover:border-primary/30"
    >
      <div className="flex w-full items-start justify-between">
        <Avatar name={provider.display_name} src={provider.image_url} className="h-14 w-14 text-lg" />
        {provider.rating && (
          <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> {provider.rating}
            <span className="text-amber-500/70">({provider.review_count})</span>
          </span>
        )}
      </div>

      <div>
        <p className="font-semibold text-slate-900">
          {provider.title} {provider.display_name}
        </p>
        <p className="text-sm text-primary font-medium">
          {provider.specialty}
          {experienceYears != null && <span className="text-slate-400 font-normal"> · {experienceYears} שנות ניסיון</span>}
        </p>
        {subdomainNames.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {subdomainNames.map((name) => (
              <span key={name} className="rounded-full bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      {provider.bio && <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{provider.bio}</p>}

      {primaryClinic && (
        <div className="flex w-full items-start gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-xs">
          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <p className="font-medium text-slate-700 truncate">{primaryClinic.name}</p>
            <p className="text-slate-500 truncate">
              {primaryClinic.address}, {primaryClinic.city}
            </p>
          </div>
        </div>
      )}

      <div className="mt-1 flex w-full items-end justify-between">
        {breakdown ? (
          <InsurancePriceBlock breakdown={breakdown} />
        ) : (
          <span className="text-xs text-slate-400">הרשמה להצגת מחיר</span>
        )}
        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-all group-hover:gap-2">
          קביעת תור ←
        </span>
      </div>
    </motion.button>
  );
}
