"use client";

import Link from "next/link";
import { ProviderLayout } from "@/components/layouts/ProviderLayout";
import { useStore } from "@/lib/store";
import { useCurrentProvider } from "@/lib/useCurrentPatient";
import { Card, CardContent } from "@/components/ui/Card";
import { ProviderStatusBadge, ProviderPublishedBadge } from "@/components/ui/Badge";
import { Avatar, SectionHeading } from "@/components/ui/Misc";
import { ProgressRing } from "@/components/ui/Progress";
import { CardListSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { getProfileSections } from "@/components/provider/profile-sections";
import {
  getProviderSetupConfig,
  isCatalogComplete,
  isLocationsComplete,
  isAvailabilityComplete,
} from "@/lib/provider-setup";
import { Star, CheckCircle2, ChevronLeft } from "lucide-react";

export default function ProviderProfileOverviewPage() {
  const currentUser = useStore((s) => s.currentUser);
  const provider = useCurrentProvider();

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

  const setupConfig = getProviderSetupConfig(provider.provider_type);
  const sections = getProfileSections(setupConfig).filter((s) => s.key !== "overview");

  const isVerified = provider.status === "approved";
  const checklist: { ok: boolean; label: string }[] = [
    { ok: !!provider.license_number, label: "מספר רישיון" },
    { ok: !!provider.specialty, label: "תחום התמחות" },
    ...(setupConfig.showAgreements ? [{ ok: provider.agreements.length > 0, label: "הסדרי ביטוח (S/K/B/H)" }] : []),
    { ok: isCatalogComplete(provider), label: setupConfig.catalogLabel },
    ...(setupConfig.locationTypes.length > 0
      ? [{ ok: isLocationsComplete(provider), label: setupConfig.locationLabelPlural }]
      : []),
    ...(setupConfig.showAvailability ? [{ ok: isAvailabilityComplete(provider), label: "זמינות שבועית" }] : []),
    { ok: isVerified, label: "אישור Healson" },
    { ok: provider.is_published, label: "פרסום פרופיל" },
  ];
  const percent = Math.round((checklist.filter((i) => i.ok).length / checklist.length) * 100);

  return (
    <ProviderLayout>
      {/* Identity hero */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-neutral-border bg-gradient-to-l from-white via-white to-accent-bg/40 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar
            name={provider.display_name || currentUser.full_name}
            src={provider.image_url}
            className="h-16 w-16 text-xl ring-4 ring-white shadow-md"
          />
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {provider.title} {provider.display_name}
              </h1>
              <ProviderStatusBadge
                status={provider.status}
                title={provider.status === "rejected" ? provider.rejection_reason : undefined}
              />
              {provider.is_published && <ProviderPublishedBadge />}
            </div>
            <p className="mt-0.5 text-sm font-medium text-amber-700">{provider.specialty || "—"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              {provider.license_number && <p className="text-xs text-slate-400 font-mono">{provider.license_number}</p>}
              {!!provider.rating && (
                <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {provider.rating.toFixed(1)} ({provider.review_count ?? 0} ביקורות)
                </span>
              )}
            </div>
          </div>
          <ProgressRing
            percent={percent}
            tone={percent === 100 ? "success" : "primary"}
            label="פרופיל"
            textClassName="text-slate-900"
          />
        </div>
      </div>

      {/* Completion checklist */}
      {percent < 100 && (
        <Card className="mb-6">
          <CardContent className="pt-4">
            <SectionHeading>השלמת הפרופיל</SectionHeading>
            <div className="grid gap-2 sm:grid-cols-2">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className={`h-4 w-4 ${item.ok ? "text-emerald-500" : "text-slate-300"}`} />
                  <span className={item.ok ? "text-slate-700" : "text-slate-400"}>{item.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section cards — navigate to each configuration page */}
      <SectionHeading>ניהול הפרופיל</SectionHeading>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <s.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{s.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{s.description}</p>
            </div>
            <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-x-0.5" />
          </Link>
        ))}
      </div>
    </ProviderLayout>
  );
}
