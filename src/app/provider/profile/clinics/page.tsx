"use client";

import { ProfilePageFrame } from "@/components/provider/ProfilePageFrame";
import { ClinicsSection } from "@/components/provider/ClinicsSection";
import { ProviderUnitsCard } from "@/components/provider/ProviderUnitsCard";
import { getProviderSetupConfig } from "@/lib/provider-setup";

export default function ProviderClinicsPage() {
  return (
    <ProfilePageFrame title="מיקומים">
      {({ provider, update }) => {
        const setupConfig = getProviderSetupConfig(provider.provider_type);
        return (
          <div className="flex flex-col gap-6">
            <ClinicsSection
              clinics={provider.clinic_locations}
              onChange={(clinics) => update({ clinic_locations: clinics })}
              allowedLocationTypes={setupConfig.locationTypes}
              locationLabelSingular={setupConfig.locationLabelSingular}
              locationLabelPlural={setupConfig.locationLabelPlural}
              singleLocation={setupConfig.singleLocation}
              unitName={provider.display_name}
              services={provider.consultation_types}
              onServicesChange={(consultation_types) => update({ consultation_types })}
            />
            {/* §PRV-10 — besides their own private clinics, an individual provider
                can belong to a medical unit: search & join it here, and once
                affiliated they see the unit-entered schedule read-only. Self-hides
                for unit providers (the unit isn't affiliated to itself). */}
            <ProviderUnitsCard provider={provider} />
          </div>
        );
      }}
    </ProfilePageFrame>
  );
}
