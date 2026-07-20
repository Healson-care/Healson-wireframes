"use client";

import { ProfilePageFrame } from "@/components/provider/ProfilePageFrame";
import { AffiliatedDoctorsSection } from "@/components/provider/AffiliatedDoctorsSection";
import { getProviderSetupConfig } from "@/lib/provider-setup";
import { EmptyState } from "@/components/ui/Misc";
import { Stethoscope } from "lucide-react";

export default function ProviderDoctorsPage() {
  return (
    <ProfilePageFrame
      title="רופאים"
      description="ניהול הרופאים הפועלים בארגון ושיוכם לשירותים"
    >
      {({ provider }) => {
        const setupConfig = getProviderSetupConfig(provider.provider_type);
        // Reachable by URL even for provider types that don't manage a roster
        // (the nav hides it) — explain rather than render an empty manager.
        if (!setupConfig.showAffiliatedDoctors) {
          return (
            <EmptyState
              icon={<Stethoscope className="h-10 w-10" />}
              title="ניהול רופאים אינו רלוונטי לסוג הספק שלך"
              description="ניהול רופאים משויכים זמין למרפאות חוץ ולמכונים רפואיים, שבהם השירותים מבוצעים על ידי רופאים מטעם הארגון."
            />
          );
        }
        return <AffiliatedDoctorsSection provider={provider} />;
      }}
    </ProfilePageFrame>
  );
}
