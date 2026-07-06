"use client";

import { motion } from "framer-motion";
import { Star, MapPin, Languages } from "lucide-react";
import { Avatar } from "@/components/ui/Misc";
import { formatCurrency } from "@/lib/utils";
import { resolveProviderPrice } from "@/lib/pricing";
import { LAYER_LABELS, Patient, ProviderProfile } from "@/types";

export function DoctorCard({
  provider,
  patient,
  onSelect,
}: {
  provider: ProviderProfile;
  patient?: Patient | null;
  onSelect: () => void;
}) {
  const primaryClinic = provider.clinic_locations.find((c) => c.is_primary) ?? provider.clinic_locations[0];
  const consultation = provider.consultation_types[0];
  const resolvedPrice = consultation ? resolveProviderPrice(consultation.prices, provider.agreements, patient) : null;
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
        <Avatar name={provider.display_name} className="h-14 w-14 text-lg" />
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
        <p className="text-sm text-primary font-medium">{provider.specialty}</p>
      </div>
      {provider.bio && <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{provider.bio}</p>}
      <div className="flex flex-wrap gap-2 mt-1">
        {primaryClinic && (
          <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
            <MapPin className="h-3 w-3" /> {primaryClinic.city}
          </span>
        )}
        {provider.languages && provider.languages.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
            <Languages className="h-3 w-3" /> {provider.languages.join(", ")}
          </span>
        )}
      </div>
      <div className="mt-1 flex w-full items-center justify-between">
        {resolvedPrice ? (
          <span className="text-sm font-semibold text-slate-800">
            {formatCurrency(resolvedPrice.price)}{" "}
            <span className="text-xs font-normal text-emerald-600">{LAYER_LABELS[resolvedPrice.layer]}</span>
          </span>
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
