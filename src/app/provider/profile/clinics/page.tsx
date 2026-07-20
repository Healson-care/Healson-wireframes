"use client";

import { ProfilePageFrame } from "@/components/provider/ProfilePageFrame";
import { ClinicsSection } from "@/components/provider/ClinicsSection";
import { getProviderSetupConfig } from "@/lib/provider-setup";

export default function ProviderClinicsPage() {
  return (
    <ProfilePageFrame title="מיקומים">
      {({ provider, update }) => {
        const setupConfig = getProviderSetupConfig(provider.provider_type);
        return (
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
        );
      }}
    </ProfilePageFrame>
  );
}
