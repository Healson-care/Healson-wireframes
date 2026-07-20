"use client";

import { ProfilePageFrame } from "@/components/provider/ProfilePageFrame";
import { AvailabilitySection } from "@/components/provider/AvailabilitySection";
import { BlockedDatesSection } from "@/components/provider/BlockedDatesSection";
import { getProviderSetupConfig } from "@/lib/provider-setup";

export default function ProviderAvailabilityPage() {
  return (
    <ProfilePageFrame
      title="זמינות ולוח זמנים"
      description="משמרות, הפסקות, חריגות ותאריכים חסומים — לכל מיקום בנפרד"
    >
      {({ provider, update }) => {
        const setupConfig = getProviderSetupConfig(provider.provider_type);
        return (
          <div className="flex flex-col gap-4">
            <AvailabilitySection
              clinics={provider.clinic_locations}
              onChange={(clinics) => update({ clinic_locations: clinics })}
              services={provider.consultation_types}
              locationLabelSingular={setupConfig.locationLabelSingular}
              locationLabelPlural={setupConfig.locationLabelPlural}
            />
            <BlockedDatesSection
              blockedDates={provider.blocked_dates ?? []}
              onChange={(blocked_dates) => update({ blocked_dates })}
            />
          </div>
        );
      }}
    </ProfilePageFrame>
  );
}
