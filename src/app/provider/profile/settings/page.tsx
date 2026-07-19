"use client";

import { ProfilePageFrame } from "@/components/provider/ProfilePageFrame";
import { ProfileFieldsSection } from "@/components/provider/ProfileFieldsSection";
import { ReferralFormsSection } from "@/components/provider/ReferralFormsSection";

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
            <h2 className="mb-3 text-sm font-semibold text-slate-500">תבניות הפניה</h2>
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
