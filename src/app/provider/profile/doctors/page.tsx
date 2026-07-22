"use client";

import { ProfilePageFrame } from "@/components/provider/ProfilePageFrame";
import { AffiliatedDoctorsSection } from "@/components/provider/AffiliatedDoctorsSection";
import { getProviderSetupConfig } from "@/lib/provider-setup";
import { EmptyState } from "@/components/ui/Misc";
import { Stethoscope } from "lucide-react";

export default function ProviderDoctorsPage() {
  return (
    <ProfilePageFrame
      title="נותני שירות"
      description="ניהול נותני השירות הפועלים בארגון ושיוכם לפריטים"
    >
      {({ provider }) => {
        const setupConfig = getProviderSetupConfig(provider.provider_type);
        // Reachable by URL even for provider types that don't manage a roster
        // (the nav hides it) — explain rather than render an empty manager.
        if (!setupConfig.showAffiliatedDoctors) {
          return (
            <EmptyState
              icon={<Stethoscope className="h-10 w-10" />}
              title="ניהול נותני שירות אינו רלוונטי לסוג הספק שלך"
              description="ניהול נותני שירות משויכים זמין למרפאות חוץ ולמכונים רפואיים, שבהם הפריטים מבוצעים על ידי נותני שירות מטעם הארגון."
            />
          );
        }
        return <AffiliatedDoctorsSection provider={provider} />;
      }}
    </ProfilePageFrame>
  );
}
