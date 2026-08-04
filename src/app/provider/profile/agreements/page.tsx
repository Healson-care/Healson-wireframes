"use client";

import { ProfilePageFrame } from "@/components/provider/ProfilePageFrame";
import { AgreementsSection } from "@/components/provider/AgreementsSection";
import { InheritedArrangementsCard } from "@/components/provider/InheritedArrangementsCard";
import { useStore } from "@/lib/store";
import { isUnitProviderType } from "@/types";
import { Building2 } from "lucide-react";

export default function ProviderAgreementsPage() {
  const affiliations = useStore((s) => s.affiliations);

  return (
    <ProfilePageFrame title="הסדרי ביטוח" description="הסדרי ביטוח (S/K/B/H), קופות וחברות ביטוח פרטיות">
      {({ provider, update }) => {
        const affiliated = affiliations.some(
          (a) => a.provider_id === provider.id && (a.status === "active" || a.status === "unclaimed")
        );
        // Arrangements belong to the entity that bills the payer (payments
        // meeting §5). A provider who works ONLY inside units has none of their
        // own — they inherit the unit's. One who also runs their own clinic
        // keeps this editor for that half of their practice, and reads the
        // inherited set below it.
        const billsIndependently = provider.clinic_locations.length > 0;
        const canEditOwn = billsIndependently || !affiliated;

        const isUnit = isUnitProviderType(provider.provider_type);

        return (
          <div className="flex flex-col gap-4">
            {isUnit && (
              <p className="flex items-start gap-2 rounded-lg bg-info-bg px-3 py-2 text-xs leading-relaxed text-info-text">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ההסדרים נקבעים ברמת היחידה וחלים על כל נותני השירות המשויכים אליה — אין הגדרת הסדרים נפרדת לכל
                רופא/ה.
              </p>
            )}

            {affiliated && (
              <p className="flex items-start gap-2 rounded-lg bg-info-bg px-3 py-2 text-xs leading-relaxed text-info-text">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {canEditOwn
                  ? "ההסדרים שמוגדרים כאן חלים על הפעילות במרפאות שלך בלבד. בפעילות בתוך יחידה רפואית חלים ההסדרים של אותה יחידה — ראו למטה."
                  : "כל הפעילות שלך מתבצעת בתוך יחידה רפואית, ולכן ההסדרים נקבעים ברמת היחידה ולא פר נותן/ת שירות. פתיחת מרפאה עצמאית תאפשר להגדיר כאן הסדרים משלך."}
              </p>
            )}

            {canEditOwn && (
              <AgreementsSection
                providerId={provider.id}
                agreements={provider.agreements}
                onChange={(agreements) => update({ agreements })}
                kupahArrangements={provider.kupah_arrangements ?? []}
                onKupahArrangementsChange={(kupah_arrangements) => update({ kupah_arrangements })}
                privateInsuranceCompanies={provider.private_insurance_companies ?? []}
                onPrivateInsuranceCompaniesChange={(private_insurance_companies) =>
                  update({ private_insurance_companies })
                }
              />
            )}

            <InheritedArrangementsCard provider={provider} />
          </div>
        );
      }}
    </ProfilePageFrame>
  );
}
