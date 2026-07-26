"use client";

import { ProfilePageFrame } from "@/components/provider/ProfilePageFrame";
import { ServiceArraysManager } from "@/components/units/ServiceArraysManager";
import { getProviderSetupConfig } from "@/lib/provider-setup";
import { EmptyState } from "@/components/ui/Misc";
import { Layers } from "lucide-react";

export default function ProviderServiceArraysPage() {
  return (
    <ProfilePageFrame
      title="מערכים"
      description="קווי השירות של היחידה. בכל מערך יש עמדות — ציוד או נותני שירות — ולכל עמדה לו״ז משלה."
    >
      {({ provider }) => {
        const setupConfig = getProviderSetupConfig(provider.provider_type);
        if (!setupConfig.showFacilities) {
          return (
            <EmptyState
              icon={<Layers className="h-10 w-10" />}
              title="ניהול מערכים אינו רלוונטי לסוג הספק שלך"
              description="זמין ליחידות רפואיות (מכון רפואי / מרפאת חוץ) המחלקות את פעילותן לקווי שירות."
            />
          );
        }
        return <ServiceArraysManager provider={provider} />;
      }}
    </ProfilePageFrame>
  );
}
