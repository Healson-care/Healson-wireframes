"use client";

import { ProfilePageFrame } from "@/components/provider/ProfilePageFrame";
import { UnitStructureSection } from "@/components/units/UnitStructureSection";
import { getProviderSetupConfig } from "@/lib/provider-setup";
import { EmptyState } from "@/components/ui/Misc";
import { Network } from "lucide-react";

export default function ProviderStructurePage() {
  return (
    <ProfilePageFrame
      title="סניפים"
      description="האתרים הפיזיים של היחידה. כל סניף מכיל מערכים (קווי שירות) — אותם מנהלים בלשונית ‚מערכים‘."
    >
      {({ provider }) => {
        const setupConfig = getProviderSetupConfig(provider.provider_type);
        // Only medical units have branches + מערכים; explain rather than render
        // an empty manager for provider types reaching this by URL.
        if (!setupConfig.showFacilities) {
          return (
            <EmptyState
              icon={<Network className="h-10 w-10" />}
              title="ניהול סניפים אינו רלוונטי לסוג הספק שלך"
              description="זמין ליחידות רפואיות (מכון רפואי / מרפאת חוץ) הפועלות בכמה אתרים וקווי שירות."
            />
          );
        }
        return <UnitStructureSection unitId={provider.id} />;
      }}
    </ProfilePageFrame>
  );
}
