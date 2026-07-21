"use client";

import { ReactNode } from "react";
import { ProviderLayout } from "@/components/layouts/ProviderLayout";
import { useStore } from "@/lib/store";
import { useCurrentProvider } from "@/lib/useCurrentPatient";
import { PageHeader } from "@/components/ui/Misc";
import { SaveIndicator, useSaveFlash } from "@/components/ui/SaveIndicator";
import { CardListSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { OnboardingProgress } from "@/components/provider/OnboardingProgress";
import type { ProviderProfile, User } from "@/types";

export interface ProfileCtx {
  provider: ProviderProfile;
  currentUser: User;
  /** Persist a partial update to the current provider's profile. */
  update: (data: Partial<ProviderProfile>) => void;
  showToast: ReturnType<typeof useStore.getState>["showToast"];
}

/** Shared shell for every provider PROFILE configuration page. Handles the
 * store-hydration skeleton and a consistent header, then hands the resolved
 * provider/user to the page via a render prop — so each page stays a thin
 * wrapper around its existing section component. */
export function ProfilePageFrame({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: (ctx: ProfileCtx) => ReactNode;
}) {
  const currentUser = useStore((s) => s.currentUser);
  const provider = useCurrentProvider();
  const upsertProviderProfile = useStore((s) => s.upsertProviderProfile);
  const showToast = useStore((s) => s.showToast);
  // Save policy: profile-config pages auto-save on every change, so instead of
  // toasting each write we flash a subtle "נשמר" in the page header. Every
  // section funnels its mutations through ctx.update, making this one hook the
  // feedback point for the whole config area.
  const [savedVisible, flashSaved] = useSaveFlash();

  if (!provider || !currentUser) {
    return (
      <ProviderLayout>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-48" />
          <CardListSkeleton count={2} />
        </div>
      </ProviderLayout>
    );
  }

  const ctx: ProfileCtx = {
    provider,
    currentUser,
    update: (data) => {
      upsertProviderProfile(currentUser.id, data);
      flashSaved();
    },
    showToast,
  };

  return (
    <ProviderLayout>
      <PageHeader title={title} description={description} actions={<SaveIndicator visible={savedVisible} />} />
      {/* During the onboarding stage the progress meter rides along at the top
          of every profile-config page, so it's always visible until go-live. */}
      {provider.status === "onboarding" && <OnboardingProgress provider={provider} className="mb-6" />}
      {children(ctx)}
    </ProviderLayout>
  );
}
