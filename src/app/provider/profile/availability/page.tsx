"use client";

import { ProfilePageFrame } from "@/components/provider/ProfilePageFrame";
import { AvailabilitySection } from "@/components/provider/AvailabilitySection";
import { UnitAvailabilitySection } from "@/components/provider/UnitAvailabilitySection";
import { BlockedDatesSection } from "@/components/provider/BlockedDatesSection";
import { getProviderSetupConfig } from "@/lib/provider-setup";
import { useStore } from "@/lib/store";

export default function ProviderAvailabilityPage() {
  const appointments = useStore((s) => s.appointments);

  return (
    <ProfilePageFrame title="זמינות ולוח זמנים">
      {({ provider, update }) => {
        const setupConfig = getProviderSetupConfig(provider.provider_type);
        // A medical unit has no single calendar: availability is owned by each
        // מתקן and each רופא/ה, with a unit-level overview on top (§PRV-08).
        const isUnit = setupConfig.showFacilities;
        return (
          <div className="flex flex-col gap-4">
            <p className="-mt-3 text-sm text-slate-500">
              {isUnit
                ? "ביחידה רפואית הזמינות היא ברמת המשאב — לכל חדר ולכל נותן/ת שירות לוח זמנים משלו, ומטופלים יכולים להיקבע במקביל על משאבים שונים."
                : "פתחו משמרות ישירות על היומן — כל שעה שתפתחו כאן היא שעה שמטופלים יוכלו לקבוע בה תור. הפסקות, חריגות ותאריכים חסומים — לכל מיקום בנפרד."}
            </p>
            {isUnit ? (
              <UnitAvailabilitySection provider={provider} onChange={update} />
            ) : (
              <AvailabilitySection
                clinics={provider.clinic_locations}
                onChange={(clinics) => update({ clinic_locations: clinics })}
                services={provider.consultation_types}
                appointments={appointments.filter(
                  (a) => a.provider_id === provider.id || a.practitioner_id === provider.id
                )}
                locationLabelSingular={setupConfig.locationLabelSingular}
                locationLabelPlural={setupConfig.locationLabelPlural}
              />
            )}
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
