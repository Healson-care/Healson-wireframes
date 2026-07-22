"use client";

import { ProfilePageFrame } from "@/components/provider/ProfilePageFrame";
import { FacilitiesSection } from "@/components/provider/FacilitiesSection";
import { getProviderSetupConfig } from "@/lib/provider-setup";
import { EmptyState } from "@/components/ui/Misc";
import { MonitorCog } from "lucide-react";

export default function ProviderFacilitiesPage() {
  return (
    <ProfilePageFrame
      title="חדרים"
      description="המכשירים והחדרים של היחידה — לכל אחד תור, לוח זמנים ופריטים משלו"
    >
      {({ provider, update }) => {
        const setupConfig = getProviderSetupConfig(provider.provider_type);
        // Reachable by URL even for provider types with no facilities (the nav
        // hides it) — explain rather than render an empty manager.
        if (!setupConfig.showFacilities) {
          return (
            <EmptyState
              icon={<MonitorCog className="h-10 w-10" />}
              title="ניהול חדרים אינו רלוונטי לסוג הספק שלך"
              description="ניהול חדרים זמין ליחידות רפואיות (מכון רפואי / מרפאת חוץ), שבהן הפריטים מבוצעים על מכשירים וחדרים ייעודיים."
            />
          );
        }
        return (
          <FacilitiesSection
            facilities={provider.facilities ?? []}
            services={provider.consultation_types}
            onChange={(facilities) => update({ facilities })}
          />
        );
      }}
    </ProfilePageFrame>
  );
}
