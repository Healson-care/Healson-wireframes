"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardSkeleton } from "@/components/ui/Skeleton";

// Onboarding is no longer a separate wizard — it lives inside the provider
// dashboard now (the onboarding-progress banner + setup tabs). This route is
// kept only so any existing links/bookmarks land in the right place.
export default function ProviderOnboardingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/provider/dashboard");
  }, [router]);
  return <DashboardSkeleton />;
}
