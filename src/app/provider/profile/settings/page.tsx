"use client";

import { ProfilePageFrame } from "@/components/provider/ProfilePageFrame";
import { ProfileFieldsSection } from "@/components/provider/ProfileFieldsSection";
import { ReferralFormsSection } from "@/components/provider/ReferralFormsSection";
import { SectionHeading } from "@/components/ui/Misc";

export default function ProviderSettingsPage() {
  return (
    <ProfilePageFrame
      title="הגדרות פרופיל"
      description="פרטים אישיים ומקצועיים — חלקם ניתנים לעריכה עצמאית, וחלקם דורשים אישור Healson"
    >
      {({ provider, update, showToast }) => (
        <div className="flex flex-col gap-6">
          <ProfileFieldsSection provider={provider} onSave={(data) => update(data)} showToast={showToast} />
          <div>
            <SectionHeading>תבניות הפניה</SectionHeading>
            <ReferralFormsSection
              forms={provider.referral_forms}
              onChange={(forms) => update({ referral_forms: forms })}
            />
          </div>
        </div>
      )}
    </ProfilePageFrame>
  );
}
