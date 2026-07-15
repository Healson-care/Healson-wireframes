"use client";

import { ProviderLayout } from "@/components/layouts/ProviderLayout";
import { useStore } from "@/lib/store";
import { useCurrentProvider } from "@/lib/useCurrentPatient";
import { PageHeader, Avatar } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { CardListSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { ProfileFieldsSection } from "@/components/provider/ProfileFieldsSection";
import { PROVIDER_STATUS_LABELS } from "@/types";
import { BadgeCheck, Star } from "lucide-react";

export default function ProviderProfilePage() {
  const currentUser = useStore((s) => s.currentUser);
  const provider = useCurrentProvider();
  const upsertProviderProfile = useStore((s) => s.upsertProviderProfile);
  const showToast = useStore((s) => s.showToast);

  if (!provider || !currentUser) {
    return (
      <ProviderLayout>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <CardListSkeleton count={2} />
        </div>
      </ProviderLayout>
    );
  }

  return (
    <ProviderLayout>
      <PageHeader title="הפרופיל שלי" description="פרטים אישיים ומקצועיים — חלקם ניתנים לעריכה עצמאית, וחלקם דורשים אישור Healson" />

      <div className="relative mb-6 overflow-hidden rounded-2xl border border-neutral-border bg-gradient-to-l from-white via-white to-accent-bg/40 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar name={provider.display_name || currentUser.full_name} src={provider.image_url} className="h-16 w-16 text-xl ring-4 ring-white shadow-md" />
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900">
                {provider.title} {provider.display_name}
              </h2>
              {provider.status === "approved" ? (
                <Badge tone="green">
                  <BadgeCheck className="h-3 w-3" /> מאושר
                </Badge>
              ) : (
                <Badge tone="amber">{PROVIDER_STATUS_LABELS[provider.status]}</Badge>
              )}
              {provider.is_published && <Badge tone="blue">פעיל</Badge>}
            </div>
            <p className="text-sm text-amber-700 font-medium mt-0.5">{provider.specialty || "—"}</p>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {provider.license_number && <p className="text-xs text-slate-400 font-mono">{provider.license_number}</p>}
              {!!provider.rating && (
                <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {provider.rating.toFixed(1)} ({provider.review_count ?? 0} ביקורות)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <ProfileFieldsSection
        provider={provider}
        onSave={(data) => upsertProviderProfile(currentUser.id, data)}
        showToast={showToast}
      />
    </ProviderLayout>
  );
}
