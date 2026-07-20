"use client";

import { ProfilePageFrame } from "@/components/provider/ProfilePageFrame";
import { OpenDecisionNote } from "@/components/ui/Misc";
import { ServiceCatalogSection } from "@/components/provider/ServiceCatalogSection";
import { PriceListEntry, PriceListSection } from "@/components/provider/PriceListSection";
import { getProviderSetupConfig } from "@/lib/provider-setup";

export default function ProviderServicesPage() {
  return (
    <ProfilePageFrame title="שירותים ומחירים" description="ניהול הקטלוג והמחירים לכל שכבת ביטוח">
      {({ provider, update }) => {
        const setupConfig = getProviderSetupConfig(provider.provider_type);
        return (
          <>
            <OpenDecisionNote>
              <b>טרם הוחלט:</b> מדיניות תמחור סופית עדיין לא נקבעה ע&quot;י הנהלת Healson — כרגע אתם קובעים בעצמכם את
              המחיר לכל שכבת ביטוח (S/K/B/H).
            </OpenDecisionNote>
            {setupConfig.useSkillTreeCatalog ? (
              <ServiceCatalogSection
                items={provider.consultation_types}
                onChange={(items) => update({ consultation_types: items })}
                providerId={provider.id}
                itemLabel={setupConfig.catalogItemLabel}
                providerSpecialty={provider.specialty}
                providerType={provider.provider_type}
              />
            ) : (
              <PriceListSection
                items={provider.consultation_types as unknown as PriceListEntry[]}
                onChange={(items) => update({ consultation_types: items as unknown as typeof provider.consultation_types })}
                extraFieldKey={setupConfig.catalogExtraFieldKey}
                extraFieldLabel={setupConfig.catalogExtraFieldLabel}
                extraFieldType={setupConfig.catalogExtraFieldType}
                itemLabel={setupConfig.catalogItemLabel}
              />
            )}
          </>
        );
      }}
    </ProfilePageFrame>
  );
}
