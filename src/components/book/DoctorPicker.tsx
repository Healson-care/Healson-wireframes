"use client";

import { ArrowRight, Stethoscope } from "lucide-react";
import { EmptyState } from "@/components/ui/Misc";
import { DoctorCard } from "@/components/book/DoctorCard";
import { SelectedServiceItem } from "@/components/book/ServiceDiscovery";
import { ConsultationType, Patient, ProviderProfile } from "@/types";

export function DoctorPicker({
  providers,
  item,
  patient,
  onSelect,
  onBack,
}: {
  providers: ProviderProfile[];
  item: SelectedServiceItem;
  patient?: Patient | null;
  onSelect: (provider: ProviderProfile) => void;
  onBack: () => void;
}) {
  // Re-match the chosen item against each provider's own consultation_types
  // (there's no shared catalog id) so the doctor card — and everything
  // downstream — prices and books the exact service the patient picked,
  // never just the provider's first listed service.
  const matches = providers
    .filter((p) => p.is_published)
    .map((p) => ({
      provider: p,
      consultationType: p.consultation_types.find((ct) => ct.name === item.name && ct.service_type === item.service_type),
    }))
    .filter((m): m is { provider: ProviderProfile; consultationType: ConsultationType } => !!m.consultationType);

  return (
    <div>
      <button onClick={onBack} className="text-sm text-primary mb-4 flex items-center gap-1">
        <ArrowRight className="h-3.5 w-3.5" /> בחירת שירות אחר
      </button>

      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">בחרו רופא/ה</h2>
        <p className="text-slate-500 text-sm mt-1">מי יבצע עבורכם את &quot;{item.name}&quot;?</p>
      </div>

      {matches.length === 0 ? (
        <EmptyState icon={<Stethoscope className="h-10 w-10" />} title="לא נמצאו רופאים זמינים לשירות זה" description="נסו לבחור שירות אחר" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {matches.map(({ provider, consultationType }) => (
            <DoctorCard
              key={provider.id}
              provider={provider}
              patient={patient}
              consultationType={consultationType}
              onSelect={() => onSelect(provider)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
