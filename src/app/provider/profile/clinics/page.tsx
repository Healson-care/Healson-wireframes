"use client";

import { ProfilePageFrame } from "@/components/provider/ProfilePageFrame";
import { ClinicsSection } from "@/components/provider/ClinicsSection";
import { LocationSpreadCard } from "@/components/provider/LocationSpreadCard";
import { ProviderUnitsCard } from "@/components/provider/ProviderUnitsCard";
import { getProviderSetupConfig } from "@/lib/provider-setup";
import { useCurrentProvider } from "@/lib/useCurrentPatient";
import { isPractitionerProviderType } from "@/types";

export default function ProviderClinicsPage() {
  // The page is called what this provider's locations are actually called —
  // "סניפים" for an individual provider, "מרפאות"/"מיקומי טיפול" elsewhere.
  const provider = useCurrentProvider();
  const title = provider ? getProviderSetupConfig(provider.provider_type).locationLabelPlural : "מיקומים";
  return (
    <ProfilePageFrame title={title}>
      {({ provider, update }) => {
        const setupConfig = getProviderSetupConfig(provider.provider_type);
        return (
          <div className="flex flex-col gap-6">
            {/* The "how many sites do you work from" declaration — asked here,
                in הקמה, rather than in the application form, since it is only
                meaningful next to the actual branch list. */}
            {isPractitionerProviderType(provider.provider_type) && (
              <LocationSpreadCard
                value={provider.location_count}
                branchCount={provider.clinic_locations.length}
                onChange={(location_count) => update({ location_count })}
              />
            )}
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
