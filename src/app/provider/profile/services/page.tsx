"use client";

import { ProfilePageFrame } from "@/components/provider/ProfilePageFrame";
import {
  ResourceTarget,
  ServiceArrayTarget,
  ServiceCatalogSection,
} from "@/components/provider/ServiceCatalogSection";
import { PriceListEntry, PriceListSection } from "@/components/provider/PriceListSection";
import { SoloItemCatalogSection } from "@/components/provider/SoloItemCatalogSection";
import { getProviderSetupConfig } from "@/lib/provider-setup";
import { useStore } from "@/lib/store";
import { isPractitionerProviderType } from "@/types";

export default function ProviderServicesPage() {
  const allProviders = useStore((s) => s.providers);
  const organizationBranches = useStore((s) => s.organizationBranches);
  const serviceArrays = useStore((s) => s.serviceArrays);
  return (
    <ProfilePageFrame title="פריטים ומחירים" description="הזנת פריטים לפי קוד מהקטלוג והמחירים לכל שכבת ביטוח">
      {({ provider, update }) => {
        const setupConfig = getProviderSetupConfig(provider.provider_type);
        // The unit's מערכים, and the עמדות inside each — an item is assigned to
        // a מערך, and only narrowed to specific עמדות when their לו״זים differ.
        const unitBranches = organizationBranches.filter((b) => b.unit_id === provider.id);
        const branchIds = new Set(unitBranches.map((b) => b.id));
        const serviceArrayTargets: ServiceArrayTarget[] = serviceArrays
          .filter((a) => branchIds.has(a.branch_id))
          .map((a) => ({
            id: a.id,
            name: a.name,
            branchName: unitBranches.find((b) => b.id === a.branch_id)?.name,
          }));
        const roomTargets: ResourceTarget[] = (provider.facilities ?? []).map((f) => ({
          id: f.id,
          name: f.name,
          service_ids: f.service_ids ?? [],
          service_array_id: f.service_array_id,
          kind: "facility",
          hasSchedule: !!f.schedule || !!f.schedule_id,
        }));
        const providerTargets: ResourceTarget[] = (provider.affiliated_doctors ?? []).map((a) => ({
          id: a.id,
          name: allProviders.find((p) => p.id === a.doctor_provider_id)?.display_name ?? "נותן/ת שירות",
          service_ids: a.service_ids ?? [],
          service_array_id: a.service_array_id,
          kind: "doctor",
          hasSchedule: !!a.schedule || !!a.schedule_id,
        }));
        // An individual provider (רופא/מטפל) writes their own items rather than
        // picking them out of a reference catalog — a different editor entirely
        // (see SoloItemCatalogSection). Units keep the code-based entry.
        if (isPractitionerProviderType(provider.provider_type)) {
          return (
            <SoloItemCatalogSection
              items={provider.consultation_types}
              onChange={(items) => update({ consultation_types: items })}
              itemLabel={setupConfig.catalogItemLabel}
              subSpecialties={provider.sub_specialties ?? []}
              kupahArrangements={provider.kupah_arrangements ?? []}
              privateInsurers={provider.private_insurance_companies ?? []}
              isSurgeon={provider.provider_type === "doctor" && provider.doctor_subtype === "surgeon"}
              clinics={provider.clinic_locations}
              locationLabelSingular={setupConfig.locationLabelSingular}
              locationLabelPlural={setupConfig.locationLabelPlural}
            />
          );
        }
        return (
          <>
            <p className="mb-4 -mt-3 text-xs leading-relaxed text-slate-500">
              מחירי S ו-H נקבעים תמיד לפי מחירון משרד הבריאות ואינם ניתנים לעריכה; את תעריפי K/B ואת מחיר
              הפריט P בקטלוג הילסון אתם מזינים.
            </p>
            {setupConfig.useSkillTreeCatalog ? (
              <ServiceCatalogSection
                items={provider.consultation_types}
                onChange={(items) => update({ consultation_types: items })}
                providerId={provider.id}
                itemLabel={setupConfig.catalogItemLabel}
                providerType={provider.provider_type}
                roomTargets={roomTargets}
                providerTargets={providerTargets}
                serviceArrayTargets={serviceArrayTargets}
                onAssignResources={(serviceId, sel) =>
                  update({
                    facilities: (provider.facilities ?? []).map((f) => ({
                      ...f,
                      service_ids: sel.roomIds.includes(f.id)
                        ? [...new Set([...(f.service_ids ?? []), serviceId])]
                        : (f.service_ids ?? []).filter((id) => id !== serviceId),
                    })),
                    affiliated_doctors: (provider.affiliated_doctors ?? []).map((a) => ({
                      ...a,
                      service_ids: sel.providerIds.includes(a.id)
                        ? [...new Set([...(a.service_ids ?? []), serviceId])]
                        : (a.service_ids ?? []).filter((id) => id !== serviceId),
                    })),
                  })
                }
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
