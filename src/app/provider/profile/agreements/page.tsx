"use client";

import { ProfilePageFrame } from "@/components/provider/ProfilePageFrame";
import { AgreementsSection } from "@/components/provider/AgreementsSection";

export default function ProviderAgreementsPage() {
  return (
    <ProfilePageFrame title="הסדרי ביטוח" description="הסדרי ביטוח (S/K/B/H), קופות וחברות ביטוח פרטיות">
      {({ provider, update }) => (
        <AgreementsSection
          providerId={provider.id}
          agreements={provider.agreements}
          onChange={(agreements) => update({ agreements })}
          kupahArrangements={provider.kupah_arrangements ?? []}
          onKupahArrangementsChange={(kupah_arrangements) => update({ kupah_arrangements })}
          privateInsuranceCompanies={provider.private_insurance_companies ?? []}
          onPrivateInsuranceCompaniesChange={(private_insurance_companies) => update({ private_insurance_companies })}
        />
      )}
    </ProfilePageFrame>
  );
}
